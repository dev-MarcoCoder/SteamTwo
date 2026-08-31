function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function toSlug(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function igdbImageUrl(imageId, size = "cover_big") {
  if (!imageId) return null;
  if (/^https?:\/\//.test(imageId)) return imageId;
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function normalizeIgdbGame(game) {
  const steamId = game.external_games?.find((item) => item.category === 1)?.uid;
  const epicId = game.external_games?.find((item) => item.category === 26)?.uid;
  const title = cleanText(game.name);
  return {
    source: "igdb",
    externalId: String(game.id),
    title,
    slug: toSlug(game.slug || title),
    summary: cleanText(game.summary || game.storyline),
    coverUrl: igdbImageUrl(game.cover?.image_id),
    heroUrl: igdbImageUrl(game.screenshots?.[0]?.image_id, "screenshot_huge"),
    genres: (game.genres ?? []).map((genre) => ({ externalId: String(genre.id), name: cleanText(genre.name) })).filter((genre) => genre.name),
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString() : null,
    popularity: Number(game.popularity ?? game.popularity_primitives?.popularity ?? 0) || 0,
    stores: [
      steamId && { store: "steam", externalId: String(steamId) },
      epicId && { store: "epic", externalId: String(epicId) },
    ].filter(Boolean),
  };
}

export function normalizeSteamEntries(payload, metric = "concurrent_players") {
  const items = payload?.response?.ranks ?? payload?.response?.items ?? payload?.ranks ?? payload?.items ?? [];
  return items.map((item, index) => ({
    store: "steam",
    externalId: String(item.appid ?? item.app_id ?? item.id),
    title: cleanText(item.name ?? item.app_name),
    rank: Number(item.rank ?? index + 1),
    metric: Number(item.concurrent_in_game ?? item.player_count ?? item.current_players ?? item.peak_in_game ?? 0) || null,
    metricName: metric,
  })).filter((item) => item.externalId && item.externalId !== "undefined");
}

export function normalizeEpicEntries(items) {
  return items.map((item, index) => ({
    store: "epic",
    externalId: String(item.id ?? item.productSlug ?? item.slug ?? toSlug(item.title ?? item.name)),
    title: cleanText(item.title ?? item.name),
    rank: Number(item.rank ?? index + 1),
    metric: null,
    metricName: "position",
    url: item.url ?? item.productSlug ? `https://store.epicgames.com/p/${item.url ?? item.productSlug}` : null,
  })).filter((item) => item.externalId && item.title);
}
