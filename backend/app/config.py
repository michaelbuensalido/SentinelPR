from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://sentinel:sentinel@localhost:5432/sentinel"
    redis_url: str = "redis://localhost:6379"
    github_webhook_secret: str = "change-me"
    github_token: str = ""
    openai_api_key: str = ""
    llm_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-small"
    confidence_threshold: float = 0.80
    max_comments: int = 5
    top_k_context: int = 4
    cors_origins: str = "http://localhost:3000"


settings = Settings()
