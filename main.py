"""Most webpages are served directly by nginx, however, when we want to inject
metadata into the page, this will handle serving the correct HTML file. Generally,
we take the generated index.html and modify the tags we're taking over, and cache
the result.

Because this doesn't materially affect the page, in development it's not necessary
to run this server.
"""
import os
import updater
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from error_middleware import handle_request_error
import routes.journey_public_links
import asyncio


app = FastAPI(
    title="oseh frontend",
    description="hypersocial daily mindfulness",
    version="1.0.0+alpha",
    openapi_url=None,
    docs_url=None,
    exception_handlers={Exception: handle_request_error},
)

if os.environ.get("ENVIRONMENT") == "dev":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.environ["ROOT_FRONTEND_URL"]],
        allow_credentials=True,
        allow_methods=["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Pragma", "Cache-Control", "Visitor"],
        expose_headers=["x-image-file-jwt"],
    )

app.include_router(routes.journey_public_links.router)
app.router.redirect_slashes = False


background_tasks = set()


@app.on_event("startup")
def register_background_tasks():
    background_tasks.add(asyncio.create_task(updater.listen_forever()))
