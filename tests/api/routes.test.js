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

  it("retorna histórico de popularidade de um jogo", async () => {
    const response = await request(app).get("/api/games/elden-ring/history").expect(200);
    expect(response.body.slug).toBe("elden-ring");
    expect(response.body.points.length).toBeGreaterThan(1);
    expect(response.body.points[0]).toHaveProperty("score");
  });

  it("retorna 404 de histórico para jogo ausente", async () => {
    await request(app).get("/api/games/jogo-inexistente/history").expect(404);
  });

  it("filtra promoções grátis", async () => {
    const response = await request(app).get("/api/promotions").query({ filter: "free" }).expect(200);
    expect(response.body.items.every((item) => item.promotion.isFree)).toBe(true);
    expect(response.body.items.some((item) => item.slug === "counter-strike-2")).toBe(true);
  });

  it("filtra promoções de metade do preço ou mais, excluindo descontos menores", () => {
    return request(app).get("/api/promotions").query({ filter: "half-price" }).expect(200).then((response) => {
      expect(response.body.items.some((item) => item.slug === "hades-2")).toBe(true);
      expect(response.body.items.some((item) => item.slug === "black-myth-wukong")).toBe(false);
    });
  });

  it("filtra promoções em qualquer desconto e respeita a loja", async () => {
    const response = await request(app).get("/api/promotions").query({ filter: "on-sale", store: "steam" }).expect(200);
    expect(response.body.items.some((item) => item.slug === "black-myth-wukong")).toBe(true);
  });

  it("filtra promoções por gênero/categoria", async () => {
    const response = await request(app).get("/api/promotions").query({ genre: "RPG" }).expect(200);
    expect(response.body.items.some((item) => item.slug === "black-myth-wukong")).toBe(true);
    expect(response.body.items.some((item) => item.slug === "hades-2")).toBe(false);
    expect(response.body.items.every((item) => item.genres.includes("RPG"))).toBe(true);
  });
});
