import os
from typing import Optional
from itgs import Itgs
from fastapi import APIRouter, Response
import csrf

router = APIRouter()


@router.get("/update-password")
async def get_update_password_html_route():
    async with Itgs() as itgs:
        html = await get_update_password_html(itgs)
    return Response(
        content=html,
        headers={
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": "object-src 'none'; script-src 'self'; base-uri 'self'",
        },
        status_code=200,
    )


@router.get("/update-password.js")
async def get_update_password_js_route():
    async with Itgs() as itgs:
        raw_js = await get_update_password_js(itgs)
    insertion_index = get_csrf_insertion_index(raw_js)
    csrf_token = await csrf.create_csrf("oseh-web", 60 * 60)

    js = (
        raw_js[:insertion_index] + csrf_token.encode("utf-8") + raw_js[insertion_index:]
    )
    return Response(
        content=js,
        headers={
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        status_code=200,
    )


base_update_password_html = (
    "public/update-password.html"
    if os.environ["ENVIRONMENT"] == "dev"
    else "/var/www/update-password.html"
)
base_update_password_js = (
    "public/update-password.js"
    if os.environ["ENVIRONMENT"] == "dev"
    else "/var/www/update-password.js"
)


async def get_update_password_html(itgs: Itgs) -> bytes:
    """
    Returns the update-password.html page, after substitutions, with caching
    """
    cache_key = "update-password:html"
    cache = await itgs.local_cache()

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    html = create_update_password_html()
    if os.environ["ENVIRONMENT"] != "dev":
        # we want live reloads
        cache.set(cache_key, html, tag="no-persist")
    return html


def create_update_password_html() -> bytes:
    """
    Returns the update-password.html page, after substituting %REACT_APP_PUBLIC_URL%,
    without caching
    """
    with open(base_update_password_html, "rb") as f:
        html = f.read()
    return html.replace(
        b"%REACT_APP_PUBLIC_URL%",
        os.environ["ROOT_FRONTEND_URL"].encode("utf-8"),
    )


async def get_update_password_js(itgs: Itgs) -> bytes:
    cache_key = "update-password:js"
    cache = await itgs.local_cache()

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    js = create_update_password_js()
    if os.environ["ENVIRONMENT"] != "dev":
        # we want live reloads
        cache.set(cache_key, js, tag="no-persist")
    return js


def create_update_password_js() -> bytes:
    with open(base_update_password_js, "rb") as f:
        result = f.read()

    backend_url_insertion_index = get_backend_url_insertion_index(result)
    return (
        result[:backend_url_insertion_index]
        + os.environ["ROOT_BACKEND_URL"].encode("utf-8")
        + result[backend_url_insertion_index:]
    )


__cached_csrf_insertion_index: Optional[int] = None


def get_csrf_insertion_index(js: bytes) -> int:
    global __cached_csrf_insertion_index

    if __cached_csrf_insertion_index is not None:
        return __cached_csrf_insertion_index

    insertion_index = js.find(b"var CSRF_TOKEN = '';")
    if insertion_index == -1:
        raise ValueError("CSRF_TOKEN not found in update-password.js")
    insertion_index += len('var CSRF_TOKEN = "')
    __cached_csrf_insertion_index = insertion_index
    return insertion_index


def get_backend_url_insertion_index(js: bytes) -> int:
    insertion_index = js.find(b"var BACKEND_URL = '';")
    if insertion_index == -1:
        raise ValueError("CSRF_TOKEN not found in update-password.js")
    insertion_index += len('var BACKEND_URL = "')
    return insertion_index
