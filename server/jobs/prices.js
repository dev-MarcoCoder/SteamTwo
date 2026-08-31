import { runLockedSync } from "./run-job.js";

const CONCURRENCY = 4;
const THROTTLE_MS = 250;

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  for (let index = 0; index < items.length; index += limit) {
    const batch = items.slice(index, index + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    results.push(...settled.filter((result) => result.status === "fulfilled").map((result) => result.value));
    if (index + limit < items.length) await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS));
  }
  return results.filter(Boolean);
}

export async function syncPrices({ repository, steam, epic, now } = {}) {
  if (!repository?.listStoreListings || !steam?.getAppPrice || !epic?.getFreeGamesPromotions) {
    throw new Error("repository, steam.getAppPrice e epic.getFreeGamesPromotions são obrigatórios");
  }
  return runLockedSync({
    repository,
    job: "prices",
    lockKey: "steamtwo:sync:prices",
    now,
    execute: async ({ capturedAt }) => {
      const [steamListings, epicListings] = await Promise.all([
        repository.listStoreListings("steam"),
        repository.listStoreListings("epic"),
      ]);
      const steamPrices = await mapWithConcurrency(steamListings, CONCURRENCY, async (listing) => {
        const price = await steam.getAppPrice(listing.externalId);
        return price && { ...price, listingId: listing.listingId };
      });
      const epicPromotions = await epic.getFreeGamesPromotions();
      const epicByExternalId = new Map(epicPromotions.map((promotion) => [promotion.externalId, promotion]));
      const epicPrices = epicListings
        .map((listing) => {
          const promotion = epicByExternalId.get(listing.externalId);
          return promotion && { ...promotion, listingId: listing.listingId };
        })
        .filter(Boolean);
      const entries = [...steamPrices, ...epicPrices];
      await repository.upsertPrices(entries, { capturedAt });
      return { records: entries.length, capturedAt, sources: { steam: steamPrices.length, epic: epicPrices.length } };
    },
  });
}
