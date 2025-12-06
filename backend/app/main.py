from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from .config import settings
from .database import init_db
from .routers import evaluations, heuristics, baselines, recommendations, trends


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown events.
    """
    # Startup: Initialize database
    init_db()
    print("✓ Database initialized")
    yield
    # Shutdown: cleanup if needed
    print("✓ Application shutdown")


# Create FastAPI app
app = FastAPI(
    title="AI Bias & Heuristics Diagnostic Tool API",
    description="RESTful API for simulating heuristic bias detection in AI systems",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler for better error responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for unhandled errors.
    """
    if settings.debug:
        # In debug mode, show full error
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(exc),
                    "details": {"type": type(exc).__name__},
                }
            },
        )
    else:
        # In production, hide error details
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An internal error occurred",
                    "details": {},
                }
            },
        )


# Register routers
app.include_router(evaluations.router)
app.include_router(heuristics.router)
app.include_router(baselines.router)
app.include_router(recommendations.router)
app.include_router(trends.router)


# Health check endpoint
@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "AI Bias & Heuristics Diagnostic Tool API",
        "version": "1.0.0",
    }


# Root endpoint
@app.get("/")
def root():
    """
    Root endpoint with API information.
    """
    return {
        "message": "AI Bias & Heuristics Diagnostic Tool API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
    }
