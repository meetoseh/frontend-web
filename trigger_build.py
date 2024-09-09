"""Triggers a build by spawning the appropriate EC2 instance, configuring it,
uploading scripts/build/, /home/ec2-user/config.sh, and /home/ec2-user/repo.sh
into /home/ec2-user/bootstrap/ then invoking /home/ec2-user/scripts/build/main.sh

This is a seperate file to allow for manually running this for testing purposes.
Pass --dry-run to avoid actually spawning the instance
"""

import asyncio
import json
import secrets
import time
from typing import Awaitable, Callable, List
import aioboto3
from error_middleware import handle_error
from itgs import Itgs
import argparse
import datetime
import os
from contextlib import asynccontextmanager
import paramiko
import anyio
import io
from temp_files import temp_file
from remote_executor import (
    write_echo_commands_for_file,
    write_echo_commands_for_folder,
    exec_simple,
)
from loguru import logger
import botocore.exceptions


INSTANCE_TYPE = "c7g.2xlarge"


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    async with Itgs() as itgs:
        await run_with_args(itgs, dry_run=args.dry_run)


async def run_with_args(itgs: Itgs, *, dry_run: bool):
    build_subnet_id = os.environ["OSEH_BUILD_SUBNET_ID"]
    backup_build_subnet_id = os.environ["OSEH_BACKUP_BUILD_SUBNET_ID"]
    build_ami_id = os.environ["OSEH_BUILD_AMI_ID"]
    build_security_group_id = os.environ["OSEH_BUILD_SECURITY_GROUP_ID"]
    build_iam_instance_profile_name: str = os.environ[
        "OSEH_BUILD_IAM_INSTANCE_PROFILE_NAME"
    ]

    logger.info(f"Triggering build at {datetime.datetime.now()}:")
    logger.info(f"  Dry Run: {dry_run}")
    logger.info(f"  Instance Type: {INSTANCE_TYPE}")
    logger.info(f"  Subnet ID: {build_subnet_id} (backup: {backup_build_subnet_id})")
    logger.info(f"  AMI ID: {build_ami_id}")
    logger.info(f"  Security Group ID: {build_security_group_id}")
    logger.info(f"  IAM Instance Profile Name: {build_iam_instance_profile_name}")

    await trigger_build(
        itgs,
        build_subnet_id=build_subnet_id,
        build_ami_id=build_ami_id,
        build_security_group_id=build_security_group_id,
        build_iam_instance_profile_name=build_iam_instance_profile_name,
        backup_build_subnet_id=backup_build_subnet_id,
        dry_run=dry_run,
    )


