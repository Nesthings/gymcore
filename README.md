# GymCore

**El sistema operativo del gimnasio** — SaaS de gestión de gimnasios multi-tenant.
Producto hermano de [VetCore](https://github.com/Nesthings/vetcore): reutiliza su
arquitectura (auth JWT multi-identidad, multi-tenant con sucursales, permisos por
componente, design system Tailwind v4 + shadcn) adaptada al dominio de gimnasios.

El diferencial no es la administración — es **retención, CRM e inteligencia
operativa** (riesgo de abandono, morosidad, score de retención).

## Módulos (Fase 0 — MVP)

- **Auth multi-tenant** — roles `super-admin / admin / recepcion / coach`
- **Socios + membresías** — alta, renovación, cancelación
- **Cobranza** — pagos (cash/card/transfer/**Mercado Pago**), recordatorios de vencimiento, recibo PDF
- **Check-in por QR/nombre** — sin hardware
- **Dashboard operativo** — ingresos, renovaciones, cancelaciones, morosidad, riesgo
- **CRM básico** — leads, pipeline, conversión
- **Score de riesgo de abandono** — reglas sobre asistencia/pagos/membresías

## Stack

| Capa | Tecnología |
|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL 16 |
| Auth | JWT HS256 (python-jose) + passlib/bcrypt |
| Frontend | React 19 · Vite · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · Recharts |
| Pagos | Mercado Pago (checkout Preferences + webhook) |
| Notificaciones | WhatsApp Business (Meta Cloud API) · SMTP · cola dual SQS/sync |

## Arranque local

```bash
# 1. Base de datos (PostgreSQL 16 en :5434)
docker-compose up -d db

# 2. Backend (:8002)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
cp ../.env.example ../.env        # ajusta credenciales
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m scripts.seed_super_admin
.venv/bin/python -m uvicorn app.main:app --port 8002

# 3. Frontend (:5173)
cd frontend
npm install
npm run dev
```

## Estructura

```
backend/
  app/
    api/          # routers: auth, gyms, branches, users, members, memberships,
                  #   payments, checkin, leads, risk, dashboards, automation…
    core/         # config, security, permissions (por componente), events, storage
    models/       # ORM: gym, staff, member, membership, payment, checkin, lead…
    schemas/      # Pydantic
    services/     # queue, whatsapp, email, mercadopago, risk_engine
  alembic/        # migraciones
  tests/          # pytest contra PostgreSQL real
frontend/
  src/
    pages/        # Dashboard, Socios, Miembro, Membresias, Pagos, Checkin, CRM, Riesgo…
    components/   # ui/ (shadcn), layout/, members/, crm/, payments/, checkin/, risk/
    lib/          # api, auth, permissions, nav, dashboards, theme…
```

## Inteligencia operativa (reglas, sin ML)

- **Riesgo de abandono** (`/risk/members`): score 0-100 por días sin asistir,
  tendencia de asistencia (28d vs 28d), membresía vencida/próxima a vencer.
  Niveles `info / warning / critical` con acción sugerida.
- **Morosidad**: socios activos sin membresía vigente agrupados por antigüedad.
- **Barrido periódico**: alertas de riesgo crítico deduplicadas (campanita interna).

## Notas

- Roles y catálogo de componentes por módulo se configuran en `app/core/permissions.py`.
- Mercado Pago requiere `MERCADOPAGO_ACCESS_TOKEN`; sin él, los pagos por ese
  método devuelven 502 (los demás métodos funcionan sin pasarela).
- El token de acceso de GitHub está en el prompt del producto; si es un secret
  real, rótalo (está expuesto en `~/Descargas/gymcore-prompt.md`).