"""Context retrieval: cosine similarity + symbol-name matching (FR-3.3)."""
import re

from .config import settings
from .db import get_pool, vec_literal
from .diff_parser import FileDiff
from .embeddings import embed_texts

IDENT_RE = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]{3,}\b")


def candidate_symbols(files: list[FileDiff], limit: int = 40) -> list[str]:
    seen: dict[str, None] = {}
    for f in files:
        for text in f.added.values():
            for tok in IDENT_RE.findall(text):
                seen.setdefault(tok)
    return list(seen)[:limit]


async def retrieve_context(repo_id, files: list[FileDiff], k: int | None = None) -> list[dict]:
    k = k or settings.top_k_context
    if not files:
        return []
    changed = {f.path for f in files}
    query = "\n".join(f"{f.path}\n" + "\n".join(f.added[n] for n in f.lines) for f in files)
    [vec] = await embed_texts([query])
    syms = candidate_symbols(files)
    pool = await get_pool()
    # symbol-name match gives a small boost on top of cosine similarity
    rows = await pool.fetch(
        """SELECT file_path, symbol_name, start_line, end_line, raw_code,
                  1 - (embedding <=> $2::vector) AS similarity,
                  (symbol_name = ANY($4::text[])) AS symbol_match
           FROM code_chunks
           WHERE repo_id=$1 AND NOT (file_path = ANY($3::text[]))
           ORDER BY (embedding <=> $2::vector) - (CASE WHEN symbol_name = ANY($4::text[]) THEN 0.1 ELSE 0 END)
           LIMIT $5""",
        repo_id, vec_literal(vec), list(changed), syms, k)
    return [dict(r) for r in rows]
