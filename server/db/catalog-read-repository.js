function mapGame(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    coverUrl: row.coverUrl,
    heroUrl: row.heroUrl,
    genres: row.genres ?? [],
    releaseDate: row.releaseDate,
    stores: row.stores ?? [],
    score: Number(row.score ?? row.historicalPopularity ?? 0),
    trend: Number(row.trend ?? 0),
    currentPlayers: row.currentPlayers == null ? null : Number(row.currentPlayers),
    historicalPopularity: Number(row.historicalPopularity ?? 0),
    prices: row.prices ?? [],
  };
}

export function createCatalogReadRepository(pool) {
  return {
    async listGames() {
      const result = await pool.query(`
        SELECT
          g.id,
          g.slug,
          g.title,
          g.summary,
          g.cover_url AS "coverUrl",
          g.hero_url AS "heroUrl",
          g.released_at AS "releaseDate",
          g.igdb_popularity AS "historicalPopularity",
          current_ranking.score,
          current_ranking.trend,
          steam_metric.concurrent_players AS "currentPlayers",
          COALESCE(
            array_agg(DISTINCT ge.name) FILTER (WHERE ge.name IS NOT NULL),
            '{}'
          ) AS genres,
          COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object(
              'store', sl.store,
              'label', CASE WHEN sl.store = 'steam' THEN 'Steam' ELSE 'Epic Games' END,
              'url', sl.url
            )) FILTER (WHERE sl.id IS NOT NULL),
            '[]'::jsonb
          ) AS stores,
          COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object(
              'store', sl.store,
              'currency', sp.currency,
              'initialAmount', sp.initial_amount,
              'finalAmount', sp.final_amount,
              'discountPercent', sp.discount_percent,
              'isFree', sp.is_free
            )) FILTER (WHERE sp.store_listing_id IS NOT NULL),
            '[]'::jsonb
          ) AS prices
        FROM games g
        LEFT JOIN game_genres gg ON gg.game_id = g.id
        LEFT JOIN genres ge ON ge.id = gg.genre_id
        LEFT JOIN store_listings sl ON sl.game_id = g.id
        LEFT JOIN store_prices sp ON sp.store_listing_id = sl.id
        LEFT JOIN LATERAL (
          SELECT score, trend
          FROM game_rankings
          WHERE game_id = g.id AND period = 'now' AND store = 'all'
          ORDER BY as_of DESC
          LIMIT 1
        ) current_ranking ON true
        LEFT JOIN LATERAL (
          SELECT re.concurrent_players
          FROM ranking_entries re
          JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
          WHERE re.game_id = g.id AND rs.source = 'steam' AND rs.status = 'success'
          ORDER BY rs.captured_at DESC
          LIMIT 1
        ) steam_metric ON true
        GROUP BY g.id, current_ranking.score, current_ranking.trend, steam_metric.concurrent_players
        ORDER BY COALESCE(current_ranking.score, g.igdb_popularity, 0) DESC, g.title ASC
      `);
      return result.rows.map(mapGame);
    },

    async getPopularityHistory(slug, { days = 90 } = {}) {
      const result = await pool.query(`
        SELECT rs.source, rs.captured_at AS "capturedAt", rs.total_entries AS "totalEntries", re.position
        FROM games g
        JOIN ranking_snapshots rs ON rs.status = 'success' AND rs.captured_at >= now() - make_interval(days => $2::int)
        LEFT JOIN ranking_entries re ON re.snapshot_id = rs.id AND re.game_id = g.id
        WHERE g.slug = $1
        ORDER BY rs.captured_at ASC
      `, [slug, days]);
      return result.rows.map((row) => ({ ...row, position: row.position == null ? null : Number(row.position) }));
    },
  };
}

