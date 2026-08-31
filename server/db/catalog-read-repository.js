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
          ) AS stores
        FROM games g
        LEFT JOIN game_genres gg ON gg.game_id = g.id
        LEFT JOIN genres ge ON ge.id = gg.genre_id
        LEFT JOIN store_listings sl ON sl.game_id = g.id
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
  };
}

