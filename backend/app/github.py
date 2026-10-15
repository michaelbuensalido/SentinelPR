import hashlib
import hmac

import httpx

from .config import settings

API = "https://api.github.com"


def verify_signature(body: bytes, header: str | None) -> bool:
    if not header or not header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(settings.github_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)


def _headers(accept: str = "application/vnd.github+json") -> dict:
    return {"Authorization": f"Bearer {settings.github_token}", "Accept": accept,
            "X-GitHub-Api-Version": "2022-11-28"}


async def fetch_diff(full_name: str, pr_number: int) -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{API}/repos/{full_name}/pulls/{pr_number}",
                        headers=_headers("application/vnd.github.v3.diff"))
        r.raise_for_status()
        return r.text


async def post_review(full_name: str, pr_number: int, commit_sha: str, comments: list[dict]) -> None:
    """Publish all comments as one atomic review (FR-5.1)."""
    payload = {
        "commit_id": commit_sha,
        "event": "COMMENT",
        "body": f"SentinelPR found {len(comments)} high-confidence issue(s)." if comments
        else "SentinelPR: no high-confidence issues found.",
        "comments": [{"path": c["file_path"], "line": c["line"], "side": "RIGHT", "body": c["body"]}
                     for c in comments],
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{API}/repos/{full_name}/pulls/{pr_number}/reviews", headers=_headers(), json=payload)
        r.raise_for_status()
