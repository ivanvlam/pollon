# Pollon ⚽

Polla del Mundial 2026. App privada donde grupos de amigos predicen resultados de partidos y compiten en un ranking.

## Características

- **Predicciones por partido** con guardado automático (sin botón de enviar). Cierran 1 hora antes del inicio de cada partido.
- **Tus predicciones son globales:** la misma predicción cuenta en todas las pollas en las que participas; se sincronizan solas.
- **Puntuación** (excluyente, se aplica el nivel más alto): grupos 5/3/2 (exacto / misma diferencia / acierto); eliminatorias igual, sobre acertar el clasificado. **+15** por el campeón y **+10** por el goleador (se cierran 1h antes del primer partido).
- **Ranking por polla** con desempates (exactos → diferencias → aciertos → campeón → alfabético) y la razón de cada puntaje a la vista.
- **Pollas privadas** por código de invitación. El creador puede eliminar la polla mientras no tenga puntos registrados; nadie puede abandonarla por su cuenta.
- **Panel de admin** (único `ADMIN_EMAIL`) para activar rondas eliminatorias, cargar resultados manualmente y marcar campeón/goleador reales.

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
| `RESEND_API_KEY` | Opcional. Solo para los recordatorios por email (función planificada para una próxima versión, hoy inactiva). |

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
| `lock-predictions` | Cada hora | Marca `is_locked` y cierra campeón/goleador 1h antes del primer partido |

> ⏳ **Próxima versión:** recordatorios por email antes del cierre (`send-reminders`). El endpoint y el workflow ya existen en el repo pero están **inactivos**: requieren configurar Resend (`RESEND_API_KEY`).
