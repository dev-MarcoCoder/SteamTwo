import { requestJson } from "./http.js";
import { normalizeSteamEntries } from "./normalizers.js";

const BASE_URL = "https://api.steampowered.com/ISteamChartsService";

export function createSteamClient({ countryCode = "BR", fetchImpl } = {}) {
  async function get(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}/${endpoint}/v1/`);
    Object.entries({ cc: countryCode, ...params }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
    return requestJson(url, { service: "steam", fetchImpl });
  }

  return {
    async getGamesByConcurrentPlayers({ limit = 100 } = {}) {
      const payload = await get("GetGamesByConcurrentPlayers", { limit });
      return normalizeSteamEntries(payload, "concurrent_players");
    },
    async getMostPlayedGames({ limit = 100 } = {}) {
      const payload = await get("GetMostPlayedGames", { limit });
      return normalizeSteamEntries(payload, "most_played_rank");
    },
  };
}
