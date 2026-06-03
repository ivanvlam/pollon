# Pollon — Auditoría técnica

Fecha: 2026-06-03 · Alcance: lógica de tiempo/cierre, puntuación, cron,
seguridad y consistencia de datos. Severidad: 🔴 alta · 🟠 media · 🟡 baja · ℹ️ info.

---

## 1. Tiempo y disponibilidad (lo más delicado)

### ℹ️ Cierre = duración absoluta de 24h sobre epoch UTC
`kickoff_at` se guarda en UTC (`timestamptz`). Tanto el lado SQL
(`now() >= kickoff_at - make_interval(hours => 24)`) como el TS
(`kickoff_ms - 24*3600_000`) usan **86 400 s exactos**. Es inmune a DST y a
la timezone del usuario **siempre que el ISO traiga offset** (Supabase lo
hace). Cubierto por `timing.test.ts` (mismo instante en `Z` y `+02:00`).

### 🟠 Constante de cierre duplicada en SQL y TS
`v_lock_hours = 24` en `submit_prediction` / `submit_champion` y
`LOCK_HOURS_BEFORE_KICKOFF = 24` en TS. Si cambia una y no la otra, el
display y la validación divergen. **Mitigación:** TS ahora tiene fuente
única (`lib/timing.ts`). **Pendiente:** no hay forma de compartir la
constante con PL/pgSQL; documentado en cada migración. Recomendación: al
cambiar el valor, modificar ambos lados en el mismo commit.

### ℹ️ Triple cómputo del cierre — el servidor manda
1. `lib/timing.ts` (display + countdown, reloj del cliente).
2. `submit_prediction` (PL/pgSQL, **reloj del servidor — autoridad**).
3. `lock-predictions` cron (setea el flag `is_locked`).
El cliente puede mostrar "abierto" por skew de reloj y el servidor
rechazar (o viceversa). Es aceptable: la DB es la autoridad y devuelve
`predictions closed`. El countdown usa el `kickoff_at` del servidor, así
que el sesgo se limita al reloj local del navegador.

### 🟡 `is_locked` puede ir por detrás del cierre real
El cron corre cada hora, pero `submit_prediction` valida por tiempo. Entre
corridas, una predicción puede estar "cerrada por tiempo" aunque
`is_locked = false`. Consecuencia: la **visibilidad** de predicciones
ajenas (RLS exige `is_locked = true`) puede tardar hasta ~1h en abrirse
tras el cierre. No afecta la integridad, solo la latencia de revelado.

---

## 2. Puntuación

### ✅ Casos cubiertos por tests
`scoring.test.ts` + casos de borde nuevos: marcador exacto, ganador/empate,
eliminatoria exacto+clasificado (4), solo clasificado (2), exacto sin
clasificar por penales (2), 0-0, marcadores altos, predicción incompleta,
partido sin resultado.

### 🟠 Una fila por partido en `scores` (UNIQUE)
`UNIQUE(user_id, pool_id, match_id)` obliga a colapsar grupos/eliminatorias
en una sola `reason`. Es intencional (ver `scoring.ts`), pero significa que
un partido de eliminatoria con 4 pts cuenta como `exact_qualifier_score` y
NO suma a `winner_count` en el desempate. Decisión consciente: el exacto
tiene mayor prioridad de desempate.

### 🟡 `scores` con `match_id = NULL` (campeón) no es deduplicado por el UNIQUE
En Postgres los `NULL` son distintos entre sí, así que el constraint **no**
impide dos filas de campeón para el mismo (user, pool). La integridad
depende 100% de que `replace_champion_scores` haga `DELETE ... WHERE
reason='champion'` antes de insertar. **Recomendación:** índice único
parcial `(user_id, pool_id) WHERE reason='champion'` como red de seguridad.

### 🟠 Recalcular tras unirse a una polla ya cerrada
`recalculateMatchScores` genera filas solo para las pollas en que el
usuario está **al momento del recálculo**. Si alguien se une a una polla
después de que un partido finalizó, no recibe esos puntos hasta el próximo
recálculo de ese partido. **Recomendación:** al unirse, recalcular los
partidos finalizados del usuario, o calcular el ranking en vivo desde
`predictions` (más caro).

