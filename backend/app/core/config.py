from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://rupeedial:rupeedial@localhost:5432/rupeedial_crm"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    public_lead_api_key: str = "change-me"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,https://rupeedial.com,https://www.rupeedial.com"
    admin_email: str = "admin@rupeedial.com"
    admin_password: str = "Admin@12345"
    admin_name: str = "RupeeDial Admin"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
