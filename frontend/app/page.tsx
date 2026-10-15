"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_REPOS, JobStatus, Repo, Review } from "@/lib/demo";

const STEPS: JobStatus[] = ["QUEUED", "RETRIEVING_CONTEXT", "ANALYZING", "COMPLETED"];
const STEP_LABEL: Record<JobStatus, string> = {
  QUEUED: "QUEUED",
  RETRIEVING_CONTEXT: "RETRIEVING CONTEXT",
  ANALYZING: "ANALYZING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};
const API = process.env.NEXT_PUBLIC_API_URL;

export default function Page() {
  const [repos, setRepos] = useState<Repo[]>(DEMO_REPOS);
  const [live, setLive] = useState(false);
  const [repoIdx, setRepoIdx] = useState(0);
  const [status, setStatus] = useState<JobStatus>("COMPLETED");
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Live mode: if an API is configured and has repos, show them (polled); else sandbox/replay mode.
  useEffect(() => {
    if (!API) return;
    const load = async () => {
      try {
        const rs: { full_name: string; index_status: string; total_chunks: number }[] =
          await (await fetch(`${API}/api/v1/repos`)).json();
        if (!rs.length) return;
        const out: Repo[] = await Promise.all(
          rs.map(async (r) => {
            const revs = await (await fetch(`${API}/api/v1/reviews?repo=${encodeURIComponent(r.full_name)}`)).json();
            return {
              ...r,
              reviews: revs.map((v: any): Review => ({
                id: v.id,
                pr_number: v.pr_number,
                title: `PR #${v.pr_number}`,
                status: v.status,
                latency_ms: v.latency_ms ?? 0,
                tokens: v.tokens ?? 0,
                diff: [],
                comments: v.result?.comments ?? [],
                context: v.result?.context ?? [],
              })),
            };
          })
        );
        setRepos(out);
        setLive(true);
      } catch {}
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const repo = repos[Math.min(repoIdx, repos.length - 1)];
  const review = repo?.reviews?.[0];
  const shown = live ? review?.status ?? "QUEUED" : status;

  function simulate() {
    timers.current.forEach(clearTimeout);
    setRunning(true);
    STEPS.forEach((s, i) => {
      timers.current.push(
        setTimeout(() => {
          setStatus(s);
          if (s === "COMPLETED") setRunning(false);
        }, i * 1400)
      );
    });
  }

  const done = shown === "COMPLETED" && review;

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">SentinelPR</h1>
          <p className="text-sm text-slate-400">
            Codebase-aware autonomous PR reviewer · {live ? "Live" : "Public sandbox (replay mode)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="glass px-3 py-2 text-sm bg-transparent"
            value={repoIdx}
            onChange={(e) => setRepoIdx(+e.target.value)}
          >
            {repos.map((r, i) => (
              <option key={r.full_name} value={i} className="bg-slate-900">
                {r.full_name}
              </option>
            ))}
          </select>
          {!live && (
            <button
              onClick={simulate}
              disabled={running}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400 disabled:opacity-50"
            >
              {running ? "Running…" : "Simulate Webhook"}
            </button>
          )}
        </div>
      </header>

      {repo && (
        <section className="glass p-4 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-400">Index status</span>{" "}
            <b className="text-emerald-400">{repo.index_status}</b>
          </div>
          <div>
            <span className="text-slate-400">Code chunks</span> <b>{repo.total_chunks}</b>
          </div>
          <div>
            <span className="text-slate-400">PR</span> <b>{review ? `#${review.pr_number} ${review.title}` : "none yet"}</b>
          </div>
        </section>
      )}

      <section className="glass p-4 flex items-center gap-2 text-xs flex-wrap">
        {STEPS.map((s, i) => {
          const active = STEPS.indexOf(shown) >= i;
          return (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 border ${
                  active ? "bg-indigo-500/30 border-indigo-400 text-indigo-100" : "border-white/10 text-slate-500"
                }`}
              >
                {STEP_LABEL[s]}
              </span>
              {i < STEPS.length - 1 && <span className="text-slate-600">→</span>}
            </div>
          );
        })}
      </section>

      {!review ? (
        <div className="glass p-8 text-center text-slate-400">No reviews yet for this repository.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: diff */}
          <Pane title="PR Diff">
            {review.diff.length === 0 && <p className="text-slate-500 text-sm">Diff not stored in live mode.</p>}
            {review.diff.map((f) => (
              <div key={f.path} className="mb-4">
                <div className="text-xs text-slate-400 mb-1">{f.path}</div>
                <pre className="text-xs font-mono overflow-x-auto">
                  {f.lines.map((l, i) => {
                    const c = done ? review.comments.find((c) => c.file_path === f.path && c.line === l.n) : undefined;
                    return (
                      <div key={i}>
                        <div
                          className={
                            l.type === "add"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : l.type === "del"
                              ? "bg-rose-500/15 text-rose-200"
                              : "text-slate-400"
                          }
                        >
                          {l.type === "add" ? "+" : l.type === "del" ? "-" : " "} {l.text}
                        </div>
                        {c && (
                          <div className="my-1 rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 font-sans text-amber-100 whitespace-normal">
                            ⚠ <b>{c.category}</b>: {c.body}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </pre>
              </div>
            ))}
          </Pane>

          {/* Middle: RAG brain */}
          <Pane title="RAG Brain · retrieved context">
            {!done && <p className="text-slate-500 text-sm">Waiting for retrieval…</p>}
            {done &&
              review.context.map((c) => (
                <div key={c.file_path + (c.symbol_name ?? "")} className="mb-3 rounded-lg border border-white/10 p-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-cyan-300">{c.file_path}</span>
                    <span className="text-emerald-300">{c.similarity.toFixed(2)} match</span>
                  </div>
                  <pre className="text-xs font-mono text-slate-300 overflow-x-auto">{c.raw_code}</pre>
                </div>
              ))}
          </Pane>

          {/* Right: telemetry */}
          <Pane title="Telemetry">
            {done ? (
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Latency" value={`${(review.latency_ms / 1000).toFixed(1)}s`} />
                <Metric label="Tokens" value={review.tokens.toLocaleString()} />
                <Metric
                  label="Confidence"
                  value={review.comments[0] ? review.comments[0].confidence_score.toFixed(2) : "–"}
                />
                <Metric label="Category" value={review.comments[0]?.category ?? "–"} />
                <Metric label="Comments posted" value={`${review.comments.length} / 5`} />
                <Metric label="Threshold" value="≥ 0.80" />
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Metrics appear when the job completes.</p>
            )}
          </Pane>
        </div>
      )}
    </main>
  );
}

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass p-4 min-h-[320px]">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">{title}</h2>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
