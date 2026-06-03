import { describe, expect, it } from "vitest";

import {
  LOCK_MS,
  formatCountdown,
  isChampionLocked,
  isPredictionLocked,
  msUntilLock,
  predictionLockTime,
} from "@/lib/timing";

// Punto de referencia fijo en UTC para que los tests sean deterministas.
const KICKOFF = "2026-06-11T16:00:00.000Z";
const KICKOFF_MS = Date.parse(KICKOFF);
const LOCK = KICKOFF_MS - LOCK_MS; // 2026-06-10T16:00:00Z

describe("predictionLockTime", () => {
  it("es exactamente 24h antes del kickoff", () => {
    expect(predictionLockTime(KICKOFF)).toBe(Date.parse("2026-06-10T16:00:00Z"));
  });
});

describe("isPredictionLocked — bordes exactos", () => {
  it("ABIERTO 1ms antes del cierre", () => {
    expect(isPredictionLocked(KICKOFF, LOCK - 1)).toBe(false);
  });

  it("CERRADO en el instante exacto del cierre (>=)", () => {
    expect(isPredictionLocked(KICKOFF, LOCK)).toBe(true);
  });

  it("CERRADO 1ms después del cierre", () => {
    expect(isPredictionLocked(KICKOFF, LOCK + 1)).toBe(true);
  });

  it("ABIERTO mucho antes", () => {
    expect(isPredictionLocked(KICKOFF, LOCK - 7 * 86_400_000)).toBe(false);
  });

  it("CERRADO después del kickoff", () => {
    expect(isPredictionLocked(KICKOFF, KICKOFF_MS + 1)).toBe(true);
  });

  it("fail-closed: fecha inválida → cerrado", () => {
    expect(isPredictionLocked("no-es-fecha", LOCK - 100_000)).toBe(true);
  });
});

describe("isPredictionLocked — independiente de timezone/DST", () => {
  it("mismo resultado con kickoff expresado en offset distinto pero mismo instante", () => {
    // 16:00Z == 18:00+02:00; el cierre absoluto debe ser idéntico.
    const z = predictionLockTime("2026-06-11T16:00:00Z");
    const offset = predictionLockTime("2026-06-11T18:00:00+02:00");
    expect(z).toBe(offset);
  });
});

describe("msUntilLock", () => {
  it("positivo antes del cierre", () => {
    expect(msUntilLock(KICKOFF, LOCK - 5000)).toBe(5000);
  });
  it("cero en el cierre", () => {
    expect(msUntilLock(KICKOFF, LOCK)).toBe(0);
  });
  it("negativo después", () => {
    expect(msUntilLock(KICKOFF, LOCK + 5000)).toBe(-5000);
  });
});

describe("isChampionLocked", () => {
  it("ABIERTO si no hay fixture (null)", () => {
    expect(isChampionLocked(null, Date.now())).toBe(false);
  });
  it("ABIERTO 1ms antes del cierre del primer partido", () => {
    expect(isChampionLocked(KICKOFF, LOCK - 1)).toBe(false);
  });
  it("CERRADO en el instante exacto", () => {
    expect(isChampionLocked(KICKOFF, LOCK)).toBe(true);
  });
  it("fecha inválida → abierto (coincide con SQL min() NULL)", () => {
    expect(isChampionLocked("xxx", LOCK + 1)).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("días + horas + minutos", () => {
    expect(formatCountdown(2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000)).toBe(
      "2d 3h 4m",
    );
  });
  it("horas + minutos cuando <1 día", () => {
    expect(formatCountdown(3 * 3_600_000 + 4 * 60_000)).toBe("3h 4m");
  });
  it("solo minutos cuando <1h", () => {
    expect(formatCountdown(4 * 60_000)).toBe("4m");
  });
  it("cero o negativo → Cerrado", () => {
    expect(formatCountdown(0)).toBe("Cerrado");
    expect(formatCountdown(-1)).toBe("Cerrado");
  });
  it("NaN → Cerrado", () => {
    expect(formatCountdown(NaN)).toBe("Cerrado");
  });
});
