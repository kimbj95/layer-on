from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.geometry import router as geometry_router
from app.routers.upload import cleanup_old_sessions, router as upload_router, MAX_FILE_SIZE
from utils.dwg_converter import is_converter_available


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_old_sessions()
    yield


app = FastAPI(title="LayerOn API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://layer-on.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(geometry_router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "converter_available": is_converter_available(),
        "max_file_size_mb": MAX_FILE_SIZE // (1024 * 1024),
    }
