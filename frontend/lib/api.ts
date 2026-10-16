import type { Comment, ContextChunk, DiffFile, JobStatus, Repo, Review } from "./demo";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

interface ApiRepo {
  full_name: string;
  index_status: string;
  total_chunks: number;
}
interface ApiReview {
  id: string;
  full_name: string;
  pr_number: number;
  commit_sha: string;
  status: JobStatus;
  latency_ms: number | null;
  tokens: number | null;
  result: { diff?: DiffFile[]; comments?: Comment[]; context?: ContextChunk[] } | null;
}

export async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch repos and reviews in two calls and group reviews under their repo. */
export async function loadLive(): Promise<Repo[]> {
  const [repos, reviews] = await Promise.all([
    request<ApiRepo[]>("/api/v1/repos"),
    request<ApiReview[]>("/api/v1/reviews"),
  ]);
  return repos.map((r) => ({
    ...r,
    reviews: reviews
      .filter((v) => v.full_name === r.full_name)
      .map(
        (v): Review => ({
          id: v.id,
          pr_number: v.pr_number,
          commit_sha: v.commit_sha,
          title: `Pull request #${v.pr_number}`,
          status: v.status,
          latency_ms: v.latency_ms ?? 0,
          tokens: v.tokens ?? 0,
          diff: v.result?.diff ?? [],
          comments: v.result?.comments ?? [],
          context: v.result?.context ?? [],
        })
      ),
  }));
}

export const indexRepo = (full_name: string) =>
  request<{ status: string }>("/api/v1/repos/index", { method: "POST", body: JSON.stringify({ full_name }) });

export const startReview = (full_name: string, pr_number: number, commit_sha: string) =>
  request<{ status: string; review_id?: string }>("/api/v1/reviews", {
    method: "POST",
    body: JSON.stringify({ full_name, pr_number, commit_sha }),
  });

/** Look up a PR's head commit via GitHub's public API (works for public repos). */
export async function resolveHeadSha(full_name: string, pr: number): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${full_name}/pulls/${pr}`);
  if (res.status === 404) throw new Error(`PR #${pr} not found in ${full_name} (or the repo is private)`);
  if (!res.ok) throw new Error(`GitHub lookup failed (${res.status}). Paste the commit SHA manually.`);
  return (await res.json()).head.sha as string;
}
