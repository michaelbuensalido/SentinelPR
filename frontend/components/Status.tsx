"use client";

import { JobStatus } from "@/lib/demo";

export const STEPS: { key: JobStatus; label: string; sub: string }[] = [
  { key: "QUEUED", label: "Queued", sub: "Idempotency lock acquired" },
  { key: "RETRIEVING_CONTEXT", label: "Retrieving Context", sub: "pgvector HNSW cosine search" },
  { key: "ANALYZING", label: "Analyzing Diff", sub: "Cross-file AST verification" },
  { key: "COMPLETED", label: "Review Completed", sub: "Filtered ≥ 80% confidence" },
];

export function Stepper({ status }: { status: JobStatus }) {
  const failed = status === "FAILED";
  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <nav aria-label="Review Pipeline Progress" className="w-full min-w-0">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const isDone = !failed && (i < currentIndex || status === "COMPLETED");
          const isActive = !failed && i === currentIndex && status !== "COMPLETED";

          return (
            <li
              key={s.key}
              className={`relative flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-[background-color,border-color,color,box-shadow] duration-200 ${
                isDone
                  ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200 shadow-[inset_0_1px_0_rgba(16,185,129,0.12)]"
                  : isActive
                  ? "border-indigo-500/50 bg-indigo-500/[0.12] text-white shadow-[0_0_20px_-4px_rgba(99,102,241,0.3)]"
                  : "border-white/[0.05] bg-white/[0.015] text-slate-500"
              }`}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/40 font-mono text-[10px]">
                {isDone ? (
                  <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M2.5 6L5 8.5L9.5 3.5" />
                  </svg>
                ) : isActive ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                  </span>
                ) : (
                  <span className="text-slate-600 tabular-nums">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold tracking-tight">{s.label}</div>
                <div className="truncate font-mono text-[10px] text-slate-500">{s.sub}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {failed && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300">
          <svg className="h-3.5 w-3.5 shrink-0 text-rose-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l6 6M9 3L3 9" />
          </svg>
          <span>Pipeline execution halted during worker stage. You can re-run this review at any time.</span>
        </div>
      )}
    </nav>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; border: string; dot: string; pulse?: boolean }> = {
    READY: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      border: "border-emerald-500/25",
      dot: "bg-emerald-400",
    },
    COMPLETED: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      border: "border-emerald-500/25",
      dot: "bg-emerald-400",
    },
    INDEXING: {
      bg: "bg-amber-500/10",
      text: "text-amber-300",
      border: "border-amber-500/25",
      dot: "bg-amber-400",
      pulse: true,
    },
    PENDING: {
      bg: "bg-slate-500/10",
      text: "text-slate-300",
      border: "border-slate-500/25",
      dot: "bg-slate-400",
      pulse: true,
    },
    QUEUED: {
      bg: "bg-slate-500/10",
      text: "text-slate-400",
      border: "border-slate-500/20",
      dot: "bg-slate-500",
    },
    RETRIEVING_CONTEXT: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-300",
      border: "border-indigo-500/25",
      dot: "bg-indigo-400",
      pulse: true,
    },
    ANALYZING: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-300",
      border: "border-indigo-500/25",
      dot: "bg-indigo-400",
      pulse: true,
    },
    FAILED: {
      bg: "bg-rose-500/10",
      text: "text-rose-300",
      border: "border-rose-500/25",
      dot: "bg-rose-400",
    },
  };

  const c = configs[status] ?? configs.QUEUED;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium tracking-tight ${c.bg} ${c.text} ${c.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${c.pulse ? "animate-pulse" : ""}`} />
      <span>{status.replace(/_/g, " ")}</span>
    </span>
  );
}
