from fastapi import APIRouter
from fastapi.responses import Response
from itgs import Itgs
from lib.touch.links import click_link
from routes.journey_public_links import (
    create_journey_public_link_response,
    get_base_index_html,
)
from typing import Dict, Any

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
        else:
            return await get_base_index_html()

        return Response(
            content=raw_response, status_code=200, headers={"Content-Type": "text/html"}
        )
