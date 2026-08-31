function serializeError(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function runLockedSync({ repository, job, lockKey, now = () => new Date(), execute }) {
  if (!repository?.withAdvisoryLock) throw new Error("repository.withAdvisoryLock é obrigatório para executar sincronizações");
  let wasExecuted = false;
  const result = await repository.withAdvisoryLock(lockKey, async () => {
    wasExecuted = true;
    const startedAt = now();
    const syncRun = await repository.startSyncRun?.({ job, startedAt });
    try {
      const outcome = await execute({ capturedAt: startedAt, syncRun });
      await repository.finishSyncRun?.({
        id: syncRun?.id,
        status: "success",
        finishedAt: now(),
        records: outcome.records ?? 0,
        error: null,
      });
      return { job, status: "success", ...outcome };
    } catch (error) {
      await repository.finishSyncRun?.({
        id: syncRun?.id,
        status: "failed",
        finishedAt: now(),
        records: 0,
        error: serializeError(error),
      });
      throw error;
    }
  });
  return wasExecuted ? result : { job, status: "skipped", reason: "lock_not_acquired", records: 0 };
}
