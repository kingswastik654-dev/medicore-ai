from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.security import decode_token
from app.db.session import Base, SessionLocal, engine
from app.services.audit import record

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.auto_seed:
        from app.seed import run_seed

        db = SessionLocal()
        try:
            run_seed(db)
        finally:
            db.close()
    yield


class WriteAuditMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] == "GET":
            await self.app(scope, receive, send)
            return

        status_holder = {"code": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["code"] = message["status"]
            await send(message)

        await self.app(scope, receive, send_wrapper)

        path = scope.get("path", "")
        if not path.startswith(settings.api_v1_prefix) or status_holder["code"] >= 500:
            return

        headers = dict(scope.get("headers") or [])
        auth_header = (headers.get(b"authorization") or b"").decode("latin-1")
        username = None
        if auth_header.lower().startswith("bearer "):
            payload = decode_token(auth_header.split(" ", 1)[1])
            username = payload.get("sub") if payload else None

        client = scope.get("client")
        db = SessionLocal()
        try:
            record(
                db,
                actor_username=username,
                action=scope["method"],
                resource_type="http",
                resource_id=path,
                ip=client[0] if client else None,
                user_agent=(headers.get(b"user-agent") or b"").decode("latin-1")[:300] or None,
                detail=f"status={status_holder['code']}",
            )
            db.commit()
        finally:
            db.close()


app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="Hospital Management Platform with integrated AI layer. Phase 0 foundation.",
    lifespan=lifespan,
)

app.add_middleware(WriteAuditMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "service": settings.project_name, "version": settings.version}