### 🟠 Scoring de campeón depende de detectar "la final"
Se dispara cuando un partido con `round = 'final'` pasa a `finished` con
`winner` no nulo. Riesgos:
- Si el partido por el 3er puesto se mapea como `final`, el campeón se
  calcularía del partido equivocado.
- Si la final nunca llega a `finished` vía API, el campeón no se puntúa
  hasta cargar el resultado manual (que sí dispara el recálculo).
**Recomendación:** validar que exista exactamente un `round='final'` y/o
botón admin "recalcular campeón".

---

## 3. Cron y notificaciones

### ✅ Emails de recordatorio duplicados — RESUELTO
Antes: `send-reminders` (horario) con ventana de 2h mandaba el mismo aviso
en dos corridas. Ahora existe la tabla `sent_reminders (user_id, match_id)`
con UNIQUE; la ruta **reserva la fila antes de enviar** (insert que falla si
ya existe) y solo envía si la reserva tuvo éxito. Si el email falla, libera
la reserva para reintentar. Migración `..._sent_reminders.sql`.

### ✅ `auth.admin.listUsers()` sin paginar — RESUELTO
Ahora se itera `page`/`perPage` (1000) hasta agotar, así todos los usuarios
entran al mapa id→email, no solo la primera página.

### 🟠 `sync-matches` sobrescribe resultados manuales del admin
El `upsert` por `external_id` pisa `home_score/away_score/winner` con lo que
diga API-Football. Si el admin corrigió un resultado y luego corre el sync,
se pierde la corrección. **Recomendación:** flag `manual_override` en
`matches` que el sync respete.

### 🟡 `CRON_SECRET` comparado con `===` (no constant-time)
`verifyCronSecret` usa igualdad normal → microfuga temporal teórica.
Riesgo bajo (secreto largo, no es oráculo de caracteres). **Recomendación:**
`crypto.timingSafeEqual`.

### 🟡 Recalcular en `sync-matches` es secuencial y sin límite
Por cada partido recién finalizado se hace `await recalculateMatchScores`
en serie. Con muchos finalizados a la vez podría exceder el tiempo de la
función. **Recomendación:** acotar/loteatar.

---

## 4. Seguridad (estado tras el commit de fixes)

### ✅ Resueltos
- Enumeración de `invite_code` (policy `USING (true)` eliminada; join por
  service role).
- `replace_match_scores` / `replace_champion_scores` revocadas a
  `public/anon/authenticated`, concedidas a `service_role`.
- `SUPABASE_SERVICE_ROLE_KEY` nunca importado en código cliente.
- Sin secretos commiteados (solo `.env.example`).

### 🟠 Sin rate limiting
`submit_prediction`, `joinPool`, login/registro no tienen límite de tasa.
Spam/fuerza bruta posibles. **Recomendación:** rate limit en endpoints
públicos (especialmente `/join/[code]` y auth).

### 🟡 RLS de `predictions` revela solo con `is_locked = true`
Correcto, pero atado a que el cron marque el flag (ver §1, latencia ~1h).

---

## 5. Datos / consistencia

### 🟡 Campeón abierto para siempre si nunca se carga el fixture
`min(kickoff_at)` NULL ⇒ sin deadline. Aceptable, pero si el fixture nunca
se sincroniza, la predicción de campeón nunca cierra. Documentado.

### ℹ️ `npm audit`: 5 restantes
Todas dev-only (`glob`, `postcss`) o advisories de Next parcheados solo en
15/16 (el stack fija Next 14). El bypass crítico de middleware ya está
parcheado (14.2.35).

---

## Resumen de prioridades

| # | Severidad | Tema | Estado |
|---|-----------|------|--------|
| 3.1 | 🔴 | Emails duplicados | ✅ resuelto |
| 3.2 | 🔴 | listUsers sin paginar | ✅ resuelto |
| 2.4 | 🟠 | Puntos al unirse tarde | abierto |
| 2.5 | 🟠 | Detección de la final | abierto |
| 3.3 | 🟠 | Sync pisa resultado manual | abierto |
| 4.2 | 🟠 | Sin rate limiting | abierto |
| 1.2 | 🟠 | Constante de cierre duplicada | mitigado |
| 2.3 | 🟡 | Dedupe de campeón en scores | recomendación |
| 3.4 | 🟡 | CRON_SECRET no constant-time | abierto |
