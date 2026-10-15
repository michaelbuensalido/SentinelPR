from arq import Retry
from arq.connections import RedisSettings

from .config import settings
from .db import close_pool, get_pool
from .indexer import index_repo
from .pipeline import run_review


async def startup(ctx):
    await get_pool()


async def shutdown(ctx):
    await close_pool()


async def review_task(ctx, review_id: str, repo_id: str, full_name: str, pr_number: int, commit_sha: str):
    try:
        await run_review(review_id, repo_id, full_name, pr_number, commit_sha)
    except Exception as e:
        if ctx["job_try"] < 3:
            raise Retry(defer=2 ** ctx["job_try"]) from e  # exponential backoff, 3 attempts
        raise


async def index_task(ctx, full_name: str):
    try:
        return await index_repo(full_name, settings.github_token)
    except Exception as e:
        if ctx["job_try"] < 3:
            raise Retry(defer=2 ** ctx["job_try"]) from e
        raise


class WorkerSettings:
    functions = [review_task, index_task]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_tries = 3
    job_timeout = 300