async def trigger_build(
    itgs: Itgs,
    *,
    build_subnet_id: str,
    build_ami_id: str,
    build_security_group_id: str,
    build_iam_instance_profile_name: str,
    backup_build_subnet_id: str,
    dry_run: bool,
) -> None:
    slack = await itgs.slack()
    session = aioboto3.Session()

    single_file_script = await anyio.to_thread.run_sync(generate_single_file_script)
    if dry_run:
        logger.info(f"Would have executed the following script:")
        logger.info(single_file_script)
        return

    with temp_file(".pem") as key_file_path:
        async with session.client("ec2") as client, cleanup_functions() as cleanup:
            logger.info("Generating key pair...")
            suggested_build_key_name = (
                f"key-frontend-web-build-{secrets.token_urlsafe(6)}"
            )
            response = await client.create_key_pair(
                KeyName=suggested_build_key_name,
                KeyType="rsa",
                TagSpecifications=[
                    {
                        "ResourceType": "key-pair",
                        "Tags": [{"Key": "Name", "Value": "frontend-web build"}],
                    }
                ],
                KeyFormat="pem",
            )

            key_material = response["KeyMaterial"]
            with open(key_file_path, "w") as f:
                f.write(key_material)

            build_key_name = response["KeyName"]
            await slack.send_ops_message(
                f"Frontend-Web generated build key pair: {build_key_name}"
            )

            async def _cleanup_key():
                logger.info("Deleting key pair...")
                await client.delete_key_pair(KeyName=build_key_name)
                await slack.send_ops_message(
                    f"Frontend-Web deleted build key pair: {build_key_name}"
                )

            cleanup.append(_cleanup_key)

            run_instances_params = {
                "ImageId": build_ami_id,
                "NetworkInterfaces": [
                    {
                        "DeviceIndex": 0,
                        "AssociatePublicIpAddress": False,
                        "SubnetId": build_subnet_id,
                        "Groups": [build_security_group_id],
                    }
                ],
                "InstanceType": INSTANCE_TYPE,
                "MinCount": 1,
                "MaxCount": 1,
                "KeyName": build_key_name,
                "IamInstanceProfile": {"Name": build_iam_instance_profile_name},
                "BlockDeviceMappings": [
                    {
                        "DeviceName": "/dev/xvda",
                        "Ebs": {"VolumeType": "gp3", "VolumeSize": 32},
                    }
                ],
                "TagSpecifications": [
                    {
                        "ResourceType": "instance",
                        "Tags": [{"Key": "Name", "Value": "frontend-web build"}],
                    }
                ],
            }
            logger.info(
                "Launching instance in target availability zone...\n"
                + json.dumps(run_instances_params, indent=2)
            )
            try:
                response = await client.run_instances(**run_instances_params)
            except botocore.exceptions.ClientError as e:
                logger.exception("Failed to launch instance")
                if e.response["Error"]["Code"] == "InsufficientInstanceCapacity":
                    await slack.send_ops_message(
                        "Frontend-Web failed to launch build server due to insufficient capacity; retrying with backup subnet"
                    )
                    run_instances_params["NetworkInterfaces"][0][
                        "SubnetId"
                    ] = backup_build_subnet_id
                    logger.info(
                        "Launching instance in backup availability zone...\n"
                        + json.dumps(run_instances_params, indent=2)
                    )
                    response = await client.run_instances(**run_instances_params)
                else:
                    raise

            instance_id = response["Instances"][0]["InstanceId"]
            instance_private_ip = response["Instances"][0]["PrivateIpAddress"]
            status = response["Instances"][0]["State"]["Name"]
            await slack.send_ops_message(
                f"Frontend-Web launched build server: {instance_id} ({INSTANCE_TYPE}, {status})"
            )

            async def _cleanup_instance():
                logger.info("Terminating instance...")
                response = await client.terminate_instances(InstanceIds=[instance_id])
                status = (
                    response["TerminatingInstances"][0]["CurrentState"]["Name"]
                    if response["TerminatingInstances"]
                    else "non-existant"
                )
                await slack.send_ops_message(
                    f"Frontend-Web terminated build server: {instance_id} (new status: {status})"
                )
                started_waiting_at = time.time()
                while status not in ("non-existant", "terminated"):
                    if time.time() - started_waiting_at > 600:
                        raise Exception("Timed out waiting for instance to terminate")

                    await asyncio.sleep(5)
                    response = await client.describe_instances(
                        InstanceIds=[instance_id]
                    )
                    new_status = (
                        response["Reservations"][0]["Instances"][0]["State"]["Name"]
                        if (
                            response["Reservations"]
                            and response["Reservations"][0]["Instances"]
                        )
                        else "non-existant"
                    )

                    if new_status != status:
                        status = new_status
                        await slack.send_ops_message(
                            f"Frontend-Web build server {instance_id} status: {status}"
                        )

            cleanup.append(_cleanup_instance)

            started_waiting_at = time.time()
            while status != "running":
                if time.time() - started_waiting_at > 600:
                    raise Exception("Timed out waiting for instance to start")

                await asyncio.sleep(5)
                response = await client.describe_instances(InstanceIds=[instance_id])
                new_status = response["Reservations"][0]["Instances"][0]["State"][
                    "Name"
                ]

                if new_status != status:
                    status = new_status
                    await slack.send_ops_message(
                        f"Frontend-Web build server {instance_id} status: {status}"
                    )

            seen_build_ready = asyncio.Event()

            async def _wait_for_build_ready():
                try:
                    async with Itgs() as itgs:
                        redis = await itgs.redis()
                        pubsub = redis.pubsub()
                        await pubsub.subscribe("updates:frontend-web:build_ready")
                        while (
                            await pubsub.get_message(
                                ignore_subscribe_messages=True, timeout=5
                            )
                        ) is None:
                            pass
                        await slack.send_ops_message(
                            "Frontend-Web detected build ready"
                        )
                        seen_build_ready.set()
                except Exception as e:
                    await handle_error(e, extra_info="in _wait_for_build_ready")
                    raise e

            build_ready_task = asyncio.create_task(_wait_for_build_ready())

            async def cancel_build_ready_task():
                build_ready_task.cancel()

            cleanup.append(cancel_build_ready_task)

            logger.info("Executing script on instance...")
            try:
                stdout, stderr = await asyncio.wait_for(
                    anyio.to_thread.run_sync(
                        connect_and_execute,
                        instance_private_ip,
                        key_file_path,
                        single_file_script,
                    ),
                    timeout=1800,
                )
            except asyncio.TimeoutError:
                logger.warning("Script timed out (30m)")
                await slack.send_ops_message(
                    "Frontend-Web build timed out (script did not complete within 30 minutes)"
                )
                raise

            logger.info("Script finished normally, waiting for build_ready...")

            try:
                await asyncio.wait_for(seen_build_ready.wait(), timeout=300)
            except asyncio.TimeoutError:
                logger.warning("build_ready timed out (5m)")
                await slack.send_ops_message(
                    "Frontend-Web build timed out (build_ready was not published within 5 minutes of script finishing)"
                )
                raise

            logger.info("build_ready detected, storing build logs...")
            await slack.send_ops_message("frontend-web storing build logs...")

            with temp_file() as stdout_path, temp_file() as stderr_path:
                with open(stdout_path, "w") as f:
                    f.write(stdout)
                with open(stderr_path, "w") as f:
                    f.write(stderr)

                files = await itgs.files()
                with open(stdout_path, "rb") as f:
                    await files.upload(
                        f,
                        bucket=files.default_bucket,
                        key="builds/frontend-web/build-stdout.txt",
                        sync=True,
                    )

                with open(stderr_path, "rb") as f:
                    await files.upload(
                        f,
                        bucket=files.default_bucket,
                        key="builds/frontend-web/build-stderr.txt",
                        sync=True,
                    )

            logger.info("cleaning up...")
            await slack.send_ops_message("Frontend-Web cleaning up ec2 artifacts...")

    logger.info("Done cleaning up ec2 artifacts, triggering frontend-web update...")
    await slack.send_ops_message(
        "Frontend-Web build complete, triggering frontend-web update..."
    )
    redis = await itgs.redis()
    await redis.publish("updates:frontend-web:do_update", "1")
    logger.info("Done triggering frontend-web update")


