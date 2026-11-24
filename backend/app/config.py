from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "VIAC Policy Administration"
    database_url: str = "sqlite:///./pas.db"
    cors_origins: str = "http://localhost:5173"
    demo_mode: bool = True
    demo_token: str = "local-demo-token"
    llm_provider: str = "mock"
    llm_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
