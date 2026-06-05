# Pollon ⚽

Polla del Mundial 2026. App privada donde grupos de amigos predicen resultados de partidos y compiten en un ranking.

## Stack

- **Framework:** Next.js 14 (App Router, Server Components, Server Actions)
- **Base de datos y auth:** Supabase (Postgres + RLS + Auth)
- **Hosting:** Vercel
- **Cron jobs:** GitHub Actions
- **Emails:** Resend
- **Datos del Mundial:** TheSportsDB (fixtures y resultados)

## Setup local

```bash
cp .env.example .env.local
# Completar variables en .env.local
npm install
npm run dev
```

## Variables de entorno

Ver `.env.example` para la lista completa. Las obligatorias antes del deploy:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (`sb_publishable_*`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de servidor (`sb_secret_*`) |
| `ADMIN_EMAIL` | Email del administrador de la app |
| `CRON_SECRET` | String aleatorio ≥ 16 chars — también en GitHub Actions secrets |
| `RESEND_API_KEY` | Para envío de emails (opcional en desarrollo) |

> **Nota sobre las claves de Supabase:** el nuevo formato `sb_secret_*` no otorga el rol PostgreSQL `service_role` vía PostgREST. Para operaciones con privilegios elevados se usan funciones `SECURITY DEFINER` en la DB.

## Comandos

```bash
npm run dev          # servidor local (http://localhost:3000)
npm run build        # build de producción
npm run typecheck    # verificación de tipos
npm run test         # tests unitarios (Vitest)
npm run lint         # ESLint
npm run db:types     # regenerar tipos desde la DB (requiere Supabase CLI)
```

## Migraciones

Las migraciones viven en `supabase/migrations/`. Aplicar manualmente en el SQL editor del dashboard de Supabase o con `supabase db push` si tenés la CLI configurada.

## Cron jobs

Los cron corren desde GitHub Actions (`.github/workflows/`). Requieren los secrets `APP_URL` y `CRON_SECRET` configurados en el repositorio.

| Workflow | Frecuencia | Qué hace |
|----------|------------|----------|
| `sync-matches` | Cada 15 min | Sincroniza fixture y resultados desde TheSportsDB (solo durante ventanas de partido) |
| `lock-predictions` | Cada hora | Bloquea predicciones de partidos próximos |
| `send-reminders` | Cada hora | Emails de recordatorio 2h antes del cierre |
