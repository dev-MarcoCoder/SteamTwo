import { describe, expect, it, vi } from "vitest";
import { syncCatalog, syncPopularity, syncPrices, syncRankings } from "../../server/jobs/index.js";

function repository({ locked = true, steamListings = [], epicListings = [] } = {}) {
  return {
    withAdvisoryLock: vi.fn(async (_key, callback) => locked ? callback() : false),
    startSyncRun: vi.fn(async () => ({ id: "run-1" })),
    finishSyncRun: vi.fn(async () => {}),
    upsertCatalogGames: vi.fn(async () => {}),
    replaceRankingSnapshot: vi.fn(async () => {}),
    upsertHistoricalPopularity: vi.fn(async () => {}),
    listStoreListings: vi.fn(async (store) => (store === "steam" ? steamListings : epicListings)),
    upsertPrices: vi.fn(async () => {}),
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

  it("busca preços Steam por listagem e cruza promoções Epic por externalId", async () => {
    const repo = repository({
      steamListings: [{ listingId: "l-1", externalId: "730" }, { listingId: "l-2", externalId: "999" }],
      epicListings: [{ listingId: "l-3", externalId: "fortnite" }, { listingId: "l-4", externalId: "unknown" }],
    });
    const result = await syncPrices({
      repository: repo,
      now: clock,
      steam: { getAppPrice: vi.fn(async (id) => (id === "730" ? { externalId: "730", discountPercent: 10, isFree: false } : null)) },
      epic: { getFreeGamesPromotions: vi.fn(async () => [{ externalId: "fortnite", discountPercent: 0, isFree: true }]) },
    });
    expect(result).toMatchObject({ status: "success", records: 2, sources: { steam: 1, epic: 1 } });
    expect(repo.upsertPrices).toHaveBeenCalledWith([
      expect.objectContaining({ listingId: "l-1", externalId: "730" }),
      expect.objectContaining({ listingId: "l-3", externalId: "fortnite" }),
    ], expect.objectContaining({ capturedAt: expect.any(Date) }));
  });

  it("segue mesmo se uma chamada de preço Steam falhar", async () => {
    const repo = repository({ steamListings: [{ listingId: "l-1", externalId: "730" }] });
    const result = await syncPrices({
      repository: repo,
      now: clock,
      steam: { getAppPrice: vi.fn(async () => { throw new Error("indisponível"); }) },
      epic: { getFreeGamesPromotions: vi.fn(async () => []) },
    });
    expect(result).toMatchObject({ status: "success", records: 0 });
  });
});
