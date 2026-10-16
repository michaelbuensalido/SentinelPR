"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, health, indexRepo, loadLive, resolveHeadSha, startReview } from "@/lib/api";
import { DEMO_REPOS, JobStatus, Repo } from "@/lib/demo";
import { ContextPane, DiffPane, Pane, TelemetryPane } from "@/components/Panes";
import { Stepper, StatusBadge, STEPS } from "@/components/Status";
import { Button, Field, Modal } from "@/components/ui";

type Mode = "demo" | "live";
type Toast = { msg: string; kind: "ok" | "err" } | null;

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export default function Page() {
  const [mode, setMode] = useState<Mode>("demo");
  const [liveRepos, setLiveRepos] = useState<Repo[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [selRepo, setSelRepo] = useState<string | null>(null);
  const [selReview, setSelReview] = useState<string | null>(null);
  const [sim, setSim] = useState<{ id: string; status: JobStatus } | null>(null);
  const [modal, setModal] = useState<"repo" | "review" | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const notify = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("sentinel-mode");
    if (saved === "live" || saved === "demo") setMode(saved);
  }, []);

  const changeMode = (m: Mode) => {
    setMode(m);
    setSelRepo(null);
    setSelReview(null);
    localStorage.setItem("sentinel-mode", m);
  };

  const refresh = useCallback(async () => {
    const ok = await health();
    setOnline(ok);
    if (!ok) return;
    try {
      const repos = await loadLive();
      setLiveRepos(repos);
      setPending((p) => p.filter((n) => !repos.some((r) => r.full_name === n)));
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "live") return;
    refresh();
    const t = setInterval(() => !document.hidden && refresh(), 3000);
    return () => clearInterval(t);
  }, [mode, refresh]);

  const base: Repo[] = mode === "demo" ? DEMO_REPOS : liveRepos;
  const repos: Repo[] =
    mode === "live"
      ? [
          ...base,
          ...pending
            .filter((n) => !base.some((r) => r.full_name === n))
            .map((n) => ({ full_name: n, index_status: "PENDING", total_chunks: 0, reviews: [] })),
        ]
      : base;

  const repo = repos.find((r) => r.full_name === selRepo) ?? repos[0];
  const review = repo?.reviews.find((v) => v.id === selReview) ?? repo?.reviews[0];
  const status: JobStatus = review ? (sim?.id === review.id ? sim.status : review.status) : "QUEUED";
  const complete = status === "COMPLETED";

  function simulate() {
    if (!review) return;
    timers.current.forEach(clearTimeout);
    STEPS.forEach((s, i) =>
      timers.current.push(
        setTimeout(() => setSim(s.key === "COMPLETED" ? null : { id: review.id, status: s.key }), i * 1300)
      )
    );
  }
  const simulating = sim !== null;

  async function reindex(name: string) {
    try {
      await indexRepo(name);
      notify(`AST indexing queued for ${name}`);
      setTimeout(refresh, 800);
    } catch (e) {
      notify((e as Error).message, "err");
    }
  }

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-[#06070a] text-slate-100">
      {/* ─── Floating Apple-Style Header Bar ─── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#06070a]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1560px] min-w-0 items-center justify-between px-6 py-3.5">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-[0_0_16px_rgba(99,102,241,0.2)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white">SentinelPR</h1>
                <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.2 font-mono text-[9px] font-semibold uppercase tracking-widest text-indigo-300">
                  AST · RAG
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Autonomous Codebase-Aware Reviewer</p>
            </div>
          </div>

          {/* Right Controls: Engine Status & Segmented Switcher */}
          <div className="flex items-center gap-4">
            {mode === "live" && (
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-medium transition-colors ${
                  online
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : online === false
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    online ? "bg-emerald-400" : online === false ? "bg-rose-400" : "bg-slate-400 animate-pulse"
                  }`}
                />
                <span>{online ? "Engine Ready" : online === false ? "Engine Offline" : "Connecting..."}</span>
              </div>
            )}

            {/* Segmented Mode Switcher */}
            <div
              className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs"
              role="tablist"
              aria-label="Execution mode selection"
            >
              <button
                role="tab"
                aria-selected={mode === "demo"}
                onClick={() => changeMode("demo")}
                className={`pressable rounded-lg px-3.5 py-1.5 font-medium transition-all ${
                  mode === "demo"
                    ? "bg-indigo-600 text-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Replay Sandbox
              </button>
              <button
                role="tab"
                aria-selected={mode === "live"}
                onClick={() => changeMode("live")}
                className={`pressable rounded-lg px-3.5 py-1.5 font-medium transition-all ${
                  mode === "live"
                    ? "bg-indigo-600 text-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Live Production
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Workspace Layout ─── */}
      <div className="mx-auto grid w-full max-w-[1560px] min-w-0 flex-1 gap-6 p-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* ─── Left Sidebar: Repositories ─── */}
        <aside className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Repositories</h2>
            {mode === "live" && (
              <Button size="sm" variant="secondary" onClick={() => setModal("repo")}>
                + Connect
              </Button>
            )}
          </div>

          <div className="space-y-2.5">
            {repos.length === 0 && (
              <div className="bezel-shell p-4 text-center">
                <div className="bezel-core p-4 text-xs text-slate-500">No repositories registered.</div>
              </div>
            )}

            {repos.map((r) => {
              const active = r.full_name === repo?.full_name;
              return (
                <button
                  key={r.full_name}
                  onClick={() => {
                    setSelRepo(r.full_name);
                    setSelReview(null);
                  }}
                  className={`pressable block w-full rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? "border-indigo-500/50 bg-[#0e111a] shadow-[0_8px_24px_-4px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30"
                      : "border-white/[0.06] bg-[#090b10] hover:border-white/15 hover:bg-[#0d0f17]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs font-semibold text-slate-200" title={r.full_name}>
                      {r.full_name}
                    </span>
                    <StatusBadge status={r.index_status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                    <span>{r.total_chunks} chunks</span>
                    <span>
                      {r.reviews.length} {r.reviews.length === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {mode === "demo" && (
            <div className="bezel-shell">
              <div className="bezel-core p-3.5 text-xs leading-relaxed text-slate-400">
                <span className="font-semibold text-slate-200">Replay Mode:</span> Pre-loaded repositories with
                demonstrated breaking changes. Click <b className="text-white">Simulate Webhook</b> to test the RAG
                pipeline.
              </div>
            </div>
          )}
        </aside>

        {/* ─── Center Main Stage ─── */}
        <main className="min-w-0 space-y-6">
          {mode === "live" && online === false ? (
            <OfflineState />
          ) : !repo ? (
            <OnboardingState onAdd={() => setModal("repo")} />
          ) : (
            <>
              {/* Repository Header Card (Double-Bezel) */}
              <div className="bezel-shell">
                <div className="bezel-core flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="truncate font-mono text-lg font-bold tracking-tight text-white">{repo.full_name}</h2>
                      <StatusBadge status={repo.index_status} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 font-mono text-xs text-slate-400">
                      <span>
                        <b className="text-slate-200 tabular-nums">{repo.total_chunks}</b> AST nodes indexed
                      </span>
                      <span className="text-slate-600">•</span>
                      <span>pgvector HNSW Cosine Index</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {mode === "demo" ? (
                      <Button
                        onClick={simulate}
                        disabled={simulating || !review}
                        icon={
                          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 1l8 5-8 5V1z" fill="currentColor" />
                          </svg>
                        }
                      >
                        {simulating ? "Simulating Webhook..." : "Simulate Webhook"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => reindex(repo.full_name)}
                          disabled={repo.index_status === "INDEXING"}
                        >
                          {repo.index_status === "FAILED" ? "Retry Indexing" : "Re-index AST"}
                        </Button>
                        <Button
                          onClick={() => setModal("review")}
                          disabled={repo.index_status !== "READY"}
                          icon={
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 1v10M1 6h10" />
                            </svg>
                          }
                        >
                          Run PR Review
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Indexing status alerts */}
              {repo.index_status === "FAILED" && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-4 text-xs leading-relaxed text-rose-200">
                  <b className="font-semibold text-rose-100">Indexing Alert:</b> AST embedding failed. Check that your
                  OpenAI API key has active billing credits or verify GITHUB_TOKEN if this is a private repository. Click{" "}
                  <b className="text-white">Retry Indexing</b> to re-run.
                </div>
              )}

              {(repo.index_status === "INDEXING" || repo.index_status === "PENDING") && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 text-xs leading-relaxed text-amber-200 animate-pulse">
                  <b className="font-semibold text-amber-100">Indexing in progress:</b> Parsing Tree-sitter syntactic
                  trees, computing content hashes, generating 1536-dim embeddings, and building the HNSW index.
                </div>
              )}

              {/* PR Selector Pills */}
              {repo.reviews.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Pull Requests:
                  </span>
                  {repo.reviews.map((v) => {
                    const active = v.id === review?.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelReview(v.id)}
                        className={`pressable flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "border-indigo-500/60 bg-indigo-500/15 text-white shadow-[0_0_12px_rgba(99,102,241,0.18)]"
                            : "border-white/[0.06] bg-[#090b10] text-slate-400 hover:border-white/15 hover:text-white"
                        }`}
                      >
                        <span className="font-bold text-slate-200">#{v.pr_number}</span>
                        <span className="max-w-[200px] truncate">{v.title}</span>
                        <StatusBadge status={v.status} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Review Inspector Workspace */}
              {review ? (
                <div className="space-y-6">
                  {/* Stepper Card */}
                  <div className="bezel-shell">
                    <div className="bezel-core p-4">
                      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            PR #{review.pr_number}
                          </span>
                          <h3 className="text-sm font-semibold text-slate-200">{review.title}</h3>
                        </div>
                        {review.commit_sha && (
                          <code className="rounded bg-black/40 px-2.5 py-1 font-mono text-[11px] text-slate-400 border border-white/[0.05] tabular-nums">
                            SHA: {review.commit_sha.slice(0, 8)}
                          </code>
                        )}
                      </div>
                      <Stepper status={status} />
                    </div>
                  </div>

                  {/* 3-Pane Review Inspector (Bento Layout) */}
                  <div className="grid min-w-0 max-w-full gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                    <Pane
                      title="PR Git Diff"
                      badge="Inline AI Annotations"
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 3h5v5M4 20L21 3m0 13v5h-5M9 9l-5 5" />
                        </svg>
                      }
                    >
                      <DiffPane diff={review.diff} comments={review.comments} complete={complete} />
                    </Pane>

                    <Pane
                      title="RAG Brain Context"
                      badge="pgvector HNSW Match"
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.5-6.5l-2.1 2.1m-8.8 8.8l-2.1 2.1m0-13l2.1 2.1m8.8 8.8l2.1 2.1" />
                        </svg>
                      }
                    >
                      <ContextPane context={review.context} />
                    </Pane>

                    <Pane
                      title="Telemetry & KPIs"
                      badge="Deterministic Metrics"
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 3v18h18M18 9l-5 5-4-4-3 3" />
                        </svg>
                      }
                    >
                      <TelemetryPane review={review} />
                    </Pane>
                  </div>
                </div>
              ) : (
                repo.index_status === "READY" && (
                  <div className="bezel-shell">
                    <div className="bezel-core flex flex-col items-center justify-center p-14 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold text-white">No Pull Request Reviews Yet</h3>
                      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                        Codebase indexing complete. Open a Pull Request on GitHub or trigger a manual review to
                        cross-examine code changes against this repository.
                      </p>
                      {mode === "live" && (
                        <Button className="mt-5" onClick={() => setModal("review")}>
                          Run First Review
                        </Button>
                      )}
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </main>
      </div>

      {/* ─── Modals (Double-Bezel Architecture) ─── */}
      {modal === "repo" && (
        <AddRepoModal
          onClose={() => setModal(null)}
          onDone={(name) => {
            setPending((p) => [...p, name]);
            setSelRepo(name);
            notify(`Indexing queued for ${name}`);
            setTimeout(refresh, 1000);
          }}
          onError={(m) => notify(m, "err")}
        />
      )}

      {modal === "review" && repo && (
        <ReviewModal
          repo={repo.full_name}
          onClose={() => setModal(null)}
          onDone={() => {
            notify("Review queued — pipeline initiated");
            setSelReview(null);
            setTimeout(refresh, 800);
          }}
          onError={(m) => notify(m, "err")}
        />
      )}

      {/* ─── Sonner-Inspired Toast Notification ─── */}
      {toast && (
        <div
          role="status"
          className={`animate-toast-slide fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl backdrop-blur-md ${
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-[#0e1713]/90 text-emerald-200"
              : "border-rose-500/30 bg-[#170e10]/90 text-rose-200"
          }`}
        >
          <span>{toast.kind === "ok" ? "✓" : "⚠"}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

function OfflineState() {
  return (
    <div className="bezel-shell max-w-xl mx-auto my-12">
      <div className="bezel-core p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-white">FastAPI Engine Offline</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          The dashboard cannot establish a connection to <code className="text-indigo-300 font-mono">{API_URL}</code>.
        </p>
        <div className="mt-5 rounded-xl border border-white/5 bg-black/50 p-4 text-left font-mono text-xs text-slate-300">
          <p className="text-slate-500 mb-2"># Quick launch resolution:</p>
          <p>1. Ensure Docker Desktop is active</p>
          <p>2. Execute: <span className="text-emerald-400">docker compose up</span></p>
          <p>3. Verify: <span className="text-emerald-400">curl {API_URL}/health</span></p>
        </div>
      </div>
    </div>
  );
}

function OnboardingState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bezel-shell max-w-xl mx-auto my-12">
      <div className="bezel-core flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-white tracking-tight">Index Your First Repository</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          SentinelPR builds syntax-aware AST embeddings across your entire repository. When a PR arrives, it
          cross-references changed functions with callers in other files to catch breaking changes before production.
        </p>
        <Button className="mt-6" onClick={onAdd}>
          + Connect GitHub Repository
        </Button>
      </div>
    </div>
  );
}

function AddRepoModal({
  onClose,
  onDone,
  onError,
}: {
  onClose: () => void;
  onDone: (name: string) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = REPO_RE.test(name.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await indexRepo(name.trim());
      onDone(name.trim());
      onClose();
    } catch (err) {
      onError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Register Repository for Indexing" onClose={onClose}>
      <form onSubmit={submit}>
        <Field
          label="Repository Path (owner/repo)"
          placeholder="e.g. facebook/react or your-username/repo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          hint="Target repository will be shallow-cloned, parsed into AST nodes, and embedded into pgvector."
        />
        <div className="mt-6 flex justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || busy}>
            {busy ? "Queuing Pipeline…" : "Start AST Indexer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewModal({
  repo,
  onClose,
  onDone,
  onError,
}: {
  repo: string;
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [pr, setPr] = useState("");
  const [sha, setSha] = useState("");
  const [busy, setBusy] = useState(false);
  const prNum = parseInt(pr, 10);
  const valid = prNum > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const commit = sha.trim() || (await resolveHeadSha(repo, prNum));
      const res = await startReview(repo, prNum, commit);
      if (res.status === "duplicate") onError("This commit SHA has already been reviewed (Idempotency lock active).");
      else onDone();
      onClose();
    } catch (err) {
      onError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Initiate PR Review • ${repo}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field
          label="Pull Request Number"
          type="number"
          min={1}
          placeholder="e.g. 42"
          value={pr}
          onChange={(e) => setPr(e.target.value)}
          autoFocus
        />
        <Field
          label="Target Commit SHA (Optional)"
          placeholder="Leave blank for auto-resolution from GitHub"
          value={sha}
          onChange={(e) => setSha(e.target.value)}
          hint="If omitted, SentinelPR queries the GitHub API to detect the PR's latest head SHA."
        />
        <div className="mt-6 flex justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || busy}>
            {busy ? "Dispatching…" : "Dispatch Review Pipeline"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
