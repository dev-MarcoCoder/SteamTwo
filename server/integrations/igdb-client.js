import { requestJson } from "./http.js";
import { normalizeIgdbGame } from "./normalizers.js";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.igdb.com/v4";

export function createIgdbClient({ clientId, clientSecret, fetchImpl, now = () => Date.now() } = {}) {
  let token = null;
  let tokenExpiresAt = 0;

  async function accessToken() {
    if (token && now() < tokenExpiresAt - 60_000) return token;
    if (!clientId || !clientSecret) throw new Error("TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET são obrigatórios para IGDB");
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" });
    const response = await requestJson(TOKEN_URL, {
      service: "twitch",
      fetchImpl,
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      retries: 1,
    });
    token = response.access_token;
    tokenExpiresAt = now() + Number(response.expires_in ?? 0) * 1000;
    if (!token) throw new Error("Twitch não retornou access_token");
    return token;
  }

  async function query(endpoint, query) {
    const bearerToken = await accessToken();
    return requestJson(`${API_URL}/${endpoint}`, {
      service: "igdb",
      fetchImpl,
      method: "POST",
      headers: { "Client-ID": clientId, Authorization: `Bearer ${bearerToken}`, Accept: "application/json" },
      body: query,
    });
  }

  return {
    query,
    async listCatalog({ limit = 100, offset = 0, updatedAfter } = {}) {
      const filter = updatedAfter ? ` & updated_at > ${Math.floor(new Date(updatedAfter).getTime() / 1000)}` : "";
      const result = await query("games", `fields id,name,slug,summary,storyline,first_release_date,popularity,cover.image_id,screenshots.image_id,genres.id,genres.name,external_games.category,external_games.uid; where version_parent = null${filter}; sort popularity desc; limit ${limit}; offset ${offset};`);
      return result.map(normalizeIgdbGame);
    },
    async listHistoricalPopularity({ limit = 100, offset = 0 } = {}) {
      const result = await query("games", `fields id,name,slug,popularity,cover.image_id,genres.id,genres.name,external_games.category,external_games.uid; where version_parent = null; sort popularity desc; limit ${limit}; offset ${offset};`);
      return result.map(normalizeIgdbGame);
    },
  };
}
