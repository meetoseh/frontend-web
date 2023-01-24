"""This module is executed in the after_install hook for continuous
deployment. In development, simply run it directly with the standard
environment variables. The old state is stored in server_images_old.json

This is used when we want standard server-side image processing on an
image, rather than react image processing. In particular, this includes
the generation of a playlist file for the image, which allows for much
more granular control over which image file export to use without excessive
boilerplate.

For example, consider a full-bleed full-height background image. To do this
in react typically people use at most two image exports - e.g., 1920x1080
and 768x1000. This leads to almost nobody getting a good match for the image
they actually want - leading to wasted bandwidth AND poor image quality.

On the other hand, our server-side processing is well-suited for quickly
making tens of image exports for a single image, and allowing the client
to pick the one that best matches their viewport. This typically leads to
less wasted bandwidth and better image quality by not downloading useless
image data.

To add or remove an export, just update the "server_images.json" file, which
is in the following format:

{
  "files": [
    {
      "uid": "my-uid",  /* use python server_images.py --generate-uid */
      "name": "my-name",  /* arbitrary name for debugging purposes */
      "comment": "mention where you are using this image, so it can be deleted later",
      "source": "server_images/your-image.jpg",
      "resolutions": "full-bleed"  /* or array of [width, height] */
    }
  ]
}
"""
import argparse
from pydantic import BaseModel, Field
from typing import Dict, List, Set, Union, Literal, Tuple
from itgs import Itgs
import traceback
import hashlib
import secrets
import asyncio
import time
import os


RESOLUTION_PRESETS: Dict[str, List[Tuple[int, int]]] = {
    "full-bleed": [
        # MOBILE
        (360, 800),
        (414, 896),
        (360, 640),
        (390, 844),
        (412, 915),
        (360, 780),
        (375, 812),
        (375, 667),
        (360, 760),
        (393, 851),
        (393, 873),
        (412, 892),
        (428, 926),
        # MOBILE 2X
        (720, 1600),
        (828, 1792),
        (720, 1280),
        (780, 1688),
        (824, 1830),
        (720, 1560),
        (750, 1624),
        (750, 1334),
        (720, 1520),
        (786, 1702),
        (786, 1746),
        (824, 1784),
        (856, 1852),
        # FROM TESTING WITH STATUS BARS
        (360, 736),
        (1472, 720),
        # DESKTOP
        (1920, 1080),
        (1366, 768),
        (1536, 864),
    ]
}

ResolutionPreset = Literal["full-bleed"]


class ServerImageFile(BaseModel):
    uid: str = Field(description="unique identifier for this image")
    name: str = Field(
        description="arbitrary name for the image file, for debugging purposes"
    )
    comment: str = Field(description="comment about where this image is used")
    source: str = Field(
        description="path to source image file, relative to the project root"
    )
    resolutions: Union[ResolutionPreset, List[Tuple[int, int]]] = Field(
        description="list of resolutions to generate, or a preset"
    )


class ServerImageConfig(BaseModel):
    files: List[ServerImageFile] = Field(description="list of files to process")


async def main():
    parser = argparse.ArgumentParser(description="Generate server-side images")
    parser.add_argument(
        "--generate-uid",
        action="store_true",
        help="generate a new unique identifier",
    )

    args = parser.parse_args()
    if args.generate_uid:
        print(f"oseh_if_{secrets.token_urlsafe(16)}")
        return

    async with Itgs() as itgs:
        if not await acquire_lock(itgs):
            print("Didn't acquire lock, exiting")
            return
        try:
            await update_server_images(itgs)
        except Exception as exc:
            traceback.print_exc()
            slack = await itgs.slack()
            await slack.send_web_error_message(
                "Failed to upload server images:\n\n```"
                + "\n".join(
                    traceback.format_exception(type(exc), exc, exc.__traceback__)[-5:]
                )
                + "```"
            )
        finally:
            await release_lock(itgs)


async def acquire_lock(itgs: Itgs) -> bool:
    redis = await itgs.redis()
    success = await redis.set("frontend-web:server_images:lock", "1", ex=300, nx=True)
    return success is True


async def release_lock(itgs: Itgs) -> None:
    redis = await itgs.redis()
    await redis.delete("frontend-web:server_images:lock")


