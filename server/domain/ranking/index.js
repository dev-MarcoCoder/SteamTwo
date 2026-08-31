const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizePosition(position, totalEntries) {
  if (!Number.isInteger(position) || position < 1) throw new TypeError("position deve ser um inteiro positivo");
  if (!Number.isInteger(totalEntries) || totalEntries < position) {
    throw new TypeError("totalEntries deve ser um inteiro maior ou igual a position");
  }
  return (100 * (totalEntries - position + 1)) / totalEntries;
}

/**
 * Combines store positions for one game. A valid snapshot where the game does
 * not appear contributes zero; an outage is not evidence and is excluded.
 */
export function calculateSnapshotScore({ steam, epic } = {}) {
  const sources = [steam, epic].filter(Boolean);
  const valid = sources.filter((source) => source.status !== "outage");
  if (valid.length === 0) return null;
  const scores = valid.map((source) => (
    source.position == null ? 0 : normalizePosition(source.position, source.totalEntries)
  ));
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function calculateScoresByGame(snapshots) {
  const gameIds = new Set();
  for (const snapshot of Object.values(snapshots)) {
    for (const entry of snapshot?.entries ?? []) gameIds.add(entry.gameId);
  }
  return [...gameIds].map((gameId) => {
    const perStore = {};
    for (const store of ["steam", "epic"]) {
      const snapshot = snapshots[store];
      if (!snapshot) continue;
      const entry = snapshot.entries?.find((item) => item.gameId === gameId);
      perStore[store] = {
        status: snapshot.status,
        totalEntries: snapshot.totalEntries,
        position: entry?.position ?? null,
      };
    }
    return { gameId, score: calculateSnapshotScore(perStore), sources: perStore };
  }).filter((item) => item.score !== null)
    .sort((a, b) => b.score - a.score || a.gameId.localeCompare(b.gameId))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/** Seven calendar days ending at endAt. A missing source-wide snapshot is excluded,
 * while a valid snapshot without a game counts as zero. */
export function calculateWeeklyScores({ dailySnapshots, endAt = new Date() }) {
  const dayEnd = new Date(endAt);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const perGame = new Map();
  let validDays = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const start = new Date(dayEnd.getTime() - offset * DAY_MS);
    start.setUTCHours(0, 0, 0, 0);
    const key = start.toISOString().slice(0, 10);
    const ranking = calculateScoresByGame(dailySnapshots[key] ?? {});
    const sourceSnapshots = Object.values(dailySnapshots[key] ?? {});
    const hasValidSource = sourceSnapshots.some((snapshot) => snapshot?.status !== "outage");
    if (!hasValidSource) continue;
    validDays += 1;
    const scoreByGame = new Map(ranking.map((entry) => [entry.gameId, entry.score]));
    const gameIds = new Set();
    for (const snapshot of sourceSnapshots) for (const entry of snapshot?.entries ?? []) gameIds.add(entry.gameId);
    for (const gameId of gameIds) perGame.set(gameId, perGame.get(gameId) ?? 0);
    for (const [gameId, score] of scoreByGame) perGame.set(gameId, (perGame.get(gameId) ?? 0) + score);
  }
  if (validDays === 0) return [];
  return [...perGame].map(([gameId, total]) => ({
    gameId,
    score: total / validDays,
    validDays,
  })).sort((a, b) => b.score - a.score || a.gameId.localeCompare(b.gameId))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function createAllTimeRanking(games) {
  return games.filter((game) => Number.isFinite(game.igdbPopularity))
    .map((game) => ({ gameId: game.id, score: game.igdbPopularity, metric: game.igdbPopularity }))
    .sort((a, b) => b.score - a.score || a.gameId.localeCompare(b.gameId))
    .map((item, index) => ({ ...item, rank: index + 1, source: "igdb" }));
}
