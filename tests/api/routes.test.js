import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { createApiRouter } from "../../server/routes/index.js";

const app = createApp({ apiRouter: createApiRouter() });

describe("SteamTwo API", () => {
  it("entrega o dashboard completo", async () => {
    const response = await request(app).get("/api/dashboard").expect(200);
    expect(response.body.hero.title).toBeTruthy();
    expect(response.body.topFive).toHaveLength(5);
    expect(response.body.sourceStatus.steam).toBe("fresh");
  });

  it("filtra catálogo por loja e busca", async () => {
    const response = await request(app)
      .get("/api/games")
      .query({ store: "epic", q: "cyberpunk" })
      .expect(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].slug).toBe("cyberpunk-2077");
  });

  it("rejeita período inválido", async () => {
    await request(app).get("/api/rankings?period=ontem").expect(400);
  });

  it("retorna 404 para jogo ausente", async () => {
    await request(app).get("/api/games/jogo-inexistente").expect(404);
  });
});
