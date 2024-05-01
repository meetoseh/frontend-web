"""Most webpages are served directly by nginx, however, when we want to inject
metadata into the page, this will handle serving the correct HTML file. Generally,
we take the generated index.html and modify the tags we're taking over, and cache
the result.

Because this doesn't materially affect the page, in development it may not be
necessary to run this server. However, the rerouting rules are often still helpful
"""

import os
from itgs import Itgs
import updater
from fastapi import FastAPI, Request, Response
from typing import cast
from starlette.middleware.cors import CORSMiddleware
from error_middleware import handle_request_error
import routes.journey_public_links
import routes.favorites
import routes.authorize
import routes.user_touch_links
import routes.update_password
import asyncio
import requests

app = FastAPI(
    title="oseh frontend",
    description="hypersocial daily mindfulness",
    version="1.0.0+alpha",
    openapi_url=None,
    docs_url=None,
    exception_handlers={Exception: handle_request_error},
)
serve_static = False

if os.environ.get("ENVIRONMENT") == "dev":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.environ["ROOT_FRONTEND_URL"]],
        allow_credentials=True,
        allow_methods=["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Pragma", "Cache-Control", "Visitor"],
        expose_headers=["x-image-file-jwt"],
    )
    serve_static = os.path.exists("build")
    print("serve_static:", serve_static)

app.include_router(routes.journey_public_links.router)
app.include_router(routes.favorites.router)
app.include_router(routes.authorize.router)
app.include_router(routes.user_touch_links.router)
app.include_router(routes.update_password.router)
app.router.redirect_slashes = False


if os.environ["ENVIRONMENT"] == "dev":
    import urllib3

    assert (
        "ROOT_NGINX_FRONTEND_URL" in os.environ
    ), "ROOT_NGINX_FRONTEND_URL must be set in dev"
    assert "ROOT_FRONTEND_SSR_URL" in os.environ, "ROOT_FRONTEND_SSR_URL must be set"

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    nginx_url = os.environ["ROOT_NGINX_FRONTEND_URL"]
    ssr_url = os.environ["ROOT_FRONTEND_SSR_URL"]
    email_templates_url = os.environ["ROOT_EMAIL_TEMPLATE_URL"]
    forwarded_headers = frozenset(("Content-Type", "ETag", "Cache-Control", "Location"))

    # Avoids the need for port forwarding
    @app.get("{full_path:path}", include_in_schema=False)
    def catch_all(request: Request, full_path: str):
        raw_path = cast(str, request.scope["raw_path"].decode("utf-8"))
        raw_query_params = request.scope["query_string"].decode("utf-8")
        raw_loc = f"{raw_path}?{raw_query_params}" if raw_query_params else raw_path

        if (
            raw_path.startswith("/shared")
            or raw_path.startswith("/s/")
            or raw_path
            in (
                "/sitemap.xml",
                "/sitemap.txt",
            )
        ):
            full_url = ssr_url + raw_loc
        elif raw_path.startswith("/api/3/"):
            full_url = email_templates_url + raw_loc
        else:
            if serve_static:
                filepath = os.path.join("build", raw_path.lstrip("/"))
                if os.path.exists(filepath) and os.path.isdir(filepath):
                    filepath = os.path.join(filepath, "index.html")
                if os.path.exists(filepath) and os.path.isfile(filepath):
                    content_type = None
                    if filepath.endswith(".css"):
                        content_type = "text/css; charset=utf-8"
                    elif filepath.endswith(".js"):
                        content_type = "application/javascript; charset=utf-8"
                    elif filepath.endswith(".html"):
                        content_type = "text/html; charset=utf-8"
                    elif filepath.endswith(".json"):
                        content_type = "application/json; charset=utf-8"
                    elif filepath.endswith(".png"):
                        content_type = "image/png"
                    elif filepath.endswith(".jpg") or filepath.endswith(".jpeg"):
                        content_type = "image/jpeg"
                    elif filepath.endswith(".svg"):
                        content_type = "image/svg+xml"
                    with open(filepath, "rb") as f:
                        return Response(
                            content=f.read(),
                            headers=(
                                None
                                if content_type is None
                                else {"Content-Type": content_type}
                            ),
                        )
                else:
                    with open("build/index.html", "rb") as f:
                        return Response(
                            content=f.read(),
                            headers={
                                "Content-Type": "text/html; charset=utf-8",
                            },
                        )

            full_url = nginx_url + raw_loc

        try:
            raw_response = requests.get(full_url, verify=False, allow_redirects=False)
        except:
            return Response(status_code=500)

        headers = dict(
            (k, v) for (k, v) in raw_response.headers.items() if k in forwarded_headers
        )

        return Response(
            content=raw_response.content,
            status_code=raw_response.status_code,
            headers=headers,
        )


background_tasks = set()


@app.on_event("startup")
async def register_background_tasks():
    async with Itgs() as itgs:
        cache = await itgs.local_cache()
        while cache.evict(tag="no-persist") > 0:
            pass

    background_tasks.add(asyncio.create_task(updater.listen_forever()))
