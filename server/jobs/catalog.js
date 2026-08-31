import { runLockedSync } from "./run-job.js";

export async function syncCatalog({ repository, igdb, now } = {}) {
  if (!igdb?.listCatalog) throw new Error("igdb.listCatalog é obrigatório");
  return runLockedSync({
    repository,
    job: "catalog",
    lockKey: "steamtwo:sync:catalog",
    now,
    execute: async ({ capturedAt }) => {
      const games = await igdb.listCatalog();
      await repository.upsertCatalogGames(games, { source: "igdb", capturedAt });
      return { records: games.length, capturedAt };
    },
  });
}