async def update_server_images(itgs: Itgs):
    with open("server_images.json") as f:
        config = ServerImageConfig.parse_raw(f.read())

    old_config = None
    old_config_lookup: Dict[str, ServerImageFile] = dict()

    redis = await itgs.redis()
    old_raw_bytes = await redis.get(b"frontend-web:server_images:config")
    if old_raw_bytes is not None:
        old_config = ServerImageConfig.parse_raw(old_raw_bytes)

        for file in old_config.files:
            old_config_lookup[file.uid] = file

    for file in config.files:
        if isinstance(file.resolutions, str):
            file.resolutions = RESOLUTION_PRESETS[file.resolutions]

        old_resolutions = None
        old_file = old_config_lookup.get(file.uid)
        if old_file is not None:
            old_resolutions = old_file.resolutions

        await ensure_file_exists(itgs, file, force=old_resolutions != file.resolutions)

    if old_config is not None:
        existing_uids: Set[str] = set()
        for file in config.files:
            existing_uids.add(file.uid)

        for file in old_config.files:
            if file.uid not in existing_uids:
                await delete_file(itgs, file)

    new_config_bytes = config.json().encode("utf-8")
    await redis.set(b"frontend-web:server_images:config", new_config_bytes)


async def ensure_file_exists(itgs: Itgs, file: ServerImageFile, force: bool = False):
    if not os.path.exists(file.source):
        raise Exception(f"{file.source=} does not exist")

    ext = os.path.splitext(file.source)[1]

    file_size = os.path.getsize(file.source)
    sha512 = await hash_content(file.source)

    conn = await itgs.conn()
    cursor = conn.cursor("weak")

    existing_by_uid = await cursor.execute(
        "SELECT original_sha512 FROM image_files WHERE uid=?", (file.uid,)
    )

    if existing_by_uid.results:
        previous_sha512 = existing_by_uid.results[0][0]
        if previous_sha512 == sha512:
            print(f"No change in {file.source=} for {file.uid=}")
            if not force:
                print("  skipping")
                return
            else:
                print("  but update was forced")
        else:
            print(f"Detected change in {file.source=} for {file.uid=}...")

        print("  deleting old exports..")
        jobs = await itgs.jobs()
        job_uid = secrets.token_urlsafe(16)
        job_done_task = asyncio.create_task(wait_job_done(itgs, job_uid, 60))
        await jobs.enqueue("runners.delete_image_file", uid=file.uid, job_uid=job_uid)
        await job_done_task
        print("  done")
    else:
        existing_by_sha512 = await cursor.execute(
            "SELECT uid, original_sha512 FROM image_files WHERE original_sha512=?",
            (sha512,),
        )

        if existing_by_sha512.results:
            print(f"{file.source=} is already in use for something else, ignoring")
            raise Exception(
                f"cannot reuse an image file with a different uid ({file.source=}); "
                "if you have a legitimate reason for this, add a comment to the file "
                f"to get a different hash; {sha512=}"
            )

    files = await itgs.files()
    s3_uid = f"oseh_s3f_{secrets.token_urlsafe(16)}"
    s3_key = f"s3_files/images/exports/{file.uid}/{secrets.token_urlsafe(8)}{ext}"

    await cursor.execute(
        """
        INSERT INTO s3_files (
            uid, key, file_size, content_type, created_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (s3_uid, s3_key, file_size, f"images/{ext}", time.time()),
    )

    print(f"Uploading {file.source=} to {s3_key}...")
    with open(file.source, "rb") as f:
        await files.upload(f, bucket=files.default_bucket, key=s3_key, sync=True)

    print(f"Queuing job for {file.source=}...")
    job_uid = secrets.token_urlsafe(16)
    job_done_task = asyncio.create_task(wait_job_done(itgs, job_uid, 60))

    jobs = await itgs.jobs()
    await jobs.enqueue(
        "runners.generate_server_image",
        file_uid=file.uid,
        file_name=file.name,
        file_s3_key=s3_key,
        file_resolutions=file.resolutions,
        job_uid=job_uid,
    )

    await job_done_task
    print(f"Finished processing {file.source=}")


async def delete_file(itgs: Itgs, file: ServerImageFile):
    jobs = await itgs.jobs()
    await jobs.enqueue("runners.delete_image_file", uid=file.uid)


async def hash_content(local_filepath: str) -> str:
    """Hashes the content at the given filepath using sha512."""
    sha512 = hashlib.sha512()
    with open(local_filepath, mode="rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            sha512.update(chunk)
    return sha512.hexdigest()


async def wait_job_done(itgs: Itgs, job_uid: str, timeout: float) -> None:
    redis = await itgs.redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"ps:job:{job_uid}")

    timeout_at = time.time() + timeout
    while (await pubsub.get_message(ignore_subscribe_messages=True, timeout=5)) is None:
        if time.time() > timeout_at:
            await pubsub.close()
            raise Exception(f"timed out waiting for {job_uid=} to finish")

    await pubsub.close()


if __name__ == "__main__":
    asyncio.run(main())
