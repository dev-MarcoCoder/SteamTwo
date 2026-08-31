import { config } from "../config.js";
import { createEpicClient, createIgdbClient, createSteamClient } from "../integrations/index.js";
import { syncCatalog, syncPopularity, syncRankings } from "./index.js";

const command = process.argv[2];
const commands = new Set(["catalog", "rankings", "popularity"]);

if (!commands.has(command)) {
  console.error("Uso: node server/jobs/cli.js <catalog|rankings|popularity>");
  process.exitCode = 1;
} else {
  try {
    // O repositório é separado do job para deixar integrações testáveis e
    // permitir que a camada PostgreSQL defina transações e advisory locks.
    const module = await import("../db/job-repository.js");
    const repository = await module.createJobRepository({ databaseUrl: config.databaseUrl });
    const igdb = createIgdbClient({ clientId: config.twitchClientId, clientSecret: config.twitchClientSecret });
    const steam = createSteamClient({ countryCode: config.steamCountry });
    const epic = createEpicClient({ locale: config.epicLocale });
    const result = command === "catalog"
      ? await syncCatalog({ repository, igdb })
      : command === "popularity"
        ? await syncPopularity({ repository, igdb })
        : await syncRankings({ repository, steam, epic });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`Falha no sync ${command}: ${error.message}`);
    process.exitCode = 1;
  }
}
