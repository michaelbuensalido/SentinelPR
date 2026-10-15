# SentinelPR

Codebase-aware autonomous PR reviewer: AST (tree-sitter) chunks → pgvector RAG → structured LLM review → single atomic GitHub review. See [PRD.md](PRD.md) and [MVP.md](MVP.md).

## Run backend
```bash
cp .env.example .env   # fill GITHUB_TOKEN, OPENAI_API_KEY, GITHUB_WEBHOOK_SECRET
docker compose up --build
curl localhost:8000/health
# index a public repo (TS/Python), then review a PR
curl -XPOST localhost:8000/api/v1/repos/index -H 'content-type: application/json' -d '{"full_name":"owner/repo"}'
curl -XPOST localhost:8000/api/v1/reviews -H 'content-type: application/json' -d '{"full_name":"owner/repo","pr_number":1,"commit_sha":"<head sha>"}'
```
Webhook: `POST /api/v1/webhooks/github` (HMAC `X-Hub-Signature-256`; handles `pull_request` opened/synchronize and `push`).

## Run dashboard
```bash
cd frontend && npm install && npm run dev
```
Without `NEXT_PUBLIC_API_URL` it runs in public sandbox/replay mode with two pre-loaded repos and a **Simulate Webhook** button. Set `NEXT_PUBLIC_API_URL=http://localhost:8000` for live mode (polls every 3s).

## Tests
`cd backend && pip install -r requirements.txt && pytest`
