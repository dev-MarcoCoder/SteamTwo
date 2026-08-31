export const rankingPeriods = ["now", "week", "all-time"];
export const storeFilters = ["all", "steam", "epic"];

export const dashboardShape = {
  hero: null,
  topFive: [],
  week: [],
  allTime: [],
  records: [],
  updatedAt: null,
  sourceStatus: {
    steam: "unavailable",
    epic: "unavailable",
    igdb: "unavailable",
  },
};

export function createRankingItem(game, ranking = {}) {
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    summary: game.summary ?? "",
    coverUrl: game.coverUrl ?? null,
    heroUrl: game.heroUrl ?? null,
    genres: game.genres ?? [],
    stores: game.stores ?? [],
    rank: ranking.rank ?? null,
    score: ranking.score ?? null,
    metric: ranking.metric ?? null,
    trend: ranking.trend ?? 0,
    source: ranking.source ?? "steamtwo",
    updatedAt: ranking.updatedAt ?? null,
  };
}

