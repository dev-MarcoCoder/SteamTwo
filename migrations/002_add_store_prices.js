/**
 * Current-state pricing per store listing. Unlike ranking snapshots, price
 * status is not append-only history — only the latest checked value matters
 * for the promotions feature, so a single upserted row per listing is enough.
 */
export async function up(pgm) {
  pgm.createTable("store_prices", {
    store_listing_id: { type: "uuid", primaryKey: true, references: '"store_listings"', onDelete: "cascade" },
    currency: { type: "text", notNull: true, default: "BRL" },
    initial_amount: { type: "integer" },
    final_amount: { type: "integer" },
    discount_percent: { type: "integer", notNull: true, default: 0, check: "discount_percent BETWEEN 0 AND 100" },
    is_free: { type: "boolean", notNull: true, default: false },
    checked_at: { type: "timestamptz", notNull: true },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("store_prices", ["discount_percent"]);
  pgm.createIndex("store_prices", ["is_free"]);
}

export async function down(pgm) {
  pgm.dropTable("store_prices");
}
