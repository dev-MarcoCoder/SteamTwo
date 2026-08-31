/**
 * Base schema for the SteamTwo catalogue. Ranking snapshots are append-only:
 * an incorrect import is represented by a new snapshot rather than editing
 * historic evidence.
 */
export async function up(pgm) {
  pgm.createExtension("pgcrypto", { ifNotExists: true });
  pgm.createTable("games", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    slug: { type: "text", notNull: true, unique: true },
    title: { type: "text", notNull: true },
    summary: { type: "text" },
    cover_url: { type: "text" },
    hero_url: { type: "text" },
    igdb_id: { type: "integer", unique: true },
    igdb_popularity: { type: "numeric(14,4)" },
    released_at: { type: "date" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("genres", {
    id: { type: "serial", primaryKey: true },
    slug: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true, unique: true },
  });
  pgm.createTable("game_genres", {
    game_id: { type: "uuid", notNull: true, references: '"games"', onDelete: "cascade" },
    genre_id: { type: "integer", notNull: true, references: '"genres"', onDelete: "cascade" },
  }, { constraints: { primaryKey: ["game_id", "genre_id"] } });

  pgm.createType("store_name", ["steam", "epic"]);
  pgm.createTable("store_listings", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    game_id: { type: "uuid", notNull: true, references: '"games"', onDelete: "cascade" },
    store: { type: "store_name", notNull: true },
    external_id: { type: "text", notNull: true },
    url: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, { constraints: { unique: ["store", "external_id"] } });
  pgm.addConstraint("store_listings", "store_listings_game_store_unique", "UNIQUE (game_id, store)");

  pgm.createType("sync_state", ["running", "success", "failed"]);
  pgm.createTable("sync_runs", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    job: { type: "text", notNull: true },
    source: { type: "text", notNull: true },
    state: { type: "sync_state", notNull: true, default: "running" },
    started_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    finished_at: { type: "timestamptz" },
    details: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
    error_message: { type: "text" },
  });

  pgm.createType("snapshot_status", ["success", "outage"]);
  pgm.createTable("ranking_snapshots", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    source: { type: "store_name", notNull: true },
    status: { type: "snapshot_status", notNull: true },
    captured_at: { type: "timestamptz", notNull: true },
    total_entries: { type: "integer", notNull: true, default: 0, check: "total_entries >= 0" },
    sync_run_id: { type: "uuid", references: '"sync_runs"', onDelete: "set null" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  }, { constraints: { unique: ["source", "captured_at"] } });
  pgm.createIndex("ranking_snapshots", ["source", { name: "captured_at", sort: "DESC" }]);

  pgm.createTable("ranking_entries", {
    snapshot_id: { type: "uuid", notNull: true, references: '"ranking_snapshots"', onDelete: "cascade" },
    game_id: { type: "uuid", notNull: true, references: '"games"', onDelete: "restrict" },
    position: { type: "integer", notNull: true, check: "position > 0" },
    concurrent_players: { type: "integer", check: "concurrent_players >= 0" },
    metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
  }, { constraints: { primaryKey: ["snapshot_id", "game_id"], unique: ["snapshot_id", "position"] } });
  pgm.createIndex("ranking_entries", ["game_id"]);

  pgm.createType("ranking_period", ["now", "week", "all-time"]);
  pgm.createTable("game_rankings", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    period: { type: "ranking_period", notNull: true },
    store: { type: "text", notNull: true, check: "store IN ('all', 'steam', 'epic', 'igdb')" },
    game_id: { type: "uuid", notNull: true, references: '"games"', onDelete: "cascade" },
    rank: { type: "integer", notNull: true, check: "rank > 0" },
    score: { type: "numeric(14,4)" },
    metric: { type: "numeric(16,4)" },
    trend: { type: "integer", notNull: true, default: 0 },
    source: { type: "text", notNull: true, default: "steamtwo" },
    as_of: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("game_rankings", "game_rankings_game_unique", "UNIQUE (period, store, game_id, as_of)");
  pgm.addConstraint("game_rankings", "game_rankings_position_unique", "UNIQUE (period, store, rank, as_of)");
  pgm.createIndex("game_rankings", ["period", "store", { name: "as_of", sort: "DESC" }, "rank"]);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION steamtwo_prevent_snapshot_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'ranking snapshots are immutable';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER ranking_snapshots_immutable
      BEFORE UPDATE OR DELETE ON ranking_snapshots
      FOR EACH ROW EXECUTE FUNCTION steamtwo_prevent_snapshot_mutation();
    CREATE TRIGGER ranking_entries_immutable
      BEFORE UPDATE OR DELETE ON ranking_entries
      FOR EACH ROW EXECUTE FUNCTION steamtwo_prevent_snapshot_mutation();
  `);
}

export async function down(pgm) {
  pgm.sql("DROP FUNCTION IF EXISTS steamtwo_prevent_snapshot_mutation() CASCADE");
  pgm.dropTable("game_rankings");
  pgm.dropTable("ranking_entries");
  pgm.dropTable("ranking_snapshots");
  pgm.dropTable("sync_runs");
  pgm.dropTable("store_listings");
  pgm.dropTable("game_genres");
  pgm.dropTable("genres");
  pgm.dropTable("games");
  pgm.dropType("ranking_period");
  pgm.dropType("snapshot_status");
  pgm.dropType("sync_state");
  pgm.dropType("store_name");
  pgm.dropExtension("pgcrypto", { ifExists: true });
}
