# Pollon ⚽

[![CI](https://github.com/ivanvlam/pollon/actions/workflows/ci.yml/badge.svg)](https://github.com/ivanvlam/pollon/actions/workflows/ci.yml)

Polla del Mundial 2026. App web privada donde grupos de amigos predicen los resultados de los partidos y compiten en un ranking, con seguimiento en vivo de cada partido.

**🔗 Demo:** https://pollon-nine.vercel.app

<!-- TODO: agregar capturas/GIF (ranking, bracket, animación de gol, partido en vivo). -->

## Características

- **Predicciones por partido** con guardado automático (debounce, sin botón de enviar). Cada partido cierra **1 hora antes de su propio inicio**, validado en la base de datos (no solo en el frontend).
- **Predicciones globales:** la misma predicción cuenta en todas las pollas en las que participas; al unirte a mitad de torneo se hace *backfill* de tus puntos en los partidos ya jugados.
- **Puntuación excluyente** (se aplica solo el nivel más alto): en grupos 5/3/2 (marcador exacto / misma diferencia de goles / acierto de resultado); en eliminatorias igual, pero **condicionado a acertar el clasificado**. Además **+15** por el campeón y **+10** por el goleador del torneo (se cierran 1h antes del primer partido).
- **Seguimiento en vivo:** estado del partido, marcador y **animación de gol** (pelota, "GOOOL" y confeti del equipo) durante los partidos.
- **Ranking por polla** con desempates por criterios reales —exactos → misma diferencia → aciertos → campeón— (sin desempate alfabético), mostrando la razón de cada puntaje. Vistas de **fase de grupos**, **bracket eliminatorio**, **historial** por partido y **estadísticas**.
- **Pollas privadas** por código de invitación. El creador administra la polla (renombrar, expulsar miembros, eliminar mientras no haya puntos registrados); cualquier participante puede **abandonarla** por su cuenta (el creador no, para eso elimina la polla). No se puede unir después de la final.
- **Panel de admin** global (único `ADMIN_EMAIL`): estadísticas, gestión de pollas/usuarios, activación manual de rondas eliminatorias, carga de resultados y marcado de campeón/goleador reales.
- **GDPR:** página de privacidad para usuarios de Europa.

## Stack

- **Framework:** Next.js 14 (App Router, Server Components, Server Actions)
- **Base de datos y auth:** Supabase (Postgres + RLS + Auth). La visibilidad de predicciones ajenas y los cierres se enforced con **RLS** y funciones `SECURITY DEFINER`, no solo en el cliente.
- **Hosting:** Vercel
- **Cron jobs:** [cron-job.org](https://cron-job.org) llamando a los endpoints `/api/cron/*` protegidos con `CRON_SECRET`
- **Emails:** Resend (recordatorios planificados, hoy inactivos)
- **Datos del Mundial:** TheSportsDB (fixtures y resultados; cliente alternativo para [football-data.org](https://www.football-data.org) preparado como *drop-in*)
- **Planteles:** datos estáticos (planteles oficiales FIFA 2026, 48 equipos) cargados vía RPC
- **Lenguaje:** TypeScript estricto en todo el proyecto
- **Tests:** Vitest sobre la lógica pura de negocio (puntuación, standings, timing, desempates)

## Setup local

```bash
cp .env.example .env.local
# Completar variables en .env.local
npm install
npm run dev          # http://localhost:3000
```

## Variables de entorno

Ver `.env.example` para la lista completa. Las obligatorias antes del deploy:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (`sb_publishable_*`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de servidor (`sb_secret_*`) — **nunca** exponer al cliente |
| `ADMIN_EMAIL` | Email del único administrador de la app |
| `CRON_SECRET` | String aleatorio ≥ 16 chars para proteger los endpoints de cron |
| `THESPORTSDB_KEY` | Clave de TheSportsDB (la gratuita permite 30 req/min, sin tope diario) |
| `RESEND_API_KEY` | Opcional — recordatorios de cierre por email (planificado, hoy inactivo) |

> **Nota sobre las claves de Supabase:** el nuevo formato `sb_secret_*` no otorga el rol PostgreSQL `service_role` vía PostgREST. Para operaciones con privilegios elevados se usan funciones `SECURITY DEFINER` en la DB.

## Comandos

```bash
npm run dev          # servidor local (http://localhost:3000)
npm run build        # build de producción
npm run typecheck    # verificación de tipos (tsc --noEmit)
npm run test         # tests unitarios (Vitest)
npm run lint         # ESLint
npm run db:types     # regenerar tipos desde la DB (requiere Supabase CLI)
```

## Estructura

```
src/
├── app/
│   ├── (auth)/                 # login y registro
│   ├── (app)/                  # rutas protegidas (requieren sesión)
│   │   ├── dashboard/          # mis pollas
│   │   ├── admin/              # panel global de admin
│   │   ├── champion/           # campeón y goleador del torneo
│   │   ├── como-funciona/      # reglas y puntuación
│   │   └── pool/[id]/          # ranking, predicciones, grupos, bracket, historial, estadísticas, manage
│   └── api/cron/               # sync-matches, lock-predictions, calculate-scores
├── components/                 # UI y componentes de la app
├── lib/                        # lógica de dominio (scoring, timing, supabase, dominios por carpeta)
└── types/                      # tipos TypeScript de la DB
supabase/migrations/            # esquema y funciones versionadas (SQL)
```

## Migraciones

Las migraciones viven en `supabase/migrations/`. Aplicar en el SQL editor del dashboard de Supabase o con `supabase db push` si tienes la CLI configurada.

## Cron jobs

Los endpoints `/api/cron/*` verifican el header `Authorization: Bearer ${CRON_SECRET}` antes de ejecutar. Los disparan tareas en [cron-job.org](https://cron-job.org). (Los workflows de `.github/workflows/` quedaron como alternativa pero están deshabilitados.)

| Endpoint | Frecuencia | Qué hace |
|----------|------------|----------|
| `sync-matches` | Cada 1 min | Sincroniza fixture y resultados desde TheSportsDB. *Smart windowing:* no llama a la API fuera de las ventanas de partido, así que 0 requests cuando no hay nada en juego. |
| `lock-predictions` | Cada hora | Marca `is_locked` y gestiona el cierre de campeón/goleador |

> ⏳ **Planificado (no implementado):** recordatorios de cierre por email (`send-reminders` vía Resend). El endpoint existe en el repo pero está inactivo.

## Licencia

[MIT](./LICENSE)
