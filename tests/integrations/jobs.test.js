import { describe, expect, it, vi } from "vitest";
import { syncCatalog, syncPopularity, syncRankings } from "../../server/jobs/index.js";

function repository({ locked = true } = {}) {
  return {
    withAdvisoryLock: vi.fn(async (_key, callback) => locked ? callback() : false),
    startSyncRun: vi.fn(async () => ({ id: "run-1" })),
    finishSyncRun: vi.fn(async () => {}),
    upsertCatalogGames: vi.fn(async () => {}),
    replaceRankingSnapshot: vi.fn(async () => {}),
    upsertHistoricalPopularity: vi.fn(async () => {}),
  };
}

const clock = () => new Date("2026-08-24T12:00:00.000Z");

describe("sync jobs", () => {
  it("persiste catálogo dentro de um advisory lock", async () => {
    const repo = repository();
    const result = await syncCatalog({ repository: repo, igdb: { listCatalog: vi.fn(async () => [{ externalId: "1" }]) }, now: clock });
    expect(result).toMatchObject({ status: "success", records: 1 });
    expect(repo.upsertCatalogGames).toHaveBeenCalledWith([{ externalId: "1" }], expect.objectContaining({ source: "igdb" }));
    expect(repo.finishSyncRun).toHaveBeenLastCalledWith(expect.objectContaining({ status: "success" }));
  });

  it("não executa duas instâncias quando o lock não é adquirido", async () => {
    const repo = repository({ locked: false });
    const result = await syncPopularity({ repository: repo, igdb: { listHistoricalPopularity: vi.fn() }, now: clock });
    expect(result.status).toBe("skipped");
    expect(repo.startSyncRun).not.toHaveBeenCalled();
  });

  it("mantém snapshots Steam e Epic separados e consolida duplicatas Steam", async () => {
    const repo = repository();
    const result = await syncRankings({
      repository: repo,
      now: clock,
      steam: {
        getGamesByConcurrentPlayers: async () => [{ externalId: "730", rank: 2, metric: 10 }],
        getMostPlayedGames: async () => [{ externalId: "730", rank: 1, metric: 20 }],
      },
      epic: { getMostPlayedGames: async () => [{ externalId: "fortnite", rank: 1 }] },
    });
    expect(result).toMatchObject({ records: 2, sources: { steam: 1, epic: 1 } });
    expect(repo.replaceRankingSnapshot).toHaveBeenCalledWith(expect.objectContaining({ source: "steam", entries: [expect.objectContaining({ rank: 1, metric: 20 })] }));
    expect(repo.replaceRankingSnapshot).toHaveBeenCalledWith(expect.objectContaining({ source: "epic" }));
  });
});
