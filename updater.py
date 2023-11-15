"""Handles updating when the repository is updated"""
import time
from typing import Union
from itgs import Itgs
from error_middleware import handle_warning
import asyncio
import subprocess
import platform
import secrets
import socket
import os
import loguru
import anyio
import trigger_build


async def _listen_forever():
    """Subscribes to the redis channel updates:frontend-web and upon
    recieving a message, calls /home/ec2-user/update_webapp.sh
    """

    loguru.logger.info("Starting up, releasing lock...")
    async with Itgs() as itgs:
        slack = await itgs.slack()

        if os.environ.get("ENVIRONMENT") != "dev":
            if await check_if_rebuild_required(itgs):
                await slack.send_ops_message(
                    f"frontend-web {socket.gethostname()} handling rebuild"
                )

                await trigger_build.run_with_args(dry_run=False)

                await slack.send_ops_message(
                    f"frontend-web {socket.gethostname()} restarting again"
                )
                do_update()
                return

        await release_update_lock_if_held(itgs)

        if os.environ.get("ENVIRONMENT") != "dev":
            await slack.send_ops_message(f"frontend-web {socket.gethostname()} ready")

    while True:
        try:
            async with Itgs() as itgs:
                redis = await itgs.redis()
                pubsub = redis.pubsub()
                await pubsub.subscribe("updates:frontend-web")
                while (
                    await pubsub.get_message(ignore_subscribe_messages=True, timeout=5)
                ) is None:
                    pass
                break
        except Exception as e:
            await handle_warning(
                "updater:error", "Error in frontend-web updater loop", e
            )
            await asyncio.sleep(1)

    loguru.logger.info("Recieved update request, awaiting lock...")

    async with Itgs() as itgs:
        await acquire_update_lock(itgs)

    loguru.logger.info("Lock acquired, updating...")
    do_update()


async def acquire_update_lock(itgs: Itgs):
    our_identifier = secrets.token_urlsafe(16).encode("utf-8")
    local_cache = await itgs.local_cache()

    redis = await itgs.redis()
    started_at = time.time()
    while True:
        local_cache.set(b"updater-lock-key", our_identifier, expire=610)
        success = await redis.set(
            b"updates:frontend-web:lock", our_identifier, nx=True, ex=600
        )
        if success:
            loguru.logger.info(f"Lock acquired: {our_identifier}")
            break
        loguru.logger.debug(f"[{time.time() - started_at:.1f}s] still waiting...")
        await asyncio.sleep(1)


DELETE_IF_MATCH_SCRIPT = """
local key = KEYS[1]
local expected = ARGV[1]

local current = redis.call("GET", key)
if current == expected then
    redis.call("DEL", key)
    return 1
end
return 0
"""


async def release_update_lock_if_held(itgs: Itgs):
    local_cache = await itgs.local_cache()

    our_identifier = local_cache.get(b"updater-lock-key")
    if our_identifier is None:
        loguru.logger.info("No lock held")
        return

    loguru.logger.info(f"Releasing lock: {our_identifier}")
    redis = await itgs.redis()
    await redis.eval(
        DELETE_IF_MATCH_SCRIPT, 1, b"updates:frontend-web:lock", our_identifier
    )
    local_cache.delete(b"updater-lock-key")


async def check_if_rebuild_required(itgs: Itgs):
    # Get the current git commit hash
    git_hash = subprocess.check_output(
        "git rev-parse HEAD", shell=True, universal_newlines=True
    ).strip()

    # Set the current version in redis, getting the old value.
    redis = await itgs.redis()
    old_git_hash: Union[bytes, str, None] = await redis.set(
        b"builds:frontend-web:hash", git_hash.encode("utf-8"), get=True
    )
    if isinstance(old_git_hash, bytes):
        old_git_hash = old_git_hash.decode("utf-8")
    if old_git_hash is None or old_git_hash != git_hash:
        loguru.logger.info(f"Rebuild required: {old_git_hash} != {git_hash}")
        return True
    return False


def do_update():
    if platform.platform().lower().startswith("linux"):
        subprocess.Popen(
            "bash /home/ec2-user/update_webapp.sh > /dev/null 2>&1",
            shell=True,
            stdin=None,
            stdout=None,
            stderr=None,
            preexec_fn=os.setpgrp,
        )
    else:
        subprocess.Popen(
            "bash /home/ec2-user/update_webapp.sh",
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            close_fds=True,
        )


async def listen_forever():
    """Subscribes to the redis channel updates:frontend-web and upon
    recieving a message, calls /home/ec2-user/update_webapp.sh
    """
    if os.path.exists("updater.lock"):
        return
    with open("updater.lock", "w") as f:
        f.write(str(os.getpid()))

    try:
        await _listen_forever()
    finally:
        os.unlink("updater.lock")
        print("updater shutdown")


def listen_forever_sync():
    """Subscribes to the redis channel updates:frontend-web and upon
    recieving a message, calls /home/ec2-user/update_webapp.sh
    """
    anyio.run(listen_forever())


if __name__ == "__main__":
    listen_forever_sync()
