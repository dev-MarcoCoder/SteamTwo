import { describe, expect, it, vi } from "vitest";
import { createJobRepository } from "../../server/db/job-repository.js";

function fakePool() {
  const queries = [];
  const client = {
    query: vi.fn(async (sql, values = []) => {
      queries.push({ sql, values });
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ acquired: true }] };
      if (sql.includes("INSERT INTO sync_runs")) return { rows: [{ id: "run-1" }] };
      if (sql.includes("INSERT INTO games")) return { rows: [{ id: `game-${values[0]}` }] };
      if (sql.includes("INSERT INTO genres")) return { rows: [{ id: 1 }] };
      if (sql.includes("SELECT id FROM ranking_snapshots")) return { rows: [] };
      if (sql.includes("FROM store_listings WHERE store")) return { rows: [{ externalId: "730", gameId: "game-cs" }] };
      if (sql.includes("INSERT INTO ranking_snapshots")) return { rows: [{ id: "snapshot-1" }] };
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return { connect: vi.fn(async () => client), query: client.query, end: vi.fn(), client, queries };
}

describe("job repository", () => {
  it("mantém advisory lock e callback no mesmo client", async () => {
    const pool = fakePool();
    const repository = await createJobRepository({ pool });
    const result = await repository.withAdvisoryLock("catalog", async () => repository.startSyncRun({ job: "catalog", startedAt: new Date() }));
    expect(result).toEqual({ id: "run-1" });
    expect(pool.client.query.mock.calls[0][0]).toContain("pg_try_advisory_lock");
    expect(pool.client.query.mock.calls.at(-1)[0]).toContain("pg_advisory_unlock");
    expect(pool.client.release).toHaveBeenCalledOnce();
  });

  it("faz catálogo idempotente com gênero e vínculos de loja", async () => {
    const pool = fakePool();
    const repository = await createJobRepository({ pool });
    await repository.withAdvisoryLock("catalog", () => repository.upsertCatalogGames([{
      externalId: "1", slug: "hades", title: "Hades", popularity: 88.4,
      genres: [{ name: "RPG" }], stores: [{ store: "steam", externalId: "1145360" }],
    }], { source: "igdb", capturedAt: new Date() }));
    expect(pool.queries.some(({ sql }) => sql.includes("INSERT INTO games"))).toBe(true);
    expect(pool.queries.some(({ sql, values }) => sql.includes("INSERT INTO store_listings") && values.includes("1145360"))).toBe(true);
  });

  it("insere snapshot somente uma vez para a mesma captura", async () => {
    const pool = fakePool();
    const repository = await createJobRepository({ pool });
    await repository.withAdvisoryLock("rankings", () => repository.replaceRankingSnapshot({
      source: "steam", capturedAt: new Date("2026-08-24T12:00:00Z"), entries: [{ externalId: "730", rank: 1, metric: 20 }],
    }));
    expect(pool.queries.some(({ sql }) => sql.includes("INSERT INTO ranking_snapshots"))).toBe(true);
    expect(pool.queries.some(({ sql }) => sql.includes("INSERT INTO ranking_entries"))).toBe(true);
  });
});
