from openai import AsyncOpenAI

from .config import settings

_client: AsyncOpenAI | None = None


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key, max_retries=3)  # exponential backoff
    return _client


async def embed_texts(texts: list[str]) -> list[list[float]]:
    resp = await client().embeddings.create(
        model=settings.embedding_model, input=[t[:8000] for t in texts])
    return [d.embedding for d in resp.data]
