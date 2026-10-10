"""Bound browser origins and request bodies before parsing JSON."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import Settings


class RequestGuard:
    def __init__(self, app: ASGIApp, settings: Settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH", "DELETE"}:
            await self.app(scope, receive, send)
            return
        headers = dict(scope["headers"])
        origin = headers.get(b"origin")
        host = headers.get(b"host", b"").decode("latin-1")
        same_origin = f"{scope['scheme']}://{host}"
        if origin is not None and origin.decode("latin-1") not in {
            *self.settings.CORS_ORIGINS,
            same_origin,
        }:
            await JSONResponse({"detail": "Browser origin is not allowed"}, status_code=403)(
                scope, receive, send
            )
            return

        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                length = int(content_length)
                if length < 0:
                    raise ValueError
            except ValueError:
                await JSONResponse({"detail": "Invalid Content-Length"}, status_code=400)(
                    scope, receive, send
                )
                return
            if length > self.settings.MAX_REQUEST_BYTES:
                await JSONResponse({"detail": "Request body is too large"}, status_code=413)(
                    scope, receive, send
                )
                return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.settings.MAX_REQUEST_BYTES:
                await JSONResponse({"detail": "Request body is too large"}, status_code=413)(
                    scope, receive, send
                )
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, bounded_receive, send)
