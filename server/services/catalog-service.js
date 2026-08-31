import { buildPopularityHistory } from "../domain/ranking/index.js";
import { mockGames, mockHistoryFor, mockUpdatedAt } from "../mock/games.js";

const storeMatches = (game, store) =>
  store === "all" || game.stores.some((listing) => listing.store === store);

function bestPromotion(prices = []) {
  if (!prices.length) return null;
  const free = prices.find((price) => price.isFree);
  if (free) return free;
  return prices.reduce((best, price) => (!best || price.discountPercent > best.discountPercent ? price : best), null);
}

function matchesPromoFilter(promotion, filter) {
  if (filter === "free") return promotion.isFree;
  if (filter === "half-price") return promotion.isFree || promotion.discountPercent >= 50;
  if (filter === "on-sale") return promotion.isFree || promotion.discountPercent > 0;
  return true;
}

function rankingView(game, index, field = "score") {
  return {
    ...game,
    rank: index + 1,
    score: Number(game[field].toFixed(1)),
    metric:
      field === "historicalPopularity"
        ? { type: "popularity", value: game[field], label: "Popularidade histórica" }
        : { type: "players", value: game.currentPlayers, label: "Jogadores Steam" },
    source: field === "historicalPopularity" ? "igdb" : "steamtwo",
    updatedAt: mockUpdatedAt,
  };
}

export function createCatalogService({ repository } = {}) {
  const source = repository ?? {
    async listGames() {
      return mockGames;
    },
  };

  return {
    async dashboard({ store = "all" } = {}) {
      const games = (await source.listGames()).filter((game) => storeMatches(game, store));
      const current = [...games].sort((a, b) => b.score - a.score);
      const week = current.slice(0, 5).map((game, index) => rankingView(game, index));
      const allTime = [...games]
        .sort((a, b) => b.historicalPopularity - a.historicalPopularity)
        .slice(0, 5)
        .map((game, index) => rankingView(game, index, "historicalPopularity"));
      const featuredGame = games.find((game) => game.slug === "elden-ring");
      const hero = featuredGame
        ? rankingView(featuredGame, current.findIndex((game) => game.id === featuredGame.id))
        : (week[0] ?? null);

      return {
        hero,
        topFive: week,
        week,
        allTime,
        records: allTime.slice(0, 1).map((game) => ({
          type: "historical-score",
          label: "Maior índice SteamTwo",
          value: game.score,
          game,
          achievedAt: "2026-08-24T12:00:00.000Z",
        })),
        updatedAt: mockUpdatedAt,
        sourceStatus: { steam: "fresh", epic: "fresh", igdb: "fresh" },
        isFallback: !repository,
      };
    },

    async rankings({ period = "now", store = "all", page = 1, limit = 20 } = {}) {
      const games = (await source.listGames()).filter((game) => storeMatches(game, store));
      const field = period === "all-time" ? "historicalPopularity" : "score";
      const ranked = games
        .sort((a, b) => b[field] - a[field])
        .map((game, index) => rankingView(game, index, field));
      const start = (page - 1) * limit;
      return {
        items: ranked.slice(start, start + limit),
        pagination: { page, limit, total: ranked.length, pages: Math.ceil(ranked.length / limit) },
        period,
        store,
        updatedAt: mockUpdatedAt,
        sourceStatus: { steam: "fresh", epic: "fresh", igdb: "fresh" },
      };
    },

    async games({ q = "", genre, store = "all", sort = "popularity", page = 1, limit = 12 } = {}) {
      const normalizedQuery = q.trim().toLocaleLowerCase("pt-BR");
      let games = (await source.listGames()).filter((game) => {
        const matchesQuery = !normalizedQuery || game.title.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
        const matchesGenre = !genre || game.genres.some((item) => item.toLocaleLowerCase("pt-BR") === genre.toLocaleLowerCase("pt-BR"));
        return matchesQuery && matchesGenre && storeMatches(game, store);
      });
      games = [...games].sort((a, b) =>
        sort === "name" ? a.title.localeCompare(b.title, "pt-BR") : b.score - a.score,
      );
      const start = (page - 1) * limit;
      return {
        items: games.slice(start, start + limit),
        pagination: { page, limit, total: games.length, pages: Math.ceil(games.length / limit) },
        filters: { q, genre: genre ?? null, store, sort },
      };
    },

    async game(slug) {
      const game = (await source.listGames()).find((item) => item.slug === slug);
      return game ? { ...game, updatedAt: mockUpdatedAt } : null;
    },

    async gameHistory(slug, { days = 90 } = {}) {
      if (!repository?.getPopularityHistory) {
        return { slug, days, points: mockHistoryFor(slug), sourceStatus: { steam: "fresh", epic: "fresh" }, updatedAt: mockUpdatedAt };
      }
      const rows = await repository.getPopularityHistory(slug, { days });
      return {
        slug,
        days,
        points: buildPopularityHistory(rows),
        sourceStatus: { steam: "fresh", epic: "fresh" },
        updatedAt: new Date().toISOString(),
      };
    },

    async promotions({ store = "all", filter = "all", page = 1, limit = 20 } = {}) {
      const games = (await source.listGames()).filter((game) => storeMatches(game, store));
      const withPromotion = games
        .map((game) => ({ ...game, promotion: bestPromotion(game.prices) }))
        .filter((game) => game.promotion && matchesPromoFilter(game.promotion, filter))
        .sort((a, b) => (Number(b.promotion.isFree) - Number(a.promotion.isFree)) || (b.promotion.discountPercent - a.promotion.discountPercent));
      const start = (page - 1) * limit;
      return {
        items: withPromotion.slice(start, start + limit),
        pagination: { page, limit, total: withPromotion.length, pages: Math.ceil(withPromotion.length / limit) },
        filters: { store, filter },
        sourceStatus: { steam: "fresh", epic: "partial" },
        updatedAt: mockUpdatedAt,
      };
    },
  };
}
