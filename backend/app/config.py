from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]  # contract-hub/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    # Storage (local stand-in for Azure Blob Storage)
    inbox_dir: Path = ROOT / "contracts" / "inbox"
    database_url: str = f"sqlite:///{ROOT / 'contracts' / 'contracts.db'}"

    # Extraction mode:
    #   "auto"      -> use Claude if ANTHROPIC_API_KEY is set, else heuristic
    #   "llm"       -> force Claude (fails if no key)
    #   "heuristic" -> regex/rule based agents only, no network
    extractor: str = "auto"
    anthropic_api_key: str | None = None
    llm_model: str = "claude-sonnet-5-5"

    # Business rules
    expiring_soon_days: int = 60

    # Behaviour
    watch_inbox: bool = True
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def use_llm(self) -> bool:
        if self.extractor == "heuristic":
            return False
        if self.extractor == "llm":
            return True
        return bool(self.anthropic_api_key)


settings = Settings()
settings.inbox_dir.mkdir(parents=True, exist_ok=True)
