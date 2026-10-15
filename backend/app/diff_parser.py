"""Unified diff parser mapping added lines to new-file line numbers (FR-3.2)."""
import re
from dataclasses import dataclass, field

HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


@dataclass
class FileDiff:
    path: str
    added: dict[int, str] = field(default_factory=dict)  # new line no -> text

    @property
    def lines(self) -> list[int]:
        return sorted(self.added)


def parse_diff(diff: str) -> list[FileDiff]:
    files: list[FileDiff] = []
    current: FileDiff | None = None
    new_line = 0
    in_hunk = False
    for raw in diff.splitlines():
        if raw.startswith("diff --git"):
            current, in_hunk = None, False
        elif raw.startswith("+++ ") and not in_hunk:
            path = raw[4:].strip()
            if path == "/dev/null":
                current = None
                continue
            if path.startswith("b/"):
                path = path[2:]
            current = FileDiff(path)
            files.append(current)
        elif raw.startswith("@@"):
            m = HUNK_RE.match(raw)
            if m and current is not None:
                new_line = int(m.group(1))
                in_hunk = True
        elif in_hunk and current is not None:
            if raw.startswith("+"):
                current.added[new_line] = raw[1:]
                new_line += 1
            elif raw.startswith("-") or raw.startswith("\\"):
                continue
            else:  # context line
                new_line += 1
    return files


def format_for_prompt(files: list[FileDiff]) -> str:
    out = []
    for f in files:
        out.append(f"### {f.path}")
        for n in f.lines:
            out.append(f"{n}: {f.added[n]}")
    return "\n".join(out)
