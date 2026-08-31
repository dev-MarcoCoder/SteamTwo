import * as cheerio from "cheerio";
import { requestText } from "./http.js";
import { normalizeEpicEntries } from "./normalizers.js";

const EGDATA_MOST_PLAYED_URL = "https://egdata.app/collections/most-played";

function walk(value, items) {
  if (Array.isArray(value)) return value.forEach((entry) => walk(entry, items));
  if (!value || typeof value !== "object") return;
  const title = value.title ?? value.name;
  if (typeof title === "string" && (value.productSlug || value.url || value.namespace || value.id)) items.push(value);
  Object.values(value).forEach((entry) => walk(entry, items));
}

function uniqueGames(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item.id ?? item.productSlug ?? item.url ?? item.title;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Parses the public collection markup and its embedded Next.js state. */
export function parseEpicMostPlayed(html) {
  const $ = cheerio.load(html);
  const candidates = [];
  $("[data-testid*='offer'], a[href*='/p/']").each((_index, element) => {
    const anchor = $(element).is("a") ? $(element) : $(element).find("a").first();
    const title = anchor.attr("aria-label") || $(element).find("h2,h3").first().text() || anchor.text();
    const href = anchor.attr("href");
    if (title && href) candidates.push({ title, url: href.replace(/^.*\/p\//, "") });
  });
  $("script[type='application/json'], script#__NEXT_DATA__").each((_index, element) => {
    try { walk(JSON.parse($(element).text()), candidates); } catch { /* unrelated embedded script */ }
  });
  return normalizeEpicEntries(uniqueGames(candidates));
}

/**
 * Parses egdata's public ranking cards. It deliberately uses only the visible
 * offer link, heading, and rank: egdata does not expose a player count here.
 */
export function parseEgdataMostPlayed(html) {
  const $ = cheerio.load(html);
  const candidates = [];
  $("a[href*='/offers/']").each((_index, anchor) => {
    const link = $(anchor);
    const href = link.attr("href") ?? "";
    const slug = href.split("/offers/")[1]?.split(/[?#]/)[0];
    const card = link.closest("article, li, [data-rank], [class*='rank']").first();
    const title = link.find("h3").first().text().trim()
      || card.find("h3").first().text().trim()
      || link.attr("aria-label")?.trim();
    const rankText = card.attr("data-rank")
      || link.attr("data-rank")
      || link.find("span").first().text()
      || card.find("[data-rank], [class*='rank']").first().text()
      || card.text();
    const rank = Number(rankText.match(/(?:^|\D)(\d{1,3})(?:\D|$)/)?.[1]);
    if (slug && title && Number.isFinite(rank)) candidates.push({ id: slug, title, rank, url: slug });
  });
  return normalizeEpicEntries(uniqueGames(candidates)).map((entry) => ({
    ...entry,
    provider: "egdata-fallback",
    metric: null,
  }));
}

export function createEpicClient({ locale = "pt-BR", fetchImpl } = {}) {
  return {
    async getMostPlayedGames() {
      const url = `https://store.epicgames.com/${locale}/collection/most-played`;
      try {
        const html = await requestText(url, {
          service: "epic",
          fetchImpl,
          // A throttle response is not retried; we use the public fallback.
          retries: 0,
          headers: { Accept: "text/html", "Accept-Language": locale },
        });
        return parseEpicMostPlayed(html);
      } catch (error) {
        if (error?.status !== 403 && error?.status !== 429) throw error;
        const html = await requestText(EGDATA_MOST_PLAYED_URL, {
          service: "egdata",
          fetchImpl,
          headers: { Accept: "text/html" },
        });
        return parseEgdataMostPlayed(html);
      }
    },
  };
}
