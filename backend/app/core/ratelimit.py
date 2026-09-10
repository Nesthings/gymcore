"""Rate limiting en memoria (proceso único).

Suficiente para MVP/dev; en producción multi-proceso se debe mover a Redis o
similar. La API expone `RateLimiter.allow(key)` para ventanas deslizantes.
"""

import time
from collections import defaultdict


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        """True si la clave puede pasar (dentro del límite); False si excedió."""
        now = time.monotonic()
        hits = [t for t in self._hits[key] if now - t < self.window]
        if len(hits) >= self.limit:
            self._hits[key] = hits
            return False
        hits.append(now)
        self._hits[key] = hits
        return True

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)


# Login: 10 intentos por minuto por (identificador+IP).
login_limiter = RateLimiter(limit=10, window_seconds=60)
# Verificación 2FA: 5 intentos por minuto por (challenge token).
twofa_limiter = RateLimiter(limit=5, window_seconds=60)