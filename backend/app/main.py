"""
Finance Copilot — FastAPI application factory.
Configures middleware, routers, and exception handlers.
"""

import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.core.exceptions import AppException, app_exception_handler
from app.core.rate_limiter import limiter
from app.modules.auth.router import router as auth_router
from app.modules.goals.router import router as goals_router
from app.modules.portfolio.router import router as portfolio_router
from app.modules.transactions.router import router as transactions_router


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Run startup and shutdown tasks."""
    # Startup: could run DB connection checks, cache warm-up, etc.
    yield
    # Shutdown: close DB engine etc.
    from app.database import engine
    await engine.dispose()


# ── App factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description="Personal Finance & Portfolio Management Platform for Indian Users",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── Rate limiter state ────────────────────────────────────────────────────
    app.state.limiter = limiter

    # ── Middleware stack (outermost → innermost) ──────────────────────────────
    # CORS — must be before all other middleware
    print("ALLOWED ORIGINS:", settings.allowed_origins_list)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Note: SlowAPIMiddleware is NOT added globally to avoid interfering with CORS preflight.
    # Rate limiting is applied per-endpoint using @limiter.limit() decorators.

    # ── Request ID middleware (inline) ─────────────────────────────────────────
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    
    # ── Exception handlers ────────────────────────────────────────────────────
    app.add_exception_handler(AppException, app_exception_handler)  # type: ignore
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

    # ── Routers ───────────────────────────────────────────────────────────────
    API_V1 = "/api/v1"
    app.include_router(auth_router, prefix=API_V1)
    app.include_router(transactions_router, prefix=API_V1)
    app.include_router(portfolio_router, prefix=API_V1)
    app.include_router(goals_router, prefix=API_V1)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["System"], include_in_schema=False)
    async def health() -> dict:
        return {"status": "ok", "version": "1.0.0"}

    return app


app = create_app()
