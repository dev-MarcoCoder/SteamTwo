import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createEpicClient, createIgdbClient, createSteamClient, parseEgdataMostPlayed, parseEpicMostPlayed, requestJson } from "../../server/integrations/index.js";

const fixture = async (name) => JSON.parse(await readFile(new URL(`../fixtures/${name}`, import.meta.url)));
const fixtureText = (name) => readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

function response(value) {
  return { ok: true, json: async () => value, text: async () => value };
}

describe("IGDB client", () => {
  it("obtém token, normaliza o catálogo e reutiliza o token", async () => {
    const token = await fixture("igdb-token.json");
    const games = await fixture("igdb-games.json");
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(token))
      .mockResolvedValueOnce(response(games))
      .mockResolvedValueOnce(response(games));
    const client = createIgdbClient({ clientId: "client", clientSecret: "secret", fetchImpl, now: () => 1_000 });
    const catalog = await client.listCatalog();
    await client.listHistoricalPopularity();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(catalog[0]).toMatchObject({ externalId: "7346", title: "Hades", popularity: 88.4 });
    expect(catalog[0].stores).toEqual([{ store: "steam", externalId: "1145360" }, { store: "epic", externalId: "hades" }]);
    expect(catalog[0].coverUrl).toContain("co1r7f");
  });
});

describe("Steam client", () => {
  it("normaliza os dois endpoints de ranking", async () => {
    const concurrent = await fixture("steam-concurrent.json");
    const mostPlayed = await fixture("steam-most-played.json");
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(concurrent)).mockResolvedValueOnce(response(mostPlayed));
    const client = createSteamClient({ fetchImpl, countryCode: "BR" });
    const current = await client.getGamesByConcurrentPlayers();
    const popular = await client.getMostPlayedGames();
    expect(current[0]).toMatchObject({ externalId: "730", rank: 1, metric: 1200000 });
    expect(popular[1]).toMatchObject({ externalId: "570", metricName: "most_played_rank", metric: 720000 });
    expect(String(fetchImpl.mock.calls[0][0])).toContain("ISteamChartsService/GetGamesByConcurrentPlayers");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("cc=BR");
  });
});

describe("Epic client", () => {
  it("lê a coleção pública embutida sem inventar contagem de jogadores", async () => {
    const html = await fixtureText("epic-most-played.html");
    expect(parseEpicMostPlayed(html)).toEqual([
      expect.objectContaining({ externalId: "fortnite", title: "Fortnite", rank: 1, metric: null }),
      expect.objectContaining({ externalId: "rocket-league", title: "Rocket League®", rank: 2, metric: null }),
    ]);
    const client = createEpicClient({ fetchImpl: vi.fn().mockResolvedValue(response(html)) });
    expect(await client.getMostPlayedGames()).toHaveLength(2);
  });

  it.each([403, 429])("usa egdata quando a coleção oficial devolve HTTP %i", async (status) => {
    const fallbackHtml = await fixtureText("egdata-most-played.html");
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status })
      .mockResolvedValueOnce(response(fallbackHtml));
    const entries = await createEpicClient({ fetchImpl }).getMostPlayedGames();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(entries).toEqual([
      expect.objectContaining({ externalId: "fortnite", rank: 1, metric: null, provider: "egdata-fallback" }),
      expect.objectContaining({ externalId: "rocket-league", rank: 2, metric: null, provider: "egdata-fallback" }),
    ]);
  });

  it("lê links, posição e h3 do fallback sem atribuir jogadores", async () => {
    const html = await fixtureText("egdata-most-played.html");
    expect(parseEgdataMostPlayed(html)).toEqual([
      expect.objectContaining({ title: "Fortnite", rank: 1, metric: null, provider: "egdata-fallback" }),
      expect.objectContaining({ title: "Rocket League", rank: 2, metric: null, provider: "egdata-fallback" }),
    ]);
  });
});

describe("transporte externo", () => {
  it("repete respostas transitórias sem repetir um HTTP 4xx", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(response({ ok: true }));
    await expect(requestJson("https://example.test", { fetchImpl, retries: 1, retryDelayMs: 0 })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
