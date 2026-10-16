"use client";

import React, { useState } from "react";
import { Comment, ContextChunk, DiffFile, Review } from "@/lib/demo";

export function Pane({
  title,
  badge,
  icon,
  children,
}: {
  title: string;
  badge?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bezel-shell flex min-h-[420px] min-w-0 max-w-full flex-col overflow-hidden">
      <div className="bezel-core flex flex-1 min-w-0 max-w-full flex-col overflow-hidden">
        {/* Pane Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-slate-400">{icon}</span>}
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">{title}</h2>
          </div>
          {badge && (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
              {badge}
            </span>
          )}
        </div>
        {/* Pane Content Stage */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0 max-w-full">{children}</div>
      </div>
    </div>
  );
}

export function Waiting({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-20 text-center" aria-busy="true">
      <div className="relative mb-5 flex h-9 w-9 items-center justify-center">
        <div className="absolute h-9 w-9 animate-ping rounded-full bg-indigo-500/15" />
        <div className="h-5 w-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
      <p className="font-mono text-xs font-medium text-slate-300">{text}</p>
      <span className="mt-1.5 text-[11px] text-slate-500">Autonomous RAG synthesis in progress</span>
    </div>
  );
}

const CATEGORY_STYLES: Record<string, { badge: string; border: string; glow: string }> = {
  "Breaking Change": {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    border: "border-amber-500/30 bg-amber-500/[0.03]",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.06)]",
  },
  Security: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    border: "border-rose-500/30 bg-rose-500/[0.03]",
    glow: "shadow-[0_0_24px_rgba(244,63,94,0.06)]",
  },
  Bug: {
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    border: "border-orange-500/30 bg-orange-500/[0.03]",
    glow: "shadow-[0_0_24px_rgba(249,115,22,0.06)]",
  },
  "Architecture Violation": {
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    border: "border-purple-500/30 bg-purple-500/[0.03]",
    glow: "shadow-[0_0_24px_rgba(168,85,247,0.06)]",
  },
  Performance: {
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    border: "border-sky-500/30 bg-sky-500/[0.03]",
    glow: "shadow-[0_0_24px_rgba(14,165,233,0.06)]",
  },
};

