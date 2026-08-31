import { describe, expect, it } from "vitest";
import { calculateSnapshotScore, calculateScoresByGame, calculateWeeklyScores, createAllTimeRanking, normalizePosition } from "../../server/domain/ranking/index.js";

describe("SteamTwo Index", () => {
  it("normaliza posições pelo tamanho do ranking", () => {
    expect(normalizePosition(1, 10)).toBe(100);
    expect(normalizePosition(10, 10)).toBe(10);
  });

  it("calcula a média quando ambas as fontes estão disponíveis", () => {
    expect(calculateSnapshotScore({
      steam: { status: "success", position: 1, totalEntries: 100 },
      epic: { status: "success", position: 50, totalEntries: 100 },
    })).toBe(75.5);
  });

  it("conta ausência válida como zero e exclui outage", () => {
    expect(calculateSnapshotScore({
      steam: { status: "success", position: 1, totalEntries: 10 },
      epic: { status: "success", position: null, totalEntries: 10 },
    })).toBe(50);
    expect(calculateSnapshotScore({
      steam: { status: "success", position: 1, totalEntries: 10 },
      epic: { status: "outage", position: null, totalEntries: 0 },
    })).toBe(100);
  });

  it("ordena desempates de forma determinística", () => {
    const result = calculateScoresByGame({
      steam: { status: "success", totalEntries: 2, entries: [{ gameId: "b", position: 1 }, { gameId: "a", position: 1 }] },
    });
    expect(result.map(({ gameId, rank }) => [gameId, rank])).toEqual([["a", 1], ["b", 2]]);
  });

  it("média semanal inclui ausência válida como zero e ignora outage global", () => {
    const dailySnapshots = {
      "2026-08-24": { steam: { status: "success", totalEntries: 10, entries: [{ gameId: "a", position: 1 }] } },
      "2026-08-23": { steam: { status: "success", totalEntries: 10, entries: [] } },
      "2026-08-22": { steam: { status: "outage", totalEntries: 0, entries: [] } },
    };
    const [game] = calculateWeeklyScores({ dailySnapshots, endAt: new Date("2026-08-24T12:00:00Z") });
    expect(game).toMatchObject({ gameId: "a", score: 50, validDays: 2, rank: 1 });
  });

  it("usa popularidade da IGDB para ranking histórico", () => {
    expect(createAllTimeRanking([{ id: "b", igdbPopularity: 4 }, { id: "a", igdbPopularity: 4 }]))
      .toMatchObject([{ gameId: "a", rank: 1, source: "igdb" }, { gameId: "b", rank: 2 }]);
  });
});
