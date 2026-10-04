import { setImmediate as yieldToEventLoop } from 'node:timers/promises';

// Restrict warnings to known aggregate counts, even if a future result also
// carries internal diagnostics. Successful passes need no warning.
export function uploadMaintenanceWarningAggregate(result) {
  const partial = Number.isSafeInteger(result?.partial) && result.partial > 0 ? result.partial : 0;
  const truncated = result?.truncated === true;
  if (!partial && !truncated) return null;
  const aggregate = { partial, truncated };
  for (const key of ['examined', 'examinedEntries', 'managedCandidates', 'removed', 'missing', 'retained', 'isolated']) {
    if (Number.isSafeInteger(result[key]) && result[key] >= 0) aggregate[key] = result[key];
  }
  return aggregate;
}

// Timers are installed by index only after listen. This small coordinator keeps
// expiry/recovery serial and makes historical batches wait for due lifecycle
// work without preventing HTTP handling between either kind of batch.
export function createUploadMaintenanceScheduler({
  runLifecyclePass,
  historicalArtifacts,
  onError,
}) {
  let closed = false;
  let lifecyclePending = false;
  let lifecycleFlight = null;
  let historicalFlight = null;

  function runLifecycle() {
    if (closed) return Promise.resolve();
    lifecyclePending = true;
    if (lifecycleFlight) return lifecycleFlight;
    lifecycleFlight = Promise.resolve().then(async () => {
      try {
        while (lifecyclePending && !closed) {
          lifecyclePending = false;
          try {
            await runLifecyclePass();
          } catch (error) {
            onError('lifecycle', error);
          }
        }
      } finally {
        lifecycleFlight = null;
      }
    });
    return lifecycleFlight;
  }

  async function waitForLifecycle() {
    while (lifecycleFlight && !closed) await lifecycleFlight;
  }

  async function yieldHistoricalBatch() {
    await yieldToEventLoop();
    await waitForLifecycle();
  }

  function runHistorical() {
    if (closed) return Promise.resolve();
    // An hourly tick during an existing pass does not queue another pass.
    if (historicalFlight) return historicalFlight;
    historicalFlight = Promise.resolve().then(async () => {
      try {
        await waitForLifecycle();
        if (!closed) {
          return await historicalArtifacts.runPass({
            yieldToEventLoop: yieldHistoricalBatch,
          });
        }
      } catch (error) {
        onError('historical', error);
      } finally {
        historicalFlight = null;
      }
    });
    return historicalFlight;
  }

  function close() {
    if (closed) return;
    closed = true;
    lifecyclePending = false;
    historicalArtifacts.close();
  }

  return { runLifecycle, runHistorical, close };
}
