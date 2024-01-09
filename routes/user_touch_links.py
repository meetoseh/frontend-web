import os
from fastapi import APIRouter
from fastapi.responses import Response
from error_middleware import handle_contextless_error, handle_warning
from itgs import Itgs
from lib.touch.find_user_for_touch import find_user_for_touch
from lib.touch.links import click_link
from routes.journey_public_links import (
    create_journey_public_link_response,
    get_base_index_html,
)
from typing import Dict, Any, cast

router = APIRouter()


@router.get("/l/{code}")
async def get_maybe_web_only_link_by_code(code: str):
    return await get_link_by_code(code)


@router.get("/a/{code}")
async def get_app_link_by_code(code: str):
    return await get_link_by_code(code)


async def get_link_by_code(code: str):
    async with Itgs() as itgs:
        link = await click_link(
            itgs,
            code=code,
            visitor_uid=None,
            user_sub=None,
            track_type="on_click",
            parent_uid=None,
            clicked_at=None,
            should_track=False,
            now=None,
        )

        preview_identifier: str = "default"
        preview_extra: Dict[str, Any] = dict()

        if link is not None:
            preview_identifier = link.preview_identifier
            preview_extra = link.preview_extra

        if preview_identifier == "example":
            raw_response = await create_journey_public_link_response(
                meta={
                    "og:title": "Oseh: Example Link",
                    "og:description": "Look at this custom description!",
                },
                title="Oseh: Example Link",
            )
        elif preview_identifier == "unsubscribe":
            raw_response = await create_journey_public_link_response(
                meta={
                    "og:title": "Oseh: Unsubscribe",
                    "og:description": f"Unsubscribe from {preview_extra.get('list', 'this list')}",
                },
                title="Oseh: Unsubscribe",
            )
        elif preview_identifier == "share_journey" and isinstance(
            preview_extra.get("journey_uid"), str
        ):
            try:
                raw_response = await create_share_journey_response(
                    itgs, uid=preview_extra["journey_uid"], touch_uid=link.touch_uid
                )
            except Exception as e:
                await handle_contextless_error(
                    extra_info=f"failed to create share journey response using uid `{preview_extra['journey_uid']}`: {e}"
                )
                return Response(
                    status_code=302,
                    headers={"Location": os.environ["ROOT_FRONTEND_URL"]},
                )
        else:
            return await get_base_index_html()

        return Response(
            content=raw_response, status_code=200, headers={"Content-Type": "text/html"}
        )


async def create_share_journey_response(
    itgs: Itgs, /, *, uid: str, touch_uid: str
) -> bytes:
    user_sub = await find_user_for_touch(itgs, touch_uid=touch_uid)
    if user_sub is None:
        await handle_warning(
            f"{__name__}:create_share_journey_response:no_user_sub",
            f"Could not find `user_sub` for `{touch_uid=}`",
        )

    user_given_name: str = "you"

    conn = await itgs.conn()
    cursor = conn.cursor("none")

    if user_sub is not None:
        response = await cursor.execute(
            "SELECT given_name FROM users WHERE sub=?", (user_sub,)
        )
        if response.results and response.results[0][0]:
            user_given_name = response.results[0][0]

    response = await cursor.execute(
        "SELECT journeys.title, journeys.description, instructors.name, content_files.duration_seconds "
        "FROM journeys, instructors, content_files "
        "WHERE"
        " journeys.uid = ?"
        " AND instructors.id = journeys.instructor_id"
        " AND content_files.id = journeys.audio_content_file_id",
        (uid,),
    )

    if not response.results:
        raise Exception(f"Could not find journey with uid `{uid=}`")

    journey_title = cast(str, response.results[0][0])
    journey_description = cast(str, response.results[0][1])
    instructor_name = cast(str, response.results[0][2])
    journey_total_duration_seconds = cast(int, response.results[0][3])

    journey_duration_minutes = int(journey_total_duration_seconds) // 60
    journey_duration_seconds = int(journey_total_duration_seconds) % 60

    journey_duration_str = f"{journey_duration_minutes}:{journey_duration_seconds:02}"

    return await create_journey_public_link_response(
        meta={
            "og:title": f"Oseh: {journey_title} ({journey_duration_str})",
            "og:description": f"A class by {instructor_name} has been recommended for {user_given_name}: {journey_description}",
        },
        title=f"Oseh: {journey_title}",
    )
