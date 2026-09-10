from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_JWT_SECRETS = {
    "dev-only-secret-change-in-production",
    "gymcore-local-dev-secret-2026-change-me",
}
_DEFAULT_SUPER_ADMIN_PASSWORDS = {
    "change-me-in-production",
    "gymcore_admin_2026",
}


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

    # Motor de riesgo de abandono: barrido periódico (segundos; 0 = desactivado)
    risk_sweep_seconds: int = 1800

    # Check-in/out por lector: si el socio ya tiene una sesión abierta y
    # vuelve a pasar el QR antes de estos minutos, se le avisa "ya está
    # dentro" (probablemente no supo si pasó). Pasado este umbral, el
    # escaneo cierra la sesión (check-out automático).
    checkout_grace_minutes: int = 5

    # Orígenes permitidos por CORS. En dev el frontend proxyea (mismo origen),
    # así que el default "*" no requiere credentials.
    cors_origins: list[str] = ["*"]

    # Secreto del webhook de WhatsApp (Meta Cloud API) para validar firmas.
    whatsapp_app_secret: str = ""

    @model_validator(mode="after")
    def _block_insecure_production_defaults(self) -> "Settings":
        """Impide desplegar producción con secrets por defecto (H1).

        En entornos que no sean development/test, un JWT_SECRET o
        SUPER_ADMIN_PASSWORD por defecto haría que la app falle al arrancar
        en lugar de desplegarse con tokens forjables.
        """
        if self.env in ("development", "test"):
            return self
        if self.jwt_secret in _DEFAULT_JWT_SECRETS:
            raise ValueError(
                "JWT_SECRET no está configurado para producción. "
                "Define una clave aleatoria y segura."
            )
        if self.super_admin_password in _DEFAULT_SUPER_ADMIN_PASSWORDS:
            raise ValueError(
                "SUPER_ADMIN_PASSWORD no está configurado para producción. "
                "Cambia la contraseña del super-admin."
            )
        return self

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
