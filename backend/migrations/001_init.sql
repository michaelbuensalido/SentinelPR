CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_user_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    access_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL UNIQUE,
    index_status VARCHAR(30) DEFAULT 'PENDING',
    total_chunks INT DEFAULT 0
);

CREATE TABLE code_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    symbol_name VARCHAR(255),
    start_line INT NOT NULL,
    end_line INT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    raw_code TEXT NOT NULL,
    embedding vector(1536),
    UNIQUE(repo_id, file_path, content_hash)
);
CREATE INDEX idx_code_chunks_embedding ON code_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE pr_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    pr_number INT NOT NULL,
    commit_sha VARCHAR(40) NOT NULL,
    status VARCHAR(30) DEFAULT 'QUEUED',
    latency_ms INT,
    tokens INT,
    result JSONB
);
