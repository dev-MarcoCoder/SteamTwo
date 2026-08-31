import { createPool, withTransaction } from "./pool.js";
import { createRepositories } from "./repositories.js";

function genreSlug(name) {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function storeUrl(store, externalId, suppliedUrl) {
  if (suppliedUrl) return suppliedUrl;
  return store === "steam"
    ? `https://store.steampowered.com/app/${encodeURIComponent(externalId)}`
    : `https://store.epicgames.com/p/${encodeURIComponent(externalId)}`;
}

function toGameInput(game, source) {
  const igdbId = source === "igdb" && /^\d+$/.test(String(game.externalId))
    ? Number(game.externalId)
    : null;
  return {
    slug: game.slug || `${source}-${game.externalId}`,
    title: game.title || `Jogo ${game.externalId}`,
    summary: game.summary || null,
    coverUrl: game.coverUrl || null,
    heroUrl: game.heroUrl || null,
    igdbId,
    igdbPopularity: Number.isFinite(game.popularity) ? game.popularity : null,
    releasedAt: game.releaseDate || null,
  };
}

/**
 * PostgreSQL implementation used by the sync CLIs. `activeClient` makes the
 * advisory lock session-scoped and serializes the two source snapshots that a
 * rankings job intentionally submits with Promise.all.
 */
export async function createJobRepository({ databaseUrl, pool: suppliedPool } = {}) {
  const pool = suppliedPool ?? createPool(databaseUrl, { allowExitOnIdle: true });
  const repositories = createRepositories(pool);
  let activeClient = null;
  let activeQueue = Promise.resolve();

  function enqueue(work) {
    if (!activeClient) return work(pool);
    const result = activeQueue.then(() => work(activeClient));
    activeQueue = result.catch(() => undefined);
    return result;
  }

  async function transaction(clientOrPool, work) {
    if (typeof clientOrPool.connect === "function") return withTransaction(clientOrPool, work);
    await clientOrPool.query("BEGIN");
    try {
      const result = await work(clientOrPool);
      await clientOrPool.query("COMMIT");
      return result;
    } catch (error) {
      await clientOrPool.query("ROLLBACK");
      throw error;
    }
  }

  async function catalogUpsert(client, games, source) {
    const saved = [];
    for (const game of games) {
      const persisted = await repositories.games.upsert(toGameInput(game, source), client);
      const genres = (game.genres ?? []).map((genre) => ({
        slug: genre.slug || genreSlug(genre.name), name: genre.name,
      })).filter((genre) => genre.slug && genre.name);
      await repositories.games.replaceGenres(persisted.id, genres, client);
      for (const listing of game.stores ?? []) {
        await repositories.games.upsertListing({
          gameId: persisted.id,
          store: listing.store,
          externalId: listing.externalId,
          url: storeUrl(listing.store, listing.externalId, listing.url),
        }, client);
      }
      saved.push(persisted);
    }
    return saved;
  }

  return {
    async withAdvisoryLock(lockKey, callback) {
      const client = await pool.connect();
      try {
        const lock = await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS acquired", [lockKey]);
        if (!lock.rows[0]?.acquired) return false;
        activeClient = client;
        activeQueue = Promise.resolve();
        try {
          const result = await callback();
          await activeQueue;
          return result;
        } finally {
          activeClient = null;
          await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
        }
      } finally {
        client.release();
      }
    },

    async startSyncRun({ job, startedAt }) {
      return enqueue(async (client) => {
        const source = job === "catalog" || job === "popularity" ? "igdb" : job;
        const result = await client.query(`INSERT INTO sync_runs (job, source, state, started_at, details)
          VALUES ($1, $2, 'running', $3, '{}'::jsonb) RETURNING id`, [job, source, startedAt]);
        return result.rows[0];
      });
    },

    async finishSyncRun({ id, status, finishedAt, records = 0, error = null }) {
      if (!id) return null;
      return enqueue(async (client) => {
        const state = status === "success" ? "success" : "failed";
        const result = await client.query(`UPDATE sync_runs
          SET state = $2, finished_at = $3, details = jsonb_build_object('records', $4), error_message = $5
          WHERE id = $1 RETURNING id, state`, [id, state, finishedAt, records, error]);
        return result.rows[0] ?? null;
      });
    },

    async upsertCatalogGames(games, { source = "igdb" } = {}) {
      return enqueue((clientOrPool) => transaction(clientOrPool, (client) => catalogUpsert(client, games, source)));
    },

    async replaceRankingSnapshot({ source, capturedAt, entries }) {
      return enqueue((clientOrPool) => transaction(clientOrPool, async (client) => {
        const existing = await client.query(`SELECT id FROM ranking_snapshots
          WHERE source = $1 AND captured_at = $2`, [source, capturedAt]);
        // Snapshots are immutable: the first fully committed write wins. A retry
        // for the same capture instant therefore becomes a harmless no-op.
        if (existing.rows[0]) return { id: existing.rows[0].id, inserted: false };

        const known = await client.query(`SELECT external_id AS "externalId", game_id AS "gameId"
          FROM store_listings WHERE store = $1 AND external_id = ANY($2::text[])`, [source, entries.map((entry) => String(entry.externalId))]);
        const gameByExternalId = new Map(known.rows.map((row) => [row.externalId, row.gameId]));
        const snapshot = await client.query(`INSERT INTO ranking_snapshots (source, status, captured_at, total_entries)
          VALUES ($1, 'success', $2, $3) RETURNING id`, [source, capturedAt, entries.length]);
        for (const entry of entries) {
          const gameId = gameByExternalId.get(String(entry.externalId));
          if (!gameId) continue;
          await client.query(`INSERT INTO ranking_entries (snapshot_id, game_id, position, concurrent_players, metadata)
            VALUES ($1, $2, $3, $4, $5::jsonb)`, [
            snapshot.rows[0].id, gameId, entry.rank, entry.metric ?? null,
            JSON.stringify({ metricName: entry.metricName ?? null, externalId: String(entry.externalId) }),
          ]);
        }
        return { id: snapshot.rows[0].id, inserted: true };
      }));
    },

    async upsertHistoricalPopularity(entries, { capturedAt } = {}) {
      return enqueue((clientOrPool) => transaction(clientOrPool, async (client) => {
        const saved = await catalogUpsert(client, entries, "igdb");
        for (const game of entries) {
          if (!/^\d+$/.test(String(game.externalId))) continue;
          await client.query(`UPDATE games SET igdb_popularity = $2, updated_at = now()
            WHERE igdb_id = $1`, [Number(game.externalId), Number.isFinite(game.popularity) ? game.popularity : 0]);
        }
        return { records: saved.length, capturedAt };
      }));
    },

    async close() {
      await pool.end();
    },
  };
}
