"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  API_URL,
  deleteRepo,
  fetchOpenGitHubPRs,
  fetchRepoChunks,
  GitHubPullBrief,
  health,
  indexRepo,
  loadLive,
  resolveHeadSha,
  startReview,
} from "@/lib/api";
import { AstChunk, DEMO_REPOS, JobStatus, Repo } from "@/lib/demo";
import { AstIndexExplorer, ContextPane, DiffPane, Pane, TelemetryPane } from "@/components/Panes";
import { Stepper, StatusBadge, STEPS } from "@/components/Status";
import { Button, Field, HoldToDeleteButton, Kbd, Modal } from "@/components/ui";

type Mode = "demo" | "live";
type WorkspaceTab = "inspector" | "chunks";
type MobilePane = "all" | "diff" | "context" | "telemetry";
type ModalKind = "repo" | "review" | "webhook" | "command" | null;
type Toast = { msg: string; kind: "ok" | "err" } | null;

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export default function Page() {
  const [mode, setMode] = useState<Mode>("demo");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("inspector");
  const [mobilePane, setMobilePane] = useState<MobilePane>("all");
  const [liveRepos, setLiveRepos] = useState<Repo[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [selRepo, setSelRepo] = useState<string | null>(null);
  const [selReview, setSelReview] = useState<string | null>(null);
  const [sim, setSim] = useState<{ id: string; status: JobStatus } | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState<Toast>(null);

  // Cross-pane interactive highlight states
  const [activeDiffTarget, setActiveDiffTarget] = useState<string | null>(null);
  const [highlightedContextFile, setHighlightedContextFile] = useState<string | null>(null);

  // AST Chunks explorer state
  const [liveChunks, setLiveChunks] = useState<AstChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunkSearch, setChunkSearch] = useState("");

  // Open GitHub PRs discovery for empty state
  const [openPRs, setOpenPRs] = useState<GitHubPullBrief[]>([]);
  const [loadingOpenPRs, setLoadingOpenPRs] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("sentinel-mode");
    if (saved === "live" || saved === "demo") setMode(saved);
  }, []);

  const changeMode = useCallback((m: Mode) => {
    setMode(m);
    setSelRepo(null);
    setSelReview(null);
    setWorkspaceTab("inspector");
    localStorage.setItem("sentinel-mode", m);
  }, []);

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

  // Load AST chunks when switching to "chunks" tab in live mode
  useEffect(() => {
    if (!repo || workspaceTab !== "chunks") return;
    if (mode === "demo") {
      setLiveChunks(repo.chunks ?? []);
      return;
    }
    let cancelled = false;
    setChunksLoading(true);
    fetchRepoChunks(repo.full_name)
      .then((res) => {
        if (!cancelled) setLiveChunks(res);
      })
      .catch(() => {
        if (!cancelled) setLiveChunks([]);
      })
      .finally(() => {
        if (!cancelled) setChunksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, workspaceTab, mode]);

  // Discover open GitHub PRs when viewing a READY live repo with 0 reviews
  useEffect(() => {
    if (mode !== "live" || !repo || repo.index_status !== "READY" || repo.reviews.length > 0) {
      setOpenPRs([]);
      return;
    }
    let cancelled = false;
    setLoadingOpenPRs(true);
    fetchOpenGitHubPRs(repo.full_name)
      .then((prs) => {
        if (!cancelled) setOpenPRs(prs);
      })
      .finally(() => {
        if (!cancelled) setLoadingOpenPRs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, repo]);

  const simulate = useCallback(() => {
    if (!review) return;
    setWorkspaceTab("inspector");
    timers.current.forEach(clearTimeout);
    timers.current = [];
    STEPS.forEach((s, i) =>
      timers.current.push(
        setTimeout(() => setSim(s.key === "COMPLETED" ? null : { id: review.id, status: s.key }), i * 1150)
      )
    );
  }, [review]);

  const simulating = sim !== null;

  // Global keyboard shortcuts (⌘K Command Menu, R to replay in demo)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal((m) => (m === "command" ? null : "command"));
        return;
      }
      if (isInput || modal) return;

      if (e.key.toLowerCase() === "r" && mode === "demo" && !simulating) {
        e.preventDefault();
        simulate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, mode, simulating, simulate]);

  async function reindex(name: string) {
    try {
      await indexRepo(name);
      notify(`AST indexing queued for ${name}`);
      setTimeout(refresh, 800);
    } catch (e) {
      notify((e as Error).message, "err");
    }
  }

  async function handleRemoveRepo(name: string) {
    try {
      await deleteRepo(name);
      setPending((p) => p.filter((n) => n !== name));
      if (selRepo === name) setSelRepo(null);
      notify(`Removed ${name}`);
      refresh();
    } catch (e) {
      notify((e as Error).message, "err");
    }
  }

  async function handleQuickReview(prNum: number, sha?: string, force = false) {
    if (!repo) return;
    try {
      const commit = sha || (await resolveHeadSha(repo.full_name, prNum));
      const res = await startReview(repo.full_name, prNum, commit, force);
      if (res.status === "duplicate") {
        notify("Commit SHA already reviewed. Click Re-run to force a fresh pass.", "err");
      } else {
        notify(`Dispatched review for PR #${prNum}`);
        setTimeout(refresh, 700);
      }
    } catch (e) {
      notify((e as Error).message, "err");
    }
  }

  const handleSelectViolation = (targetKey: string) => {
    setActiveDiffTarget(targetKey);
    if (mobilePane !== "all") setMobilePane("diff");
    setTimeout(() => {
      document.getElementById(`diff-line-${targetKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    setTimeout(() => setActiveDiffTarget(null), 1500);
  };

  const handleSelectContextFile = (filePath: string) => {
    setHighlightedContextFile(filePath);
    if (mobilePane !== "all") setMobilePane("context");
    setTimeout(() => {
      document.getElementById(`rag-chunk-${filePath}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    setTimeout(() => setHighlightedContextFile(null), 1500);
  };

  return (
    <div className="bg-noise flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-[#06070a] text-slate-100">
      {/* ─── Skip to Content for Keyboard Accessibility ─── */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-white"
      >
        Skip to workspace
      </a>

      {/* ─── Floating Translucent Header Bar ─── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#06070a]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1560px] min-w-0 flex-wrap items-center justify-between gap-3 px-6 py-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.22)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white">SentinelPR</h1>
                <span className="rounded border border-indigo-400/30 bg-indigo-400/10 px-1.5 py-0.2 font-mono text-[9px] font-semibold uppercase tracking-widest text-indigo-300">
                  AST · pgvector
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Codebase-Aware Autonomous PR Reviewer</p>
            </div>
          </div>

          {/* Right Controls: Command Trigger, Webhook Guide, Engine Status & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Instant Command Bar Trigger (⌘K) */}
            <button
              type="button"
              onClick={() => setModal("command")}
              className="pressable hidden items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-xs text-slate-400 hover:border-white/15 hover:text-slate-200 sm:inline-flex"
              title="Open Command Palette (⌘K)"
            >
              <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span>Quick Jump…</span>
              <Kbd>⌘K</Kbd>
            </button>

            <button
              type="button"
              onClick={() => setModal("webhook")}
              className="pressable hidden items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-mono text-[11px] text-slate-400 hover:border-white/15 hover:text-white md:inline-flex"
            >
              <span>Webhook Guide</span>
            </button>

            {mode === "live" && (
              <div
                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                  online
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : online === false
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    online ? "bg-emerald-400" : online === false ? "bg-rose-400" : "animate-pulse bg-slate-400"
                  }`}
                />
                <span>{online ? "Engine Ready" : online === false ? "Engine Offline" : "Checking…"}</span>
              </div>
            )}

            {/* Segmented Mode Switcher */}
            <div
              className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs"
              role="tablist"
              aria-label="Execution mode selection"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "demo"}
                onClick={() => changeMode("demo")}
                className={`pressable rounded-lg px-3 py-1.5 font-medium transition-[background-color,color,box-shadow] duration-150 ${
                  mode === "demo"
                    ? "bg-indigo-600 text-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Replay Sandbox
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "live"}
                onClick={() => changeMode("live")}
                className={`pressable rounded-lg px-3 py-1.5 font-medium transition-[background-color,color,box-shadow] duration-150 ${
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
      <div
        id="main-workspace"
        className="mx-auto grid w-full max-w-[1560px] min-w-0 flex-1 gap-6 p-6 lg:grid-cols-[290px_minmax(0,1fr)]"
      >
        {/* ─── Left Sidebar: Repositories ─── */}
        <aside className="min-w-0 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Repositories ({repos.length})
            </h2>
            {mode === "live" && (
              <Button size="sm" variant="secondary" onClick={() => setModal("repo")}>
                + Connect
              </Button>
            )}
          </div>

          <div className="space-y-2.5">
            {repos.length === 0 && (
              <div className="bezel-shell">
                <div className="bezel-core p-5 text-center text-xs text-slate-500">
                  No repositories registered yet.
                </div>
              </div>
            )}

            {repos.map((r) => {
              const active = r.full_name === repo?.full_name;
              const violationCount = r.reviews.reduce((acc, rev) => acc + rev.comments.length, 0);

              return (
                <button
                  type="button"
                  key={r.full_name}
                  onClick={() => {
                    setSelRepo(r.full_name);
                    setSelReview(null);
                  }}
                  className={`pressable block w-full min-w-0 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 ${
                    active
                      ? "border-indigo-500/50 bg-[#0e111a] shadow-[0_8px_24px_-4px_rgba(99,102,241,0.16)] ring-1 ring-indigo-500/30"
                      : "border-white/[0.06] bg-[#090b10] hover:border-white/15 hover:bg-[#0d0f17]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs font-semibold text-slate-100" title={r.full_name}>
                      {r.full_name}
                    </span>
                    <StatusBadge status={r.index_status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                    <span>{r.total_chunks} AST nodes</span>
                    <div className="flex items-center gap-2">
                      <span>
                        {r.reviews.length} {r.reviews.length === 1 ? "PR" : "PRs"}
                      </span>
                      {violationCount > 0 && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
                          {violationCount}⚠
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {mode === "demo" ? (
            <div className="bezel-shell">
              <div className="bezel-core space-y-2 p-3.5 text-xs leading-relaxed text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Interactive Replay Sandbox</span>
                  <Kbd>R</Kbd>
                </div>
                <p>
                  Explore real cross-file AST &amp; pgvector reviews. Press <b className="text-white">Simulate Webhook</b>{" "}
                  (or <code className="text-indigo-300">R</code>) to watch the 4-stage pipeline execute live.
                </p>
              </div>
            </div>
          ) : (
            <div className="bezel-shell">
              <div className="bezel-core space-y-2 p-3.5 text-xs leading-relaxed text-slate-400">
                <div className="font-semibold text-slate-200">Zero Code Retention</div>
                <p>
                  Repositories are shallow-cloned into an ephemeral directory, parsed via Tree-sitter, and wiped via{" "}
                  <code className="text-slate-300">shutil.rmtree</code> immediately after embedding.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* ─── Center Main Stage ─── */}
        <main className="min-w-0 max-w-full space-y-6">
          {mode === "live" && online === false ? (
            <OfflineState onSwitchDemo={() => changeMode("demo")} />
          ) : !repo ? (
            <OnboardingState onAdd={() => setModal("repo")} onSwitchDemo={() => changeMode("demo")} />
          ) : (
            <>
              {/* Repository Header Card (Double-Bezel) */}
              <div className="bezel-shell min-w-0 max-w-full">
                <div className="bezel-core flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="truncate font-mono text-lg font-bold tracking-tight text-white">
                        {repo.full_name}
                      </h2>
                      <StatusBadge status={repo.index_status} />
                      <a
                        href={`https://github.com/${repo.full_name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="pressable inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:border-white/20 hover:text-white"
                      >
                        <span>GitHub</span>
                        <span>↗</span>
                      </a>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-xs text-slate-400">
                      <span>
                        <b className="text-slate-200 tabular-nums">{repo.total_chunks}</b> AST nodes indexed
                      </span>
                      <span className="text-slate-600">•</span>
                      <span>pgvector HNSW Cosine Index</span>
                    </div>
                  </div>

                  {/* Primary Action Bar */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Workspace View Switcher: PR Inspector vs AST Knowledge Index */}
                    <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setWorkspaceTab("inspector")}
                        className={`pressable rounded-lg px-3 py-1 font-medium transition-colors ${
                          workspaceTab === "inspector"
                            ? "bg-white/10 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        PR Reviews ({repo.reviews.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkspaceTab("chunks")}
                        className={`pressable rounded-lg px-3 py-1 font-medium transition-colors ${
                          workspaceTab === "chunks"
                            ? "bg-white/10 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        AST Index ({mode === "demo" ? (repo.chunks?.length ?? 0) : repo.total_chunks})
                      </button>
                    </div>

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
                        {simulating ? "Simulating Pipeline…" : "Simulate Webhook"}
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
                        <HoldToDeleteButton onConfirm={() => handleRemoveRepo(repo.full_name)} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Indexing Status Alerts */}
              {repo.index_status === "FAILED" && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/[0.05] p-4 text-xs leading-relaxed text-rose-200">
                  <div className="max-w-2xl">
                    <b className="font-semibold text-rose-100">Indexing Halted:</b> AST embedding could not complete.
                    Verify that your <code className="text-rose-100">OPENAI_API_KEY</code> has active billing quota and
                    that the repository name is a valid public GitHub repository (or <code className="text-rose-100">GITHUB_TOKEN</code> is configured).
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => reindex(repo.full_name)}>
                      Retry Indexing
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => changeMode("demo")}>
                      Open Replay Sandbox
                    </Button>
                  </div>
                </div>
              )}

              {(repo.index_status === "INDEXING" || repo.index_status === "PENDING") && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4 text-xs leading-relaxed text-amber-200">
                  <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  <div>
                    <b className="font-semibold text-amber-100">AST Indexing Active:</b> Shallow-cloning repository,
                    walking Tree-sitter syntax trees (`.py`, `.ts`, `.tsx`), computing SHA-256 content hashes, and
                    generating 1536-dim pgvector embeddings.
                  </div>
                </div>
              )}

              {workspaceTab === "chunks" ? (
                <AstIndexExplorer
                  chunks={liveChunks}
                  loading={chunksLoading}
                  search={chunkSearch}
                  onSearchChange={setChunkSearch}
                />
              ) : (
                <>
                  {/* PR Selector Pills */}
                  {repo.reviews.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Pull Requests:
                        </span>
                        {repo.reviews.map((v) => {
                          const active = v.id === review?.id;
                          return (
                            <button
                              type="button"
                              key={v.id}
                              onClick={() => setSelReview(v.id)}
                              className={`pressable flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-[border-color,background-color,color,box-shadow] duration-150 ${
                                active
                                  ? "border-indigo-500/60 bg-indigo-500/15 text-white shadow-[0_0_12px_rgba(99,102,241,0.18)]"
                                  : "border-white/[0.06] bg-[#090b10] text-slate-400 hover:border-white/15 hover:text-white"
                              }`}
                            >
                              <span className="font-mono font-bold text-indigo-300">#{v.pr_number}</span>
                              <span className="max-w-[220px] truncate">{v.title}</span>
                              <StatusBadge status={v.status} />
                            </button>
                          );
                        })}
                      </div>

                      {/* Responsive Mobile/Tablet Pane Switcher */}
                      <div className="flex rounded-xl border border-white/10 bg-[#090b10] p-1 text-[11px] xl:hidden">
                        {(
                          [
                            { key: "all", label: "All Panes" },
                            { key: "diff", label: "Git Diff" },
                            { key: "context", label: `RAG (${review?.context.length ?? 0})` },
                            { key: "telemetry", label: "Telemetry" },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setMobilePane(tab.key)}
                            className={`pressable rounded-lg px-2.5 py-1 font-medium transition-colors ${
                              mobilePane === tab.key ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review Inspector Workspace */}
                  {review ? (
                    <div className="space-y-6 min-w-0 max-w-full">
                      {/* Stepper Card */}
                      <div className="bezel-shell min-w-0 max-w-full">
                        <div className="bezel-core p-4 min-w-0 max-w-full">
                          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                              <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300 tabular-nums">
                                PR #{review.pr_number}
                              </span>
                              <h3 className="truncate text-sm font-semibold text-slate-100">{review.title}</h3>
                              {review.branch && (
                                <code className="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                                  {review.branch}
                                </code>
                              )}
                              {review.created_at && (
                                <span className="font-mono text-[11px] text-slate-500">{review.created_at}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {review.commit_sha && (
                                <code className="rounded border border-white/[0.05] bg-black/40 px-2.5 py-1 font-mono text-[11px] text-slate-400 tabular-nums">
                                  SHA: {review.commit_sha.slice(0, 8)}
                                </code>
                              )}
                              {mode === "live" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleQuickReview(review.pr_number, review.commit_sha, true)}
                                >
                                  ↻ Re-run Review
                                </Button>
                              )}
                            </div>
                          </div>
                          <Stepper status={status} />
                        </div>
                      </div>

                      {/* 3-Pane Review Inspector (Bento Layout) */}
                      <div className="grid min-w-0 max-w-full gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                        <div className={`${mobilePane === "all" || mobilePane === "diff" ? "block" : "hidden xl:block"} min-w-0 max-w-full`}>
                          <Pane
                            title="PR Git Diff"
                            badge={
                              status === "COMPLETED"
                                ? `${review.comments.length} ${review.comments.length === 1 ? "annotation" : "annotations"}`
                                : "Scanning"
                            }
                            icon={
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 3h5v5M4 20L21 3m0 13v5h-5M9 9l-5 5" />
                              </svg>
                            }
                          >
                            <DiffPane
                              diff={review.diff}
                              comments={review.comments}
                              status={status}
                              contextFiles={review.context.map((c) => c.file_path)}
                              activeTarget={activeDiffTarget}
                              onSelectContextFile={handleSelectContextFile}
                            />
                          </Pane>
                        </div>

                        <div className={`${mobilePane === "all" || mobilePane === "context" ? "block" : "hidden xl:block"} min-w-0 max-w-full`}>
                          <Pane
                            title="RAG Brain Context"
                            badge={`${review.context.length} AST callers`}
                            icon={
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.5-6.5l-2.1 2.1m-8.8 8.8l-2.1 2.1m0-13l2.1 2.1m8.8 8.8l2.1 2.1" />
                              </svg>
                            }
                          >
                            <ContextPane
                              context={review.context}
                              status={status}
                              highlightedFile={highlightedContextFile}
                            />
                          </Pane>
                        </div>

                        <div className={`${mobilePane === "all" || mobilePane === "telemetry" ? "block" : "hidden xl:block"} min-w-0 max-w-full`}>
                          <Pane
                            title="Telemetry & KPIs"
                            badge="Deterministic Metrics"
                            icon={
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 3v18h18M18 9l-5 5-4-4-3 3" />
                              </svg>
                            }
                          >
                            <TelemetryPane
                              review={review}
                              status={status}
                              onSelectViolation={handleSelectViolation}
                            />
                          </Pane>
                        </div>
                      </div>
                    </div>
                  ) : (
                    repo.index_status === "READY" && (
                      <div className="bezel-shell min-w-0 max-w-full">
                        <div className="bezel-core flex flex-col items-center justify-center p-10 text-center">
                          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                          <h3 className="text-sm font-semibold text-white">
                            AST Index Ready ({repo.total_chunks} Code Chunks Embedded)
                          </h3>
                          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                            No PR reviews have been executed for <code className="text-slate-200">{repo.full_name}</code>{" "}
                            yet. Select an open GitHub Pull Request below or trigger a manual review by PR number.
                          </p>

                          {/* Auto-discovered Open GitHub Pull Requests */}
                          {mode === "live" && (
                            <div className="mt-6 w-full max-w-lg text-left">
                              {loadingOpenPRs ? (
                                <div className="py-4 text-center font-mono text-xs text-slate-500">
                                  Checking GitHub for open Pull Requests…
                                </div>
                              ) : openPRs.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Open Pull Requests on GitHub ({openPRs.length})
                                  </div>
                                  {openPRs.map((pr) => (
                                    <div
                                      key={pr.number}
                                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/40 p-3 text-xs"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-indigo-300">#{pr.number}</span>
                                          <span className="truncate font-medium text-slate-200">{pr.title}</span>
                                        </div>
                                        <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                                          {pr.branch} • {pr.sha.slice(0, 8)}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() => handleQuickReview(pr.number, pr.sha)}
                                      >
                                        Review PR
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            {mode === "live" && (
                              <Button onClick={() => setModal("review")}>+ Run PR Review by Number</Button>
                            )}
                            <Button variant="secondary" onClick={() => setWorkspaceTab("chunks")}>
                              Explore {repo.total_chunks} Indexed AST Nodes →
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </>
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

      {modal === "webhook" && <WebhookGuideModal repo={repo?.full_name} onClose={() => setModal(null)} />}

      {modal === "command" && (
        <CommandPaletteModal
          repos={repos}
          mode={mode}
          onClose={() => setModal(null)}
          onSelectRepo={(name) => {
            setSelRepo(name);
            setSelReview(null);
            setModal(null);
          }}
          onSelectReview={(repoName, revId) => {
            setSelRepo(repoName);
            setSelReview(revId);
            setWorkspaceTab("inspector");
            setModal(null);
          }}
          onTriggerAction={(act) => {
            setModal(null);
            if (act === "simulate") simulate();
            if (act === "toggle-mode") changeMode(mode === "demo" ? "live" : "demo");
            if (act === "add-repo") {
              changeMode("live");
              setModal("repo");
            }
            if (act === "webhook") setModal("webhook");
            if (act === "chunks") setWorkspaceTab("chunks");
          }}
        />
      )}

      {/* ─── Sonner-Inspired Toast Notification ─── */}
      {toast && (
        <div
          role="status"
          className={`animate-toast-slide fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl backdrop-blur-md ${
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-[#0e1713]/95 text-emerald-200"
              : "border-rose-500/30 bg-[#170e10]/95 text-rose-200"
          }`}
        >
          <span>{toast.kind === "ok" ? "✓" : "⚠"}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

function OfflineState({ onSwitchDemo }: { onSwitchDemo: () => void }) {
  return (
    <div className="bezel-shell mx-auto my-8 max-w-xl">
      <div className="bezel-core p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-white">FastAPI Engine Offline</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Could not reach the backend service at <code className="font-mono text-indigo-300">{API_URL}</code>. Start the
          local Docker stack or switch to the interactive Replay Sandbox.
        </p>
        <div className="mt-5 rounded-xl border border-white/5 bg-black/50 p-4 text-left font-mono text-xs text-slate-300">
          <p className="mb-2 text-slate-500"># Launch local backend stack:</p>
          <p>
            1. Run <span className="text-emerald-400">docker compose up</span>
          </p>
          <p>
            2. Verify health at <span className="text-emerald-400">{API_URL}/health</span>
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={onSwitchDemo}>
            Explore Replay Sandbox Instead →
          </Button>
        </div>
      </div>
    </div>
  );
}

function OnboardingState({ onAdd, onSwitchDemo }: { onAdd: () => void; onSwitchDemo: () => void }) {
  return (
    <div className="bezel-shell mx-auto my-8 max-w-xl">
      <div className="bezel-core flex flex-col items-center justify-center p-10 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h2 className="text-base font-bold tracking-tight text-white">Index Your First Repository</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          SentinelPR parses Python and TypeScript AST nodes using Tree-sitter and stores 1536-dim embeddings in
          pgvector. When a Pull Request opens, it retrieves cross-file callers to catch breaking changes.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onAdd}>+ Connect GitHub Repository</Button>
          <Button variant="secondary" onClick={onSwitchDemo}>
            Preview Replay Sandbox
          </Button>
        </div>
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
  const trimmed = name.trim();
  const valid = REPO_RE.test(trimmed);
  const showError = trimmed.length > 0 && !valid ? "Use owner/repository format (e.g. tiangolo/fastapi)" : undefined;

  const PRESETS = ["mbuensalido/Gripped", "tiangolo/fastapi", "pallets/flask"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await indexRepo(trimmed);
      onDone(trimmed);
      onClose();
    } catch (err) {
      onError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Connect GitHub Repository"
      subtitle="Shallow-clones default branch, extracts Tree-sitter AST nodes, and builds HNSW vector index."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field
          label="Repository Path (owner/repo)"
          placeholder="e.g. mbuensalido/Gripped"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={showError}
          autoFocus
          hint="Supports Python (.py) and TypeScript (.ts, .tsx) repositories."
        />

        <div className="mb-5">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Quick Fill Examples
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setName(p)}
                className="pressable rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:border-indigo-500/40 hover:text-white"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || busy}>
            {busy ? "Queuing AST Indexer…" : "Start AST Indexer"}
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
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openPRs, setOpenPRs] = useState<GitHubPullBrief[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(true);

  const prNum = parseInt(pr, 10);
  const valid = prNum > 0;

  useEffect(() => {
    let cancelled = false;
    setLoadingPRs(true);
    fetchOpenGitHubPRs(repo)
      .then((list) => {
        if (!cancelled) setOpenPRs(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingPRs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const commit = sha.trim() || (await resolveHeadSha(repo, prNum));
      const res = await startReview(repo, prNum, commit, force);
      if (res.status === "duplicate") {
        onError("Commit SHA already reviewed. Enable 'Force fresh review' to bypass the idempotency lock.");
        setBusy(false);
        return;
      }
      onDone();
      onClose();
    } catch (err) {
      onError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Initiate PR Review • ${repo}`}
      subtitle="Fetches unified GitHub diff, queries pgvector for top-5 AST callers, and posts inline findings."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {loadingPRs ? (
          <div className="mb-4 rounded-xl border border-white/5 bg-black/40 p-3 text-center font-mono text-[11px] text-slate-500">
            Scanning GitHub for open PRs…
          </div>
        ) : openPRs.length > 0 ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Select Open Pull Request on GitHub
            </label>
            <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
              {openPRs.map((item) => {
                const selected = String(item.number) === pr;
                return (
                  <button
                    key={item.number}
                    type="button"
                    onClick={() => {
                      setPr(String(item.number));
                      setSha(item.sha);
                    }}
                    className={`pressable flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs ${
                      selected
                        ? "border-indigo-500/60 bg-indigo-500/15 text-white"
                        : "border-white/[0.06] bg-black/40 text-slate-300 hover:border-white/15"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-indigo-300">#{item.number}</span>{" "}
                      <span className="truncate">{item.title}</span>
                    </div>
                    <code className="shrink-0 font-mono text-[10px] text-slate-500">{item.sha.slice(0, 7)}</code>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <Field
          label="Pull Request Number"
          type="number"
          min={1}
          placeholder="e.g. 1"
          value={pr}
          onChange={(e) => setPr(e.target.value)}
          autoFocus
        />
        <Field
          label="Target Commit SHA (Optional)"
          placeholder="Auto-resolved from GitHub PR head if blank"
          value={sha}
          onChange={(e) => setSha(e.target.value)}
          hint="Used as the Redis idempotency lock key (review_lock:{repo_id}:{sha})."
        />

        <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-xs text-slate-300 select-none">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-black text-indigo-600 focus:ring-indigo-500"
          />
          <span>Force fresh review (reset 1h Redis idempotency lock if already reviewed)</span>
        </label>

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

function WebhookGuideModal({ repo, onClose }: { repo?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const targetRepo = repo || "mbuensalido/Gripped";
  const curlCmd = `curl -X POST ${API_URL}/api/v1/repos/index \\
  -H "Content-Type: application/json" \\
  -d '{"full_name": "${targetRepo}"}'`;

  return (
    <Modal
      title="GitHub Webhook & API Integration"
      subtitle="SentinelPR processes real-time GitHub events with HMAC-SHA256 verification (< 100ms response)."
      maxWidth="max-w-lg"
      onClose={onClose}
    >
      <div className="space-y-4 text-xs text-slate-300">
        <div className="rounded-xl border border-white/[0.07] bg-black/50 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Payload URL</span>
            <code className="font-mono text-indigo-300">{API_URL}/api/v1/webhooks/github</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Content Type</span>
            <code className="font-mono text-slate-200">application/json</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Subscribed Events</span>
            <code className="font-mono text-emerald-300">pull_request, push</code>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              CLI Quick Test (Trigger Indexer)
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(curlCmd);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="pressable rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:text-white"
            >
              {copied ? "Copied ✓" : "Copy cURL"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/70 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
            {curlCmd}
          </pre>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Instant Command Palette (⌘K):
 * Opens with 0ms animation (`instant={true}`) per Emil Kowalski's rule:
 * "Never animate keyboard-initiated actions."
 */
function CommandPaletteModal({
  repos,
  mode,
  onClose,
  onSelectRepo,
  onSelectReview,
  onTriggerAction,
}: {
  repos: Repo[];
  mode: Mode;
  onClose: () => void;
  onSelectRepo: (name: string) => void;
  onSelectReview: (repoName: string, revId: string) => void;
  onTriggerAction: (act: "simulate" | "toggle-mode" | "add-repo" | "webhook" | "chunks") => void;
}) {
  const [q, setQ] = useState("");
  const query = q.toLowerCase().trim();

  const matchedRepos = repos.filter((r) => !query || r.full_name.toLowerCase().includes(query));
  const allReviews = repos.flatMap((r) =>
    r.reviews.map((rev) => ({ repoName: r.full_name, review: rev }))
  );
  const matchedReviews = allReviews.filter(
    ({ repoName, review }) =>
      !query ||
      repoName.toLowerCase().includes(query) ||
      review.title.toLowerCase().includes(query) ||
      `#${review.pr_number}`.includes(query)
  );

  return (
    <Modal
      title="Command Palette"
      subtitle="Instant keyboard navigation across repositories, PRs, and pipeline actions."
      instant={true}
      maxWidth="max-w-lg"
      onClose={onClose}
    >
      <div className="space-y-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a repository, PR #, or command..."
          autoFocus
          className="w-full rounded-xl border border-indigo-500/50 bg-black/60 px-3.5 py-2.5 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none"
        />

        <div className="max-h-72 space-y-4 overflow-y-auto pr-1 text-xs">
          {/* Quick Actions */}
          <div>
            <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Pipeline Actions
            </div>
            <div className="space-y-1">
              {mode === "demo" && (
                <button
                  type="button"
                  onClick={() => onTriggerAction("simulate")}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white"
                >
                  <span>▶ Simulate Webhook Pipeline Execution</span>
                  <Kbd>R</Kbd>
                </button>
              )}
              <button
                type="button"
                onClick={() => onTriggerAction("chunks")}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white"
              >
                <span>◈ Inspect Tree-Sitter AST Vector Chunks</span>
                <span className="font-mono text-[10px] text-slate-500">View</span>
              </button>
              <button
                type="button"
                onClick={() => onTriggerAction("toggle-mode")}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white"
              >
                <span>⇄ Switch to {mode === "demo" ? "Live Production" : "Replay Sandbox"} Mode</span>
                <span className="font-mono text-[10px] text-slate-500">Mode</span>
              </button>
              <button
                type="button"
                onClick={() => onTriggerAction("add-repo")}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white"
              >
                <span>+ Connect &amp; Index GitHub Repository</span>
                <span className="font-mono text-[10px] text-slate-500">Live</span>
              </button>
              <button
                type="button"
                onClick={() => onTriggerAction("webhook")}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-indigo-600/20 hover:text-white"
              >
                <span>⚙ View GitHub Webhook &amp; cURL Setup Guide</span>
                <span className="font-mono text-[10px] text-slate-500">Docs</span>
              </button>
            </div>
          </div>

          {/* Pull Requests */}
          {matchedReviews.length > 0 && (
            <div>
              <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Pull Request Reviews ({matchedReviews.length})
              </div>
              <div className="space-y-1">
                {matchedReviews.map(({ repoName, review }) => (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => onSelectReview(repoName, review.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-mono font-bold text-indigo-300">#{review.pr_number}</span>{" "}
                      <span>{review.title}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">{repoName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Repositories */}
          {matchedRepos.length > 0 && (
            <div>
              <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Repositories ({matchedRepos.length})
              </div>
              <div className="space-y-1">
                {matchedRepos.map((r) => (
                  <button
                    key={r.full_name}
                    type="button"
                    onClick={() => onSelectRepo(r.full_name)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-mono text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  >
                    <span>{r.full_name}</span>
                    <StatusBadge status={r.index_status} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
