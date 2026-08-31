import { withTransaction } from "./pool.js";

const gameColumns = `
  g.id, g.slug, g.title, g.summary, g.cover_url AS "coverUrl", g.hero_url AS "heroUrl",
  g.igdb_id AS "igdbId", g.igdb_popularity AS "igdbPopularity", g.released_at AS "releasedAt",
  COALESCE(array_agg(DISTINCT ge.name) FILTER (WHERE ge.name IS NOT NULL), '{}') AS genres`;

function mapGame(row) {
  return { ...row, igdbPopularity: row.igdbPopularity == null ? null : Number(row.igdbPopularity) };
}

/** Persistence boundary. All methods use placeholders; external API content is never interpolated into SQL. */
export function createRepositories(pool) {
  return {
    games: {
      async upsert(game, client = pool) {
        const result = await client.query(`
          INSERT INTO games (slug, title, summary, cover_url, hero_url, igdb_id, igdb_popularity, released_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (slug) DO UPDATE SET
            title = EXCLUDED.title, summary = EXCLUDED.summary, cover_url = EXCLUDED.cover_url,
            hero_url = EXCLUDED.hero_url, igdb_id = EXCLUDED.igdb_id,
            igdb_popularity = EXCLUDED.igdb_popularity, released_at = EXCLUDED.released_at, updated_at = now()
          RETURNING id, slug, title`, [
          game.slug, game.title, game.summary ?? null, game.coverUrl ?? null, game.heroUrl ?? null,
          game.igdbId ?? null, game.igdbPopularity ?? null, game.releasedAt ?? null,
        ]);
        return result.rows[0];
      },
      async replaceGenres(gameId, genres, client = pool) {
        await client.query("DELETE FROM game_genres WHERE game_id = $1", [gameId]);
        for (const genre of genres) {
          const genreRow = await client.query(`
            INSERT INTO genres (slug, name) VALUES ($1, $2)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id`, [genre.slug, genre.name]);
          await client.query("INSERT INTO game_genres (game_id, genre_id) VALUES ($1, $2)", [gameId, genreRow.rows[0].id]);
        }
      },
      async upsertListing(listing, client = pool) {
        const result = await client.query(`
          INSERT INTO store_listings (game_id, store, external_id, url)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (store, external_id) DO UPDATE SET game_id = EXCLUDED.game_id, url = EXCLUDED.url, updated_at = now()
          RETURNING id, game_id AS "gameId", store, external_id AS "externalId", url`,
        [listing.gameId, listing.store, String(listing.externalId), listing.url]);
        return result.rows[0];
      },
      async getBySlug(slug) {
        const result = await pool.query(`SELECT ${gameColumns}
          FROM games g LEFT JOIN game_genres gg ON gg.game_id = g.id LEFT JOIN genres ge ON ge.id = gg.genre_id
          WHERE g.slug = $1 GROUP BY g.id`, [slug]);
        return result.rows[0] ? mapGame(result.rows[0]) : null;
      },
      async getByStoreIds(store, externalIds) {
        if (!externalIds.length) return [];
        const result = await pool.query(`SELECT sl.external_id AS "externalId", sl.game_id AS "gameId"
          FROM store_listings sl WHERE sl.store = $1 AND sl.external_id = ANY($2::text[])`, [store, externalIds.map(String)]);
        return result.rows;
      },
    },
    snapshots: {
      async insert({ source, status, capturedAt, totalEntries = 0, syncRunId = null, entries = [] }) {
        return withTransaction(pool, async (client) => {
          const snapshot = await client.query(`
            INSERT INTO ranking_snapshots (source, status, captured_at, total_entries, sync_run_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING id, source, status, captured_at AS "capturedAt", total_entries AS "totalEntries"`,
          [source, status, capturedAt, totalEntries, syncRunId]);
          if (status === "outage" && entries.length) throw new Error("Snapshot outage não pode conter entradas");
          for (const entry of entries) {
            await client.query(`INSERT INTO ranking_entries (snapshot_id, game_id, position, concurrent_players, metadata)
              VALUES ($1, $2, $3, $4, $5::jsonb)`, [snapshot.rows[0].id, entry.gameId, entry.position, entry.concurrentPlayers ?? null, JSON.stringify(entry.metadata ?? {})]);
          }
          return snapshot.rows[0];
        });
      },
      async latest(source) {
        const result = await pool.query(`SELECT id, source, status, captured_at AS "capturedAt", total_entries AS "totalEntries"
          FROM ranking_snapshots WHERE source = $1 ORDER BY captured_at DESC LIMIT 1`, [source]);
        return result.rows[0] ?? null;
      },
      async fromRange(source, startAt, endAt) {
        const result = await pool.query(`SELECT s.id, s.source, s.status, s.captured_at AS "capturedAt", s.total_entries AS "totalEntries",
          COALESCE(jsonb_agg(jsonb_build_object('gameId', e.game_id, 'position', e.position, 'concurrentPlayers', e.concurrent_players)
            ORDER BY e.position) FILTER (WHERE e.game_id IS NOT NULL), '[]') AS entries
          FROM ranking_snapshots s LEFT JOIN ranking_entries e ON e.snapshot_id = s.id
          WHERE s.source = $1 AND s.captured_at >= $2 AND s.captured_at <= $3
          GROUP BY s.id ORDER BY s.captured_at ASC`, [source, startAt, endAt]);
        return result.rows;
      },
    },
    rankings: {
      async replace({ period, store = "all", asOf, entries }) {
        return withTransaction(pool, async (client) => {
          await client.query("DELETE FROM game_rankings WHERE period = $1 AND store = $2 AND as_of = $3", [period, store, asOf]);
          for (const entry of entries) {
            await client.query(`INSERT INTO game_rankings (period, store, game_id, rank, score, metric, trend, source, as_of)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [period, store, entry.gameId, entry.rank, entry.score ?? null, entry.metric ?? null, entry.trend ?? 0, entry.source ?? "steamtwo", asOf]);
          }
        });
      },
      async latest({ period, store = "all", limit = 50 }) {
        const result = await pool.query(`
          WITH latest AS (SELECT max(as_of) AS as_of FROM game_rankings WHERE period = $1 AND store = $2)
          SELECT r.rank, r.score, r.metric, r.trend, r.source, r.as_of AS "updatedAt", ${gameColumns}
          FROM game_rankings r JOIN latest l ON r.as_of = l.as_of JOIN games g ON g.id = r.game_id
          LEFT JOIN game_genres gg ON gg.game_id = g.id LEFT JOIN genres ge ON ge.id = gg.genre_id
          WHERE r.period = $1 AND r.store = $2 GROUP BY r.id, g.id ORDER BY r.rank ASC LIMIT $3`, [period, store, limit]);
        return result.rows.map(mapGame);
      },
    },
    syncRuns: {
      async start({ job, source, details = {} }) {
        const result = await pool.query(`INSERT INTO sync_runs (job, source, details) VALUES ($1, $2, $3::jsonb)
          RETURNING id, started_at AS "startedAt"`, [job, source, JSON.stringify(details)]);
        return result.rows[0];
      },
      async finish(id, { state, details = {}, errorMessage = null }) {
        const result = await pool.query(`UPDATE sync_runs SET state = $2, details = $3::jsonb, error_message = $4, finished_at = now()
          WHERE id = $1 RETURNING id, state, finished_at AS "finishedAt"`, [id, state, JSON.stringify(details), errorMessage]);
        return result.rows[0] ?? null;
      },
    },
  };
}
