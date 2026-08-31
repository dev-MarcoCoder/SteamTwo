import { describe, expect, it } from "vitest";
import { buildPopularityHistory, calculateSnapshotScore, calculateScoresByGame, calculateWeeklyScores, createAllTimeRanking, normalizePosition } from "../../server/domain/ranking/index.js";

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

  it("monta histórico diário combinando fontes do mesmo dia", () => {
    const rows = [
      { source: "steam", capturedAt: "2026-08-24T03:00:00Z", totalEntries: 10, position: 1 },
      { source: "epic", capturedAt: "2026-08-24T03:05:00Z", totalEntries: 10, position: 5 },
    ];
    expect(buildPopularityHistory(rows)).toEqual([
      { date: "2026-08-24", score: 80, sources: { steam: 100, epic: 60 } },
    ]);
  });

  it("histórico conta jogo ausente num snapshot válido como zero", () => {
    const rows = [{ source: "steam", capturedAt: "2026-08-24T03:00:00Z", totalEntries: 10, position: null }];
    expect(buildPopularityHistory(rows)).toEqual([
      { date: "2026-08-24", score: 0, sources: { steam: 0 } },
    ]);
  });

  it("histórico exclui dias sem nenhum snapshot e ordena por data", () => {
    const rows = [
      { source: "steam", capturedAt: "2026-08-25T03:00:00Z", totalEntries: 10, position: 1 },
      { source: "steam", capturedAt: "2026-08-23T03:00:00Z", totalEntries: 10, position: 10 },
    ];
    expect(buildPopularityHistory(rows).map((point) => point.date)).toEqual(["2026-08-23", "2026-08-25"]);
  });
});
