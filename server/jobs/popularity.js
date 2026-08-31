import { runLockedSync } from "./run-job.js";

export async function syncPopularity({ repository, igdb, now } = {}) {
  if (!igdb?.listHistoricalPopularity) throw new Error("igdb.listHistoricalPopularity é obrigatório");
  return runLockedSync({
    repository,
    job: "popularity",
    lockKey: "steamtwo:sync:popularity",
    now,
    execute: async ({ capturedAt }) => {
      const entries = await igdb.listHistoricalPopularity();
      await repository.upsertHistoricalPopularity(entries, { capturedAt });
      return { records: entries.length, capturedAt };
    },
  });
}
