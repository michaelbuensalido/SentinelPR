import asyncpg

from .config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def vec_literal(v: list[float]) -> str:
    """pgvector text literal; cast with ::vector in SQL."""
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"
