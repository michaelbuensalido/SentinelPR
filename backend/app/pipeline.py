"""Review pipeline: QUEUED -> RETRIEVING_CONTEXT -> ANALYZING -> COMPLETED."""
import json
import logging
import time

from . import github
from .db import get_pool
from .diff_parser import format_for_prompt, parse_diff
from .llm import evaluate, filter_comments
from .rag import retrieve_context

log = logging.getLogger(__name__)


async def _set(review_id, status: str, **extra):
    pool = await get_pool()
    await pool.execute(
        "UPDATE pr_reviews SET status=$2, latency_ms=COALESCE($3, latency_ms), tokens=COALESCE($4, tokens), "
        "result=COALESCE($5::jsonb, result) WHERE id=$1",
        review_id, status, extra.get("latency_ms"), extra.get("tokens"),
        json.dumps(extra["result"]) if "result" in extra else None)


async def run_review(review_id, repo_id, full_name: str, pr_number: int, commit_sha: str) -> None:
    start = time.monotonic()
    try:
        await _set(review_id, "RETRIEVING_CONTEXT")
        diff = await github.fetch_diff(full_name, pr_number)
        files = parse_diff(diff)
        context = await retrieve_context(repo_id, files)

        await _set(review_id, "ANALYZING")
        result, tokens = await evaluate(format_for_prompt(files), context)
        valid = {f.path: set(f.added) for f in files}
        kept = filter_comments(result.comments, valid)
        await github.post_review(full_name, pr_number, commit_sha, [c.model_dump() for c in kept])

        payload = {
            "diff": [{"path": f.path,
                      "lines": [{"type": "add", "n": n, "text": f.added[n]} for n in f.lines[:300]]}
                     for f in files],
            "comments": [c.model_dump() for c in kept],
            "context": [{"file_path": c["file_path"], "symbol_name": c["symbol_name"],
                         "similarity": float(c["similarity"]), "raw_code": c["raw_code"]} for c in context],
        }
        await _set(review_id, "COMPLETED", latency_ms=int((time.monotonic() - start) * 1000),
                   tokens=tokens, result=payload)
    except Exception:
        log.exception("review failed")
        await _set(review_id, "FAILED", latency_ms=int((time.monotonic() - start) * 1000))
        raise  # lets arq retry with backoff
