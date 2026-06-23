# Sonidos

## `goal.mp3`

Sonido que se reproduce con la animación de gol (`GoalCelebration`).

- Deja aquí un archivo llamado exactamente **`goal.mp3`** (grito de hinchada,
  bocina de estadio, etc.). Se sirve en `/sounds/goal.mp3`.
- Mantenlo corto (≈3-4 s, la animación dura 4 s) y liviano (idealmente < 200 KB).
- El usuario puede silenciarlo con el botón 🔊/🔇 de la celebración; la
  preferencia se guarda en `localStorage` (`pollon:goal-sound-muted`).
- Si el archivo no existe, la animación visual funciona igual (el audio
  simplemente no suena).

> Nota: los navegadores bloquean el autoplay con sonido hasta que el usuario
> interactúa con la página al menos una vez. Para goles en vivo normalmente ya
> hubo interacción (estás viendo la app); el botón de prueba en `/admin` siempre
> cuenta como interacción, así que ahí suena seguro.
