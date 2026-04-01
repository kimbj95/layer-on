from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.upload import cleanup_old_sessions, router as upload_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_old_sessions()
    yield


app = FastAPI(title="LayerOn API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
