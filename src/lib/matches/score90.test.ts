import { describe, expect, it } from "vitest";

import { resolveScore90 } from "@/lib/matches/score90";

describe("resolveScore90 (congelado del marcador a 90')", () => {
  it("reglamentario en curso: sigue al marcador actual", () => {
    expect(
      resolveScore90(undefined, { home_score_90: 2, away_score_90: 2, past_regulation: false }),
    ).toEqual({ home_score_90: 2, away_score_90: 2, reached_extra_time: false });
  });

  it("goles en el reglamentario actualizan el 90'", () => {
    const prev = { home_score_90: 1, away_score_90: 1, reached_extra_time: false };
    expect(
      resolveScore90(prev, { home_score_90: 2, away_score_90: 1, past_regulation: false }),
    ).toEqual({ home_score_90: 2, away_score_90: 1, reached_extra_time: false });
  });

  it("entra al alargue: congela el 90' capturado y marca reached_extra_time", () => {
    // 2-2 a los 90'; el fixture ya está past_regulation → trae *_90 = null.
    const prev = { home_score_90: 2, away_score_90: 2, reached_extra_time: false };
    expect(
      resolveScore90(prev, { home_score_90: null, away_score_90: null, past_regulation: true }),
    ).toEqual({ home_score_90: 2, away_score_90: 2, reached_extra_time: true });
  });

  it("BUG real: cierre como 'FT' tras alargue NO pisa el 90' congelado", () => {
    // Poll de cierre: el proveedor gratis reporta 'FT' 3-2 (past_regulation
    // false), pero un poll anterior ya marcó reached_extra_time.
    const prev = { home_score_90: 2, away_score_90: 2, reached_extra_time: true };
    expect(
      resolveScore90(prev, { home_score_90: 3, away_score_90: 2, past_regulation: false }),
    ).toEqual({ home_score_90: 2, away_score_90: 2, reached_extra_time: true });
  });

  it("cierre en reglamentario (sin alargue): usa el marcador final", () => {
    // Gol en tiempo de descuento: 3-1 final, todo reglamentario.
    const prev = { home_score_90: 2, away_score_90: 1, reached_extra_time: false };
    expect(
      resolveScore90(prev, { home_score_90: 3, away_score_90: 1, past_regulation: false }),
    ).toEqual({ home_score_90: 3, away_score_90: 1, reached_extra_time: false });
  });

  it("best-effort: alargue sin captura previa cae al del fixture", () => {
    // Cron caído en el 2T: no hay prev90; el fixture trae el final.
    expect(
      resolveScore90(undefined, { home_score_90: 3, away_score_90: 2, past_regulation: true }),
    ).toEqual({ home_score_90: 3, away_score_90: 2, reached_extra_time: true });
  });
});