export function DiffPane({
  diff,
  comments,
  complete,
}: {
  diff: DiffFile[];
  comments: Comment[];
  complete: boolean;
}) {
  if (diff.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16 text-center text-slate-500">
        <svg className="mb-2 h-6 w-6 stroke-slate-600" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v8m0 0l4-4m-4 4l-4-4" />
        </svg>
        <p className="font-mono text-xs">No diff content recorded for this commit.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {diff.map((f) => (
        <div key={f.path} className="min-w-0 max-w-full overflow-hidden rounded-xl border border-white/[0.07] bg-[#050609]">
          {/* File Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.025] px-3.5 py-2">
            <span className="truncate font-mono text-xs font-semibold text-slate-200" title={f.path}>
              {f.path}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-slate-500 tabular-nums">{f.lines.length} lines</span>
          </div>

          {/* Unified Diff Lines */}
          <div className="min-w-0 max-w-full divide-y divide-white/[0.02] overflow-x-auto py-1 font-mono text-[11px] leading-[22px]">
            {f.lines.map((l, i) => {
              const hits = complete ? comments.filter((c) => c.file_path === f.path && c.line === l.n) : [];
              const isAdd = l.type === "add";
              const isDel = l.type === "del";

              const lineHighlight = isAdd
                ? "bg-emerald-500/[0.08] text-emerald-200 border-l-2 border-emerald-400"
                : isDel
                ? "bg-rose-500/[0.08] text-rose-200 border-l-2 border-rose-400"
                : "border-l-2 border-transparent text-slate-400";

              return (
                <div key={i}>
                  <div className={`flex items-baseline px-2 transition-colors ${lineHighlight}`}>
                    <span className="w-10 shrink-0 select-none pr-3 text-right text-[10px] text-slate-600 tabular-nums">
                      {l.n ?? ""}
                    </span>
                    <span className="w-4 shrink-0 select-none text-center font-bold text-slate-500">
                      {isAdd ? "+" : isDel ? "−" : " "}
                    </span>
                    <span className="whitespace-pre">{l.text}</span>
                  </div>

                  {/* Inline High-Confidence Annotation */}
                  {hits.map((c, k) => {
                    const style = CATEGORY_STYLES[c.category] ?? CATEGORY_STYLES["Breaking Change"];
                    return (
                      <div
                        key={k}
                        className={`mx-3 my-2.5 rounded-xl border p-3.5 font-sans text-xs leading-relaxed ${style.border} ${style.glow} animate-fade-up`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${style.badge}`}
                          >
                            <span>⚠</span>
                            <span>{c.category}</span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            Confidence: <b className="text-white tabular-nums">{(c.confidence_score * 100).toFixed(0)}%</b>
                          </span>
                        </div>
                        <p className="text-slate-200">{c.body}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {complete && comments.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3.5 text-xs text-emerald-300">
          <svg className="h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
          <span>All checks passed. No high-confidence architectural breaking changes detected.</span>
        </div>
      )}
    </div>
  );
}

export function ContextPane({ context }: { context: ContextChunk[] }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (context.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16 text-center text-slate-500">
        <p className="font-mono text-xs">No external codebase context was retrieved for this diff.</p>
      </div>
    );
  }

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-w-0 max-w-full space-y-3.5">
      {context.map((c, i) => {
        const pct = Math.round(c.similarity * 100);
        return (
          <div
            key={c.file_path + (c.symbol_name ?? "") + i}
            className="group min-w-0 max-w-full overflow-hidden rounded-xl border border-white/[0.07] bg-[#07090e] transition-colors hover:border-white/15"
          >
            {/* Context File Bar */}
            <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.02] px-3.5 py-2">
              <span className="truncate font-mono text-xs font-semibold text-cyan-300" title={c.file_path}>
                {c.file_path}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-[11px] font-bold text-emerald-300 tabular-nums">{pct}% match</span>
                <button
                  onClick={() => copyCode(c.raw_code, i)}
                  className="pressable rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
                >
                  {copiedIndex === i ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Hairline Similarity Progress Bar */}
            <div className="h-0.5 w-full bg-white/5">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Code Body */}
            <div className="min-w-0 max-w-full p-3">
              {c.symbol_name && (
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                  <span className="text-slate-600">AST symbol:</span>
                  <code className="truncate rounded bg-white/5 px-1.5 py-0.5 font-semibold text-slate-300">
                    {c.symbol_name}
                  </code>
                </div>
              )}
              <pre className="min-w-0 max-w-full overflow-x-auto rounded-lg bg-black/60 p-3 font-mono text-[11px] leading-[18px] text-slate-300 border border-white/[0.03]">
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
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-[#07090e] p-3.5 transition-colors hover:border-white/15">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
      <div className="truncate mt-1 font-mono text-xl font-bold tracking-tight text-white tabular-nums">{value}</div>
      {sublabel && <div className="truncate mt-0.5 text-[10px] text-slate-500">{sublabel}</div>}
    </div>
  );
}

export function TelemetryPane({ review }: { review: Review }) {
  const [copied, setCopied] = useState(false);
  const top = [...review.comments].sort((a, b) => b.confidence_score - a.confidence_score)[0];

  const handleCopySha = () => {
    if (review.commit_sha) {
      navigator.clipboard.writeText(review.commit_sha);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {/* 2-Column Bento Telemetry Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Latency" value={`${(review.latency_ms / 1000).toFixed(1)}s`} sublabel="End-to-end execution" />
        <MetricCard label="Tokens" value={review.tokens.toLocaleString()} sublabel="Diff + RAG context" />
        <MetricCard
          label="Top Confidence"
          value={top ? `${(top.confidence_score * 100).toFixed(0)}%` : "–"}
          sublabel="Deterministic score"
        />
        <MetricCard
          label="Category"
          value={top?.category ?? "Clean"}
          sublabel="Classification"
        />
        <MetricCard
          label="Comments"
          value={`${review.comments.length} / 5`}
          sublabel="Strict noise cap"
        />
        <MetricCard label="Quality Floor" value="≥ 80%" sublabel="Rejection threshold" />
      </div>

      {/* Target Commit Pill with Copy affordance */}
      {review.commit_sha && (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#07090e] px-3.5 py-2.5 text-xs">
          <span className="font-mono text-[11px] text-slate-500">Target Commit:</span>
          <button
            onClick={handleCopySha}
            className="pressable inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-300 hover:text-white"
            title="Click to copy SHA"
          >
            <span>{review.commit_sha.slice(0, 10)}</span>
            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300 border border-indigo-500/30">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        </div>
      )}

      {/* Detected Violations Breakdown */}
      {review.comments.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Detected Violations ({review.comments.length})
          </div>
          <ul className="space-y-2">
            {review.comments.map((c, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#07090e] p-3 text-xs min-w-0"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-200">{c.category}</div>
                  <div className="truncate mt-0.5 font-mono text-[11px] text-slate-500" title={`${c.file_path}:${c.line}`}>
                    {c.file_path}:{c.line}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[11px] font-bold text-amber-300 tabular-nums">
                  {(c.confidence_score * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
