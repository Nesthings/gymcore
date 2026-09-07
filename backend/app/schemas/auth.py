from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    identifier: str = Field(description="Email para staff, o email del super-admin")
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    sub: str
    gym_id: str | None = None
    branch_id: str | None = None


class TwoFactorRequiredResponse(BaseModel):
    requires_2fa: bool = True
    challenge_token: str
    role: str = "super-admin"


class TwoFactorVerifyRequest(BaseModel):
    challenge_token: str
    code: str = Field(min_length=6, max_length=6)


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_data: str


class TwoFactorConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TwoFactorStatusResponse(BaseModel):
    totp_enabled: bool


class MeResponse(BaseModel):
    sub: str
    role: str
    gym_id: str | None = None
    branch_id: str | None = None
    full_name: str | None = None
    photo_url: str | None = None
    setup_completed: bool | None = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)
