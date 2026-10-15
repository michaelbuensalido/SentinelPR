"""Structured LLM evaluation (FR-4)."""
from typing import Literal

from pydantic import BaseModel, Field

from .config import settings
from .embeddings import client

Category = Literal["Bug", "Security", "Architecture Violation", "Breaking Change", "Performance"]


class ReviewComment(BaseModel):
    file_path: str
    line: int = Field(description="Line number in the NEW version of the file, must be an added line")
    category: Category
    body: str
    confidence_score: float = Field(ge=0, le=1)


class ReviewResult(BaseModel):
    comments: list[ReviewComment]


SYSTEM = """You are a senior engineer reviewing a pull request. You get the added lines of the diff
(prefixed with new-file line numbers) and related code chunks from OTHER files in the repo.
Only report high-signal issues: bugs, security flaws, breaking changes to shared interfaces/signatures
used by the provided context, and architecture violations. NEVER comment on style or nitpicks.
Comments must reference an added line. Give an honest confidence_score in [0,1]. Return an empty list if nothing is wrong."""


def build_prompt(diff_text: str, context: list[dict]) -> str:
    ctx = "\n\n".join(
        f"--- {c['file_path']}:{c['start_line']}-{c['end_line']} ({c.get('symbol_name')}, similarity {c['similarity']:.2f})\n{c['raw_code']}"
        for c in context)
    return f"## Diff (added lines)\n{diff_text}\n\n## Related code from the repository\n{ctx or '(none)'}"


def filter_comments(comments: list[ReviewComment], valid_lines: dict[str, set[int]]) -> list[ReviewComment]:
    ok = [c for c in comments
          if c.confidence_score >= settings.confidence_threshold
          and c.line in valid_lines.get(c.file_path, set())]
    ok.sort(key=lambda c: c.confidence_score, reverse=True)
    return ok[: settings.max_comments]


async def evaluate(diff_text: str, context: list[dict]) -> tuple[ReviewResult, int]:
    resp = await client().beta.chat.completions.parse(
        model=settings.llm_model,
        messages=[{"role": "system", "content": SYSTEM},
                  {"role": "user", "content": build_prompt(diff_text, context)}],
        response_format=ReviewResult,
        temperature=0.1,
    )
    parsed = resp.choices[0].message.parsed or ReviewResult(comments=[])
    return parsed, resp.usage.total_tokens if resp.usage else 0
