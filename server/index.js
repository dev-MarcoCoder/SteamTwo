import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { createPool } from "./db/pool.js";
import { createCatalogReadRepository } from "./db/catalog-read-repository.js";
import { createApiRouter } from "./routes/index.js";
import { createCatalogService } from "./services/catalog-service.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(rootDir, "dist", "client");
let pool = null;
let catalogRepository = null;

if (config.databaseUrl) {
  pool = createPool(config.databaseUrl);
  catalogRepository = createCatalogReadRepository(pool);
}

const catalogService = createCatalogService({ repository: catalogRepository });
const healthCheck = pool
  ? async () => {
      await pool.query("SELECT 1");
      return { status: "connected" };
    }
  : async () => ({ status: "not-configured", mode: "demo" });

const app = createApp({
  apiRouter: createApiRouter({ catalogService, healthCheck }),
  staticDir: existsSync(staticDir) ? staticDir : undefined,
});

app.listen(config.port, () => {
  console.log(`SteamTwo API disponível na porta ${config.port}`);
});
