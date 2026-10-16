"""AST indexer: shallow clone -> tree-sitter extraction -> embeddings -> pgvector (FR-2)."""
import asyncio
import hashlib
import logging
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

import tree_sitter_python as tspython
import tree_sitter_typescript as tsts
from tree_sitter import Language, Parser

from .db import get_pool, vec_literal
from .embeddings import embed_texts

log = logging.getLogger(__name__)

LANGS = {
    ".py": Language(tspython.language()),
    ".ts": Language(tsts.language_typescript()),
    ".tsx": Language(tsts.language_tsx()),
}
NODE_TYPES = {
    "function_definition", "class_definition",  # python
    "function_declaration", "class_declaration", "interface_declaration",
    "type_alias_declaration", "method_definition", "enum_declaration",  # ts
}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "__pycache__", ".venv", ".next"}
MAX_CHUNK_CHARS = 6000


@dataclass
class Chunk:
    file_path: str
    symbol_name: str | None
    start_line: int
    end_line: int
    raw_code: str

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.raw_code.encode()).hexdigest()


def extract_chunks(source: bytes, ext: str, rel_path: str) -> list[Chunk]:
    parser = Parser(LANGS[ext])
    tree = parser.parse(source)
    chunks: list[Chunk] = []

    def walk(node):
        if node.type in NODE_TYPES:
            name_node = node.child_by_field_name("name")
            name = name_node.text.decode() if name_node else None
            chunks.append(Chunk(rel_path, name, node.start_point[0] + 1, node.end_point[0] + 1,
                                node.text.decode(errors="replace")[:MAX_CHUNK_CHARS]))
        for c in node.children:
            walk(c)

    walk(tree.root_node)
    return chunks


def collect_chunks(root: Path) -> list[Chunk]:
    out: list[Chunk] = []
    for p in root.rglob("*"):
        if p.suffix not in LANGS or not p.is_file() or SKIP_DIRS & set(p.parts):
            continue
        try:
            out.extend(extract_chunks(p.read_bytes(), p.suffix, str(p.relative_to(root))))
        except Exception as e:  # noqa: BLE001
            log.warning("parse failed %s: %s", p, e)
    return out


async def _clone(full_name: str, dest: str, token: str = "") -> None:
    auth = f"{token}@" if token else ""
    url = f"https://{auth}github.com/{full_name}.git"
    proc = await asyncio.create_subprocess_exec(
        "git", "clone", "--depth", "1", url, dest,
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
    _, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"git clone failed: {err.decode()[:300].replace(token, '***') if token else err.decode()[:300]}")


async def index_repo(full_name: str, token: str = "") -> int:
    pool = await get_pool()
    repo_id = await pool.fetchval(
        """INSERT INTO repositories (full_name, index_status) VALUES ($1,'INDEXING')
           ON CONFLICT (full_name) DO UPDATE SET index_status='INDEXING' RETURNING id""", full_name)
    workdir = tempfile.mkdtemp(prefix="sentinel-")  # zero code retention: wiped in finally
    try:
        await _clone(full_name, workdir + "/repo", token)
        chunks = collect_chunks(Path(workdir) / "repo")
    except Exception:
        await pool.execute("UPDATE repositories SET index_status='FAILED' WHERE id=$1", repo_id)
        raise
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    try:
        # content-hash caching: only embed chunks we haven't stored
        existing = {(r["file_path"], r["content_hash"]) for r in
                    await pool.fetch("SELECT file_path, content_hash FROM code_chunks WHERE repo_id=$1", repo_id)}
        new = [c for c in chunks if (c.file_path, c.content_hash) not in existing]
        # drop stale chunks
        keep = {(c.file_path, c.content_hash) for c in chunks}
        stale = [k for k in existing if k not in keep]
        for fp, h in stale:
            await pool.execute("DELETE FROM code_chunks WHERE repo_id=$1 AND file_path=$2 AND content_hash=$3", repo_id, fp, h)

        for i in range(0, len(new), 64):
            batch = new[i:i + 64]
            vecs = await embed_texts([f"{c.file_path}\n{c.raw_code}" for c in batch])
            await pool.executemany(
                """INSERT INTO code_chunks (repo_id,file_path,symbol_name,start_line,end_line,content_hash,raw_code,embedding)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector) ON CONFLICT DO NOTHING""",
                [(repo_id, c.file_path, c.symbol_name, c.start_line, c.end_line, c.content_hash, c.raw_code, vec_literal(v))
                 for c, v in zip(batch, vecs)])
    except Exception:
        # e.g. OpenAI quota/rate-limit errors: don't leave the repo stuck on INDEXING
        await pool.execute("UPDATE repositories SET index_status='FAILED' WHERE id=$1", repo_id)
        raise
    total = await pool.fetchval("SELECT count(*) FROM code_chunks WHERE repo_id=$1", repo_id)
    await pool.execute("UPDATE repositories SET index_status='READY', total_chunks=$2 WHERE id=$1", repo_id, total)
    return total