@asynccontextmanager
async def cleanup_functions():
    funcs: List[Callable[[], Awaitable[None]]] = []
    try:
        yield funcs
    except Exception as base_e:
        await handle_error(base_e, extra_info="in wrapped function")
        raise
    finally:
        last_e = None
        for idx in range(len(funcs) - 1, -1, -1):
            func = funcs[idx]
            try:
                await func()
            except Exception as e:
                last_e = e
                await handle_error(e, extra_info=f"while in cleanup function {idx}")
        if last_e is not None:
            raise last_e


def generate_single_file_script() -> str:
    res = io.StringIO()
    res.write("cd /usr/local/src\n")
    write_echo_commands_for_folder("scripts/build", "bootstrap", res)
    write_echo_commands_for_file("/home/ec2-user/config.sh", "bootstrap/config.sh", res)
    write_echo_commands_for_file("/home/ec2-user/repo.sh", "bootstrap/repo.sh", res)
    res.write("cd /usr/local/src/bootstrap\n")
    res.write("bash main.sh\n")
    return res.getvalue()


def connect_and_execute(ip: str, key_file_path: str, script: str) -> None:
    for attempt in range(150):
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                hostname=ip,
                username="ec2-user",
                key_filename=key_file_path,
                look_for_keys=False,
                auth_timeout=5,
                banner_timeout=5,
            )
            sftp = client.open_sftp()
            with sftp.open("/home/ec2-user/initial_script.sh", "w") as remote_file:
                remote_file.write(script)

            sftp.chmod("/home/ec2-user/initial_script.sh", 0o755)
            sftp.close()
        except Exception:
            msg = f"Failed to connect to {ip} on attempt {attempt}"
            if attempt == 0:
                logger.trace(msg)
            else:
                logger.warning(msg)
            if attempt == 149:
                raise
            time.sleep(2)
            continue
        break

    logger.info(f"Successfully connected to {ip}, executing script...")
    stdout, stderr = exec_simple(client, "sudo bash /home/ec2-user/initial_script.sh")
    client.close()

    logger.trace(f"stdout: {stdout}")
    logger.trace(f"stderr: {stderr}")
    logger.info(f"Done executing script on {ip}")


if __name__ == "__main__":
    anyio.run(main)
