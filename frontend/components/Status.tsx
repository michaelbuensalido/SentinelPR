"use client";

import { JobStatus } from "@/lib/demo";

export const STEPS: { key: JobStatus; label: string }[] = [
  { key: "QUEUED", label: "Queued" },
  { key: "RETRIEVING_CONTEXT", label: "Retrieving Context" },
  { key: "ANALYZING", label: "Analyzing Diff" },
  { key: "COMPLETED", label: "Review Completed" },
];

export function Stepper({ status }: { status: JobStatus }) {
  const failed = status === "FAILED";
  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <nav aria-label="Review Progress" className="w-full">
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => {
          const isDone = !failed && (i < currentIndex || status === "COMPLETED");
          const isActive = !failed && i === currentIndex && status !== "COMPLETED";

          return (
            <li key={s.key} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-tight transition-all duration-200 ${
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[inset_0_1px_1px_rgba(16,185,129,0.1)]"
                    : isActive
                    ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-100 shadow-[0_0_16px_rgba(99,102,241,0.25)]"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-500"
                }`}
              >
                {isDone ? (
                  <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2.5 6L5 8.5L9.5 3.5" />
                  </svg>
                ) : isActive ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                )}
                <span>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-[1px] w-5 transition-colors duration-200 ${
                    isDone ? "bg-emerald-500/40" : "bg-white/10"
                  }`}
                />
              )}
            </li>
          );
        })}

        {failed && (
          <li className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-300">
              <svg className="h-3 w-3 text-rose-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l6 6M9 3L3 9" />
              </svg>
              Execution Halted
            </span>
          </li>
        )}
      </ol>
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-tight ${c.bg} ${c.text} ${c.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${c.pulse ? "animate-pulse" : ""}`} />
      <span>{status.replace(/_/g, " ")}</span>
    </span>
  );
}
