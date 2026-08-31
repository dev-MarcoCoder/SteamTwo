# Contratos esperados pelos jobs

Os jobs não dependem de uma implementação específica de PostgreSQL. O módulo de
repositório injetado deve oferecer as operações abaixo; cada operação deve ser
atômica/idempotente para a `source` e `capturedAt` recebidas.

```js
repository.withAdvisoryLock(lockKey, async () => result) // retorna false se o lock não foi adquirido
repository.startSyncRun({ job, startedAt }) // -> { id }
repository.finishSyncRun({ id, status, finishedAt, records, error })
repository.upsertCatalogGames(games, { source, capturedAt })
repository.replaceRankingSnapshot({ source, capturedAt, entries })
repository.upsertHistoricalPopularity(entries, { capturedAt })
```

`withAdvisoryLock` deve usar `pg_advisory_lock` ou `pg_try_advisory_lock` no
mesmo client durante todo o callback. `replaceRankingSnapshot` deve substituir
as entradas apenas do snapshot informado (não apagar o último snapshot válido).
O job pode receber uma implementação mais rica: os métodos extras não são
chamados aqui. Para executar os CLIs, crie `server/db/job-repository.js` com
`export async function createJobRepository()` retornando esse contrato.
