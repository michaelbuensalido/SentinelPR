import json
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import settings
from .db import close_pool, get_pool
from .github import verify_signature


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.queue = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    await get_pool()
    yield
    await app.state.queue.close()
    await close_pool()


app = FastAPI(title="SentinelPR", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    pool = await get_pool()
    await pool.fetchval("SELECT 1")
    await app.state.queue.ping()
    return {"status": "ok"}


async def enqueue_review(full_name: str, pr_number: int, sha: str) -> dict:
    """Idempotent enqueue guarded by review_lock:{repo_id}:{sha}."""
    pool = await get_pool()
    repo = await pool.fetchrow("SELECT id FROM repositories WHERE full_name=$1", full_name)
    if not repo:
        raise HTTPException(404, "repository not indexed")
    lock = f"review_lock:{repo['id']}:{sha}"
    if not await app.state.queue.set(lock, "1", ex=3600, nx=True):
        return {"status": "duplicate"}
    review_id = await pool.fetchval(
        "INSERT INTO pr_reviews (repo_id, pr_number, commit_sha) VALUES ($1,$2,$3) RETURNING id",
        repo["id"], pr_number, sha)
    await app.state.queue.enqueue_job("review_task", str(review_id), str(repo["id"]), full_name, pr_number, sha)
    return {"status": "queued", "review_id": str(review_id)}


@app.post("/api/v1/webhooks/github", status_code=202)
async def github_webhook(request: Request):
    body = await request.body()
    if not verify_signature(body, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(401, "invalid signature")
    event = request.headers.get("X-GitHub-Event")
    payload = json.loads(body)
    if event == "pull_request" and payload.get("action") in ("opened", "synchronize"):
        pr = payload["pull_request"]
        return await enqueue_review(payload["repository"]["full_name"], pr["number"], pr["head"]["sha"])
    if event == "push" and payload.get("ref", "").endswith(payload["repository"].get("default_branch", "main")):
        await app.state.queue.enqueue_job("index_task", payload["repository"]["full_name"])
        return {"status": "index_queued"}
    return {"status": "ignored"}


class ManualReview(BaseModel):
    full_name: str
    pr_number: int
    commit_sha: str


@app.post("/api/v1/reviews", status_code=202)
async def manual_review(req: ManualReview):
    return await enqueue_review(req.full_name, req.pr_number, req.commit_sha)


class IndexReq(BaseModel):
    full_name: str


@app.post("/api/v1/repos/index", status_code=202)
async def index(req: IndexReq):
    await app.state.queue.enqueue_job("index_task", req.full_name)
    return {"status": "index_queued"}


@app.get("/api/v1/repos")
async def repos():
    pool = await get_pool()
    rows = await pool.fetch("SELECT id::text, full_name, index_status, total_chunks FROM repositories ORDER BY full_name")
    return [dict(r) for r in rows]


@app.get("/api/v1/reviews")
async def reviews(repo: str | None = None):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT p.id::text, r.full_name, p.pr_number, p.commit_sha, p.status, p.latency_ms, p.tokens, p.result
           FROM pr_reviews p JOIN repositories r ON r.id=p.repo_id
           WHERE ($1::text IS NULL OR r.full_name=$1) ORDER BY p.id DESC LIMIT 50""", repo)
    return [{**dict(r), "result": json.loads(r["result"]) if r["result"] else None} for r in rows]
