from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "GymCore API"
    env: str = "development"
    debug: bool = True
    backend_port: int = 8002

    postgres_user: str = "gymcore"
    postgres_password: str = "gymcore_dev"
    postgres_db: str = "gymcore"
    postgres_host: str = "localhost"
    postgres_port: int = 5434
    database_url: str = ""

    jwt_secret: str = "dev-only-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480

    super_admin_email: str = "admin@gymcore.app"
    super_admin_password: str = "change-me-in-production"
    super_admin_name: str = "Super Admin"

    r2_endpoint: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_base_url: str = ""

    # Media (MVP: storage local; R2 cuando existan credenciales)
    media_root: str = "media"

    # WhatsApp Business (Meta Cloud API)
    whatsapp_api_version: str = "v21.0"
    whatsapp_graph_base: str = "https://graph.facebook.com"
    whatsapp_webhook_verify_token: str = "gymcore-verify-2026"

    # Cola de mensajes salientes (Amazon SQS)
    sqs_queue_url: str = ""
    sqs_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    # SMTP (envío de correos)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True

    # Mercado Pago (pasarela de pagos)
    mercadopago_access_token: str = ""
    mercadopago_public_key: str = ""
    mercadopago_webhook_secret: str = ""

    # Motor de riesgo de abandono: barrido periódico (segundos; 0 = desactivado)
    risk_sweep_seconds: int = 1800

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
