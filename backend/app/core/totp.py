"""Utilidades TOTP (2FA) para super-admin y admins de gimnasio.

Implementa el estándar RFC 6238, compatible con Microsoft Authenticator,
Google Authenticator, Authy y cualquier app TOTP.
"""

import base64
import urllib.parse

import pyotp

ISSUER = "GymCore"


def generate_secret() -> str:
    return pyotp.random_base32()


def build_otpauth_uri(email: str, secret: str) -> str:
    """URI `otpauth://totp/...` que la app de autenticación escanea como QR."""
    label = urllib.parse.quote(f"{ISSUER}:{email}", safe="")
    params = urllib.parse.urlencode(
        {"secret": secret, "issuer": ISSUER, "algorithm": "SHA1", "digits": 6, "period": 30}
    )
    return f"otpauth://totp/{label}?{params}"


def qr_data_uri(otpauth_uri: str) -> str:
    """Genera un QR (data URI) a partir de la URI otpauth, para mostrarlo en el
    navegador sin depender de un servicio externo."""
    from io import BytesIO

    import qrcode

    img = qrcode.make(otpauth_uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def verify_code(secret: str, code: str) -> bool:
    """Valida un código TOTP de 6 dígitos contra el secreto."""
    if not secret:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
