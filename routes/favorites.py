from fastapi import APIRouter
from fastapi.responses import Response
from itgs import Itgs
from routes.journey_public_links import (
    get_cached,
    set_cached,
    create_journey_public_link_response,
)

router = APIRouter()


@router.get("/favorites")
async def get_favorites():
    cache_key = "favorites"
    async with Itgs() as itgs:
        cached = await get_cached(itgs, cache_key)
        if cached is not None:
            return cached

        raw_response = await create_journey_public_link_response(
            meta={
                "og:title": "Oseh: Favorites",
                "description": "View your history and your favorite classes on Oseh",
            },
            title="Oseh: Favorites",
        )
        await set_cached(itgs, cache_key, raw_response)
        return Response(
            content=raw_response, status_code=200, headers={"Content-Type": "text/html"}
        )
