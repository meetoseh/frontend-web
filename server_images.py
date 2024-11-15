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
      "resolutions": "full-bleed",  /* or array of [width, height] */
      "transparency": true /* optional, defaults to false, switches jpeg to png */
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


RESOLUTION_PRESETS: Dict[str, List[Tuple[int, int]]] = dict()
RESOLUTION_PRESETS["full-bleed-mobile-1x"] = [
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
]
RESOLUTION_PRESETS["full-bleed-mobile-2x"] = [
    (w * 2, h * 2) for (w, h) in RESOLUTION_PRESETS["full-bleed-mobile-1x"]
]
RESOLUTION_PRESETS["full-bleed-mobile-3x"] = [
    (w * 3, h * 3) for (w, h) in RESOLUTION_PRESETS["full-bleed-mobile-1x"]
]
RESOLUTION_PRESETS["full-bleed-mobile-special"] = [
    # Resolutions that we know are specifically common window sizes, but
    # don't actually correspond to the devices resolution (i.e., they are
    # after status bars are taken into account)
    (360, 736),
    (1472, 720),
]
RESOLUTION_PRESETS["full-bleed-mobile"] = [
    *RESOLUTION_PRESETS["full-bleed-mobile-1x"],
    *RESOLUTION_PRESETS["full-bleed-mobile-2x"],
    *RESOLUTION_PRESETS["full-bleed-mobile-3x"],
    *RESOLUTION_PRESETS["full-bleed-mobile-special"],
]
RESOLUTION_PRESETS["full-bleed-desktop"] = [
    (2560, 1600),
    (1920, 1080),
    (1366, 768),
    (1536, 864),
]
RESOLUTION_PRESETS["full-bleed"] = [
    *RESOLUTION_PRESETS["full-bleed-mobile"],
    *RESOLUTION_PRESETS["full-bleed-desktop"],
]
RESOLUTION_PRESETS["headshot"] = [
    (38, 38),
    (45, 45),
    (56, 56),
    (60, 60),
    (76, 76),
    (90, 90),
    (112, 112),
    (120, 120),
    (168, 168),
    (180, 180),
    (189, 189),
    (224, 224),
    (256, 256),
    (378, 378),
    (512, 512),
    (567, 567),
]


for key, opts in RESOLUTION_PRESETS.items():
    RESOLUTION_PRESETS[key] = list(dict.fromkeys(opts))

ResolutionPreset = Literal[
    "full-bleed-mobile-1x",
    "full-bleed-mobile-2x",
    "full-bleed-mobile-3x",
    "full-bleed-mobile-special",
    "full-bleed-mobile",
    "full-bleed-desktop",
    "full-bleed",
    "headshot",
]


class ServerImageFile(BaseModel):
    uid: str = Field(description="unique identifier for this image")
    name: str = Field(
        description="arbitrary name for the image file, for debugging purposes"
    )
    comment: str = Field(description="comment about where this image is used")
    source: str = Field(
        description="path to source image file, relative to the project root"
    )
    resolutions: Union[
        ResolutionPreset, List[Union[Tuple[int, int], ResolutionPreset]]
    ] = Field(
        description="list of resolutions to generate, or a preset, or a combination"
    )
    transparency: bool = Field(False, description="whether to use a transparent format")
    focal_point: Tuple[float, float] = Field(
        (0.5, 0.5),
        description="focal point for cropping, where 0, 0 is the top left and 1, 1 is bottom right",
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
        else:
            new_resolutions: List[Tuple[int, int]] = []
            for resolution in file.resolutions:
                if isinstance(resolution, str):
                    new_resolutions.extend(RESOLUTION_PRESETS[resolution])
                else:
                    new_resolutions.append(tuple(resolution))
            # dict will preserve order
            file.resolutions = list(dict((k, 1) for k in new_resolutions))

        old_resolutions = None
        old_transparency = None
        old_focal_point = None
        old_file = old_config_lookup.get(file.uid)
        if old_file is not None:
            old_resolutions = old_file.resolutions
            old_transparency = old_file.transparency
            old_focal_point = old_file.focal_point

        await ensure_file_exists(
            itgs,
            file,
            force=(
                old_resolutions != file.resolutions
                or old_transparency != file.transparency
                or old_focal_point != file.focal_point
            ),
        )

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
        job_done_task = asyncio.create_task(wait_job_done(itgs, job_uid, 120))
        await jobs.enqueue(
            "runners.delete_image_file", uid=file.uid, job_uid=job_uid, force=True
        )
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
    job_done_task = asyncio.create_task(wait_job_done(itgs, job_uid, 120))

    jobs = await itgs.jobs()
    await jobs.enqueue(
        "runners.generate_server_image",
        file_uid=file.uid,
        file_name=file.name,
        file_s3_key=s3_key,
        file_resolutions=file.resolutions,
        job_uid=job_uid,
        transparency=file.transparency,
        focal_point=file.focal_point,
    )

    await job_done_task
    print(f"Finished processing {file.source=}")


async def delete_file(itgs: Itgs, file: ServerImageFile):
    print(f"Deleting {file.uid=} ({file.name=}) which is no longer needed")
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
            await pubsub.aclose()
            raise Exception(f"timed out waiting for {job_uid=} to finish")

    await pubsub.aclose()


if __name__ == "__main__":
    asyncio.run(main())
