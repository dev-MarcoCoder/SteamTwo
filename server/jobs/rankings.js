import { runLockedSync } from "./run-job.js";

export async function syncRankings({ repository, steam, epic, now } = {}) {
  if (!steam?.getGamesByConcurrentPlayers || !steam?.getMostPlayedGames || !epic?.getMostPlayedGames) {
    throw new Error("Clientes Steam e Epic completos são obrigatórios");
  }
  return runLockedSync({
    repository,
    job: "rankings",
    lockKey: "steamtwo:sync:rankings",
    now,
    execute: async ({ capturedAt }) => {
      const [concurrent, mostPlayed, epicEntries] = await Promise.all([
        steam.getGamesByConcurrentPlayers(), steam.getMostPlayedGames(), epic.getMostPlayedGames(),
      ]);
      // Os dois endpoints Steam podem conter conjuntos diferentes; mantemos o
      // maior valor de jogadores e a melhor posição para cada app no snapshot.
      const mergedSteam = new Map();
      for (const entry of [...mostPlayed, ...concurrent]) {
        const current = mergedSteam.get(entry.externalId);
        mergedSteam.set(entry.externalId, {
          ...current,
          ...entry,
          rank: Math.min(current?.rank ?? Infinity, entry.rank ?? Infinity),
          metric: Math.max(current?.metric ?? 0, entry.metric ?? 0) || null,
        });
      }
      const steamEntries = [...mergedSteam.values()].sort((a, b) => a.rank - b.rank);
      await Promise.all([
        repository.replaceRankingSnapshot({ source: "steam", capturedAt, entries: steamEntries }),
        repository.replaceRankingSnapshot({ source: "epic", capturedAt, entries: epicEntries }),
      ]);
      return { records: steamEntries.length + epicEntries.length, capturedAt, sources: { steam: steamEntries.length, epic: epicEntries.length } };
    },
  });
}
