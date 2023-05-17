from typing import AsyncIterable, Dict, Optional, Union
from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse
from itgs import Itgs
import aiofiles
import io
import html5lib
import os

router = APIRouter()


base_index_html = (
    "public/index.html" if os.environ["ENVIRONMENT"] == "dev" else "/var/www/index.html"
)


@router.get("/jpl")
async def get_journey_public_link(code: Optional[str] = None):
    """Returns index.html with metadata updated to reflect the journey that is
    linked to with the given journey public link code, if the code is provided
    and valid. Otherwise, returns the standard index page.

    Caches for 5m on success, 15s on failure.
    """
    if code is None or len(code) == 0 or len(code) > 255:
        return await get_base_index_html()

    cache_key = f"journey_public_link:{code}"
    bad_code_cache_key = f"journey_public_link:bad_code:{code}"
    async with Itgs() as itgs:
        cached = await get_cached(itgs, cache_key)
        if cached is not None:
            return cached

        cache = await itgs.local_cache()
        if cache.get(bad_code_cache_key) is not None:
            return await get_base_index_html()

        conn = await itgs.conn()
        cursor = conn.cursor("none")

        response = await cursor.execute(
            """
            SELECT
                journeys.title,
                journeys.description
            FROM journeys
            WHERE
                EXISTS (
                    SELECT 1 FROM journey_public_links
                    WHERE 
                        journey_public_links.journey_id = journeys.id
                        AND journey_public_links.code = ?
                )
            """,
            (code,),
        )
        if not response.results:
            cache.set(bad_code_cache_key, b"1", expire=15)
            return await get_base_index_html()

        journey_title: str = response.results[0][0]
        journey_description: str = response.results[0][1]
        raw_response = await create_journey_public_link_response(
            meta={
                "og:title": journey_title,
                "description": journey_description,
                "og:description": journey_description,
            },
            title=journey_title,
        )
        await set_cached(itgs, cache_key, raw_response)
        return Response(
            content=raw_response, status_code=200, headers={"Content-Type": "text/html"}
        )


async def create_journey_public_link_response(
    meta: Dict[str, str], title: str
) -> bytes:
    tb = html5lib.treebuilders.getTreeBuilder("dom")
    parser = html5lib.HTMLParser(tb, strict=False, namespaceHTMLElements=False)

    with open(base_index_html, "rb") as f:
        dom = parser.parse(f)

    tokens = iter(html5lib.getTreeWalker("dom")(dom))
    result_tokens = []

    while True:
        try:
            token = next(tokens)
        except StopIteration:
            break
        if token["type"] == "EmptyTag" and token["name"] == "meta":
            name = token["data"].get((None, "property"))
            if name is None:
                name = token["data"].get((None, "name"))
            if name is not None and name in meta:
                token["data"][(None, "content")] = meta[name]
            result_tokens.append(token)
        elif token["type"] == "StartTag" and token["name"] == "title":
            next(tokens)
            result_tokens.append(token)
            result_tokens.append({"type": "Characters", "data": title})
            result_tokens.append(next(tokens))
        else:
            result_tokens.append(token)

    serializer = html5lib.serializer.HTMLSerializer(
        omit_optional_tags=False, quote_attr_values="always"
    )

    result = io.BytesIO()
    for block in serializer.serialize(result_tokens, encoding="utf-8"):
        result.write(block)
    result.write(bytes(os.linesep, encoding="utf-8"))
    return result.getvalue()


async def _yield_from_file(path: str) -> AsyncIterable[bytes]:
    async with aiofiles.open(path, "rb") as f:
        while True:
            chunk = await f.read(8192)
            if not chunk:
                break
            yield chunk


async def get_cached(itgs: Itgs, key: str) -> Optional[Response]:
    """Returns the cached response for the given key in the corresponding
    response, if it exists, otherwise returns None.
    """
    cache = await itgs.local_cache()
    raw: Union[bytes, io.BytesIO, None] = cache.get(key, read=True)
    if raw is None:
        return None

    if isinstance(raw, bytes):
        return Response(
            content=raw, status_code=200, headers={"Content-Type": "text/html"}
        )

    return StreamingResponse(
        content=raw,
        status_code=200,
        headers={
            "Content-Type": "text/html",
        },
    )


async def set_cached(itgs: Itgs, key: str, val: bytes) -> None:
    cache = await itgs.local_cache()
    cache.set(key, val, expire=60 * 5)


async def get_base_index_html() -> Response:
    """Returns the unmodified standard index.html"""
    return StreamingResponse(
        content=_yield_from_file(base_index_html),
        status_code=200,
        headers={
            "Content-Type": "text/html",
        },
    )
