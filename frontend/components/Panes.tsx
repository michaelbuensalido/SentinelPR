"use client";

import React, { useState } from "react";
import { AstChunk, Comment, ContextChunk, DiffFile, JobStatus, Review } from "@/lib/demo";

export function Pane({
  title,
  badge,
  icon,
  headerRight,
  children,
}: {
  title: string;
  badge?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bezel-shell flex min-h-[440px] max-h-[680px] min-w-0 max-w-full flex-col overflow-hidden">
      <div className="bezel-core flex flex-1 min-w-0 max-w-full flex-col overflow-hidden">
        {/* Pane Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="shrink-0 text-indigo-400">{icon}</span>}
            <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            {badge && (
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-medium text-slate-400 tabular-nums">
                {badge}
              </span>
            )}
          </div>
        </div>
        {/* Pane Content Stage */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0 max-w-full">{children}</div>
      </div>
    </section>
  );
}

export function Waiting({ text, subtext }: { text: string; subtext?: string }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 py-16 text-center" aria-busy="true">
      <div className="relative mb-4 flex h-9 w-9 items-center justify-center">
        <div className="absolute h-9 w-9 animate-ping rounded-full bg-indigo-500/15" />
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </div>
      <p className="font-mono text-xs font-medium text-slate-200">{text}</p>
      <span className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-slate-500">
        {subtext ?? "Autonomous AST + pgvector pipeline active"}
      </span>
    </div>
  );
}

const CATEGORY_STYLES: Record<string, { badge: string; border: string; glow: string }> = {
  "Breaking Change": {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    border: "border-amber-500/35 bg-amber-500/[0.04]",
    glow: "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.12)]",
  },
  Security: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    border: "border-rose-500/35 bg-rose-500/[0.04]",
    glow: "shadow-[0_4px_20px_-4px_rgba(244,63,94,0.12)]",
  },
  Bug: {
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    border: "border-orange-500/35 bg-orange-500/[0.04]",
    glow: "shadow-[0_4px_20px_-4px_rgba(249,115,22,0.12)]",
  },
  "Architecture Violation": {
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    border: "border-purple-500/35 bg-purple-500/[0.04]",
    glow: "shadow-[0_4px_20px_-4px_rgba(168,85,247,0.12)]",
  },
  Performance: {
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    border: "border-sky-500/35 bg-sky-500/[0.04]",
    glow: "shadow-[0_4px_20px_-4px_rgba(14,165,233,0.12)]",
  },
};

export function DiffPane({
  diff,
  comments,
  status,
  contextFiles = [],
  activeTarget,
  onSelectContextFile,
}: {
  diff: DiffFile[];
  comments: Comment[];
  status: JobStatus;
  contextFiles?: string[];
  activeTarget?: string | null;
  onSelectContextFile?: (filePath: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const complete = status === "COMPLETED";

  if (status === "QUEUED") {
    return (
      <Waiting
        text="Fetching unified diff from GitHub..."
        subtext="Acquiring Redis idempotency lock and parsing modified hunks."
      />
    );
  }

  if (diff.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center py-16 text-center text-slate-500">
        <svg className="mb-2.5 h-6 w-6 stroke-slate-600" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v8m0 0l4-4m-4 4l-4-4" />
        </svg>
        <p className="font-mono text-xs text-slate-400">No diff hunks recorded for this review.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {status === "ANALYZING" && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200 animate-fade-up">
          <span className="font-mono text-[11px]">Cross-referencing AST hunks against retrieved callers…</span>
          <span className="h-2 w-2 animate-ping rounded-full bg-indigo-400" />
        </div>
      )}

      {diff.map((f) => {
        const adds = f.lines.filter((l) => l.type === "add").length;
        const dels = f.lines.filter((l) => l.type === "del").length;
        const fileComments = complete ? comments.filter((c) => c.file_path === f.path).length : 0;
        const isCollapsed = !!collapsed[f.path];

        return (
          <div
            key={f.path}
            className="min-w-0 max-w-full overflow-hidden rounded-xl border border-white/[0.07] bg-[#050609]"
          >
            {/* File Header */}
            <button
              type="button"
              onClick={() => setCollapsed((p) => ({ ...p, [f.path]: !p[f.path] }))}
              className="flex w-full items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.025] px-3.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <svg
                  className={`h-3 w-3 shrink-0 text-slate-500 transition-transform duration-150 ${
                    isCollapsed ? "-rotate-90" : "rotate-0"
                  }`}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2.5 4.5L6 8l3.5-3.5" />
                </svg>
                <span className="truncate font-mono text-xs font-semibold text-slate-200" title={f.path}>
                  {f.path}
                </span>
                {fileComments > 0 && (
                  <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-amber-300 border border-amber-500/30 tabular-nums">
                    {fileComments} {fileComments === 1 ? "issue" : "issues"}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] tabular-nums">
                {adds > 0 && <span className="text-emerald-400">+{adds}</span>}
                {dels > 0 && <span className="text-rose-400">−{dels}</span>}
                <span className="text-slate-600">{f.lines.length}L</span>
              </div>
            </button>

            {/* Unified Diff Lines */}
            {!isCollapsed && (
              <div className="min-w-0 max-w-full divide-y divide-white/[0.02] overflow-x-auto py-1 font-mono text-[11px] leading-[22px]">
                {f.lines.map((l, i) => {
                  const hits = complete ? comments.filter((c) => c.file_path === f.path && c.line === l.n) : [];
                  const isAdd = l.type === "add";
                  const isDel = l.type === "del";
                  const targetKey = `${f.path}:${l.n}`;
                  const isTargeted = activeTarget === targetKey;

                  const lineHighlight = isAdd
                    ? "bg-emerald-500/[0.08] text-emerald-200 border-l-2 border-emerald-400"
                    : isDel
                    ? "bg-rose-500/[0.08] text-rose-200 border-l-2 border-rose-400"
                    : "border-l-2 border-transparent text-slate-400";

                  return (
                    <div key={i} id={`diff-line-${targetKey}`}>
                      <div className={`flex items-baseline px-2 transition-colors ${lineHighlight}`}>
                        <span className="w-9 shrink-0 select-none pr-2.5 text-right text-[10px] text-slate-600 tabular-nums">
                          {l.n ?? ""}
                        </span>
                        <span className="w-4 shrink-0 select-none text-center font-bold text-slate-500">
                          {isAdd ? "+" : isDel ? "−" : " "}
                        </span>
                        <span className="whitespace-pre pr-4">{l.text}</span>
                      </div>

                      {/* Inline High-Confidence Annotation */}
                      {hits.map((c, k) => {
                        const style = CATEGORY_STYLES[c.category] ?? CATEGORY_STYLES["Breaking Change"];
                        const referencedContext = contextFiles.find((cf) => c.body.includes(cf));

                        return (
                          <div
                            key={k}
                            className={`mx-3 my-2.5 rounded-xl border p-3.5 font-sans text-xs leading-relaxed ${style.border} ${style.glow} animate-fade-up ${
                              isTargeted ? "highlight-flash ring-1 ring-indigo-400" : ""
                            }`}
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${style.badge}`}
                                >
                                  <span>⚠</span>
                                  <span>{c.category}</span>
                                </span>
                                <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                                  Line {c.line}
                                </span>
                              </div>
                              <span className="font-mono text-[11px] text-slate-400">
                                Confidence:{" "}
                                <b className="text-white tabular-nums">{(c.confidence_score * 100).toFixed(0)}%</b>
                              </span>
                            </div>

                            <p className="text-slate-200 leading-relaxed">{c.body}</p>

                            {referencedContext && onSelectContextFile && (
                              <div className="mt-2.5 border-t border-white/[0.06] pt-2">
                                <button
                                  type="button"
                                  onClick={() => onSelectContextFile(referencedContext)}
                                  className="pressable inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
                                >
                                  <span>Inspect caller in RAG Context ({referencedContext})</span>
                                  <span>→</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {complete && comments.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 text-xs text-emerald-200 animate-fade-up">
          <svg className="h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
          <span>All checks passed. Zero high-confidence (≥ 80%) cross-file regressions detected.</span>
        </div>
      )}
    </div>
  );
}

export function ContextPane({
  context,
  status,
  highlightedFile,
}: {
  context: ContextChunk[];
  status: JobStatus;
  highlightedFile?: string | null;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (status === "QUEUED" || status === "RETRIEVING_CONTEXT") {
    return (
      <Waiting
        text={
          status === "QUEUED"
            ? "Waiting for diff parser..."
            : "Searching pgvector HNSW index..."
        }
        subtext="Computing 1536-dim cosine similarity against repository AST chunks."
      />
    );
  }

  if (context.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center py-16 text-center text-slate-500">
        <p className="font-mono text-xs text-slate-400">No external codebase context retrieved for this diff.</p>
      </div>
    );
  }

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <div className="min-w-0 max-w-full space-y-3.5">
      {context.map((c, i) => {
        const pct = Math.round(c.similarity * 100);
        const isHighlighted = highlightedFile === c.file_path;
        const staggerClass = i === 0 ? "stagger-1" : i === 1 ? "stagger-2" : "stagger-3";

        return (
          <div
            key={c.file_path + (c.symbol_name ?? "") + i}
            id={`rag-chunk-${c.file_path}`}
            className={`group animate-fade-up ${staggerClass} min-w-0 max-w-full overflow-hidden rounded-xl border bg-[#07090e] transition-[border-color,box-shadow] duration-200 ${
              isHighlighted
                ? "highlight-flash border-cyan-400/60 ring-1 ring-cyan-400/40"
                : "border-white/[0.07] hover:border-white/15"
            }`}
          >
            {/* Context File Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] bg-white/[0.02] px-3.5 py-2">
              <span className="truncate font-mono text-xs font-semibold text-cyan-300" title={c.file_path}>
                {c.file_path}
              </span>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-500/20 tabular-nums">
                  {pct}% match
                </span>
                <button
                  type="button"
                  onClick={() => copyCode(c.raw_code, i)}
                  className="pressable rounded border border-white/5 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:border-white/15 hover:text-white"
                >
                  {copiedIndex === i ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>

            {/* Hairline Similarity Progress Bar */}
            <div className="h-0.5 w-full bg-white/5">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Code Body */}
            <div className="min-w-0 max-w-full p-3">
              {c.symbol_name && (
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                  <span className="text-slate-500">AST Node:</span>
                  <code className="truncate rounded border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 font-semibold text-slate-200">
                    {c.symbol_name}
                  </code>
                </div>
              )}
              <pre className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-white/[0.04] bg-black/60 p-3 font-mono text-[11px] leading-[18px] text-slate-300">
                {c.raw_code}
              </pre>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-[#07090e] p-3.5 transition-colors duration-150 hover:border-white/15">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-xl font-bold tracking-tight text-white tabular-nums">{value}</div>
      {sublabel && <div className="mt-0.5 truncate text-[10px] text-slate-500">{sublabel}</div>}
    </div>
  );
}

export function TelemetryPane({
  review,
  status,
  onSelectViolation,
}: {
  review: Review;
  status: JobStatus;
  onSelectViolation?: (target: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (status !== "COMPLETED" && status !== "FAILED") {
    return (
      <Waiting
        text={
          status === "ANALYZING"
            ? "Synthesizing structured review..."
            : "Awaiting pipeline completion..."
        }
        subtext="Enforcing strict noise cap (max 5 comments, confidence ≥ 0.80)."
      />
    );
  }

  const top = [...review.comments].sort((a, b) => b.confidence_score - a.confidence_score)[0];

  const handleCopySha = () => {
    if (review.commit_sha) {
      navigator.clipboard.writeText(review.commit_sha);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 animate-fade-up">
      {/* 2-Column Bento Telemetry Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Latency"
          value={`${(review.latency_ms / 1000).toFixed(1)}s`}
          sublabel="Target SLA < 15.0s"
        />
        <MetricCard
          label="Tokens"
          value={review.tokens.toLocaleString()}
          sublabel="Diff + RAG prompt"
        />
        <MetricCard
          label="Peak Confidence"
          value={top ? `${(top.confidence_score * 100).toFixed(0)}%` : "100%"}
          sublabel={top ? "Deterministic score" : "Clean verification"}
        />
        <MetricCard
          label="Primary Class"
          value={top?.category ?? "Verified Clean"}
          sublabel="Top finding type"
        />
        <MetricCard
          label="Annotations"
          value={`${review.comments.length} / 5`}
          sublabel="Strict noise cap"
        />
        <MetricCard label="Signal Floor" value="≥ 80%" sublabel="Hallucination filter" />
      </div>

      {/* Target Commit Pill with Copy affordance */}
      {review.commit_sha && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#07090e] px-3.5 py-2.5 text-xs">
          <span className="font-mono text-[11px] text-slate-500">Idempotency SHA:</span>
          <button
            type="button"
            onClick={handleCopySha}
            className="pressable inline-flex items-center gap-2 font-mono text-xs font-semibold text-slate-300 hover:text-white"
            title="Copy commit SHA"
          >
            <span className="tabular-nums">{review.commit_sha.slice(0, 10)}</span>
            <span className="rounded border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 text-[10px] text-indigo-300">
              {copied ? "Copied ✓" : "Copy"}
            </span>
          </button>
        </div>
      )}

      {/* Interactive Detected Violations Breakdown */}
      {review.comments.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <span>Detected Violations ({review.comments.length})</span>
            <span className="font-mono text-[9px] text-slate-600">Click to locate in diff</span>
          </div>
          <ul className="space-y-2">
            {review.comments.map((c, i) => {
              const targetKey = `${c.file_path}:${c.line}`;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSelectViolation?.(targetKey)}
                    className="pressable flex w-full min-w-0 items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#07090e] p-3 text-left text-xs transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/[0.04]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                        <span>{c.category}</span>
                        <span className="text-[10px] text-indigo-400">↗</span>
                      </div>
                      <div
                        className="mt-0.5 truncate font-mono text-[11px] text-slate-500"
                        title={`${c.file_path}:${c.line}`}
                      >
                        {c.file_path}:{c.line}
                      </div>
                    </div>
                    <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300 border border-amber-500/20 tabular-nums">
                      {(c.confidence_score * 100).toFixed(0)}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5 text-xs leading-relaxed text-emerald-300">
          <div className="font-semibold text-emerald-200">Zero Regressions Flagged</div>
          <p className="mt-1 text-[11px] text-emerald-300/80">
            All modified AST symbols were cross-checked against {review.context.length} retrieved caller chunks without
            breaking contracts.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * AST Index Explorer: Allows inspecting the actual Tree-sitter AST chunks
 * indexed in pgvector for the active repository.
 */
export function AstIndexExplorer({
  chunks,
  loading,
  search,
  onSearchChange,
}: {
  chunks: AstChunk[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = chunks.filter(
    (c) =>
      !search.trim() ||
      c.file_path.toLowerCase().includes(search.toLowerCase()) ||
      (c.symbol_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.raw_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bezel-shell min-w-0 max-w-full">
      <div className="bezel-core p-5 min-w-0 max-w-full">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Tree-Sitter AST Vector Index</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Syntactic function, class, and interface nodes embedded with <code className="text-indigo-300">text-embedding-3-small</code> (1536 dims)
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter by symbol, file, or code..."
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500/80 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="
                  absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-500 hover:text-white
                "
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <Waiting text="Loading AST nodes from pgvector..." />
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center font-mono text-xs text-slate-500">
            No AST chunks match &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <div className="grid min-w-0 max-w-full gap-4 lg:grid-cols-2">
            {filtered.map((chk) => (
              <div
                key={chk.id}
                className="flex min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-xl border border-white/[0.07] bg-[#06080d] transition-colors hover:border-white/15"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] bg-white/[0.02] px-3.5 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-cyan-300" title={chk.file_path}>
                        {chk.file_path}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500 tabular-nums">
                        L{chk.start_line}–L{chk.end_line}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(chk.raw_code);
                        setCopiedId(chk.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="pressable shrink-0 rounded border border-white/5 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:text-white"
                    >
                      {copiedId === chk.id ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                  <div className="p-3 min-w-0 max-w-full">
                    <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px]">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="text-slate-500">Symbol:</span>
                        <code className="truncate rounded bg-indigo-500/10 px-1.5 py-0.5 font-semibold text-indigo-300 border border-indigo-500/20">
                          {chk.symbol_name ?? "<anonymous>"}
                        </code>
                      </div>
                      <span className="shrink-0 text-slate-600 tabular-nums" title={`SHA-256: ${chk.content_hash}`}>
                        sha256:{chk.content_hash.slice(0, 8)}
                      </span>
                    </div>
                    <pre className="max-h-44 min-w-0 max-w-full overflow-auto rounded-lg border border-white/[0.03] bg-black/60 p-3 font-mono text-[11px] leading-[18px] text-slate-300">
                      {chk.raw_code}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
