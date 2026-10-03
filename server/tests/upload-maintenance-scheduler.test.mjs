import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import { test } from 'node:test';
import {
  createUploadMaintenanceScheduler,
  uploadMaintenanceWarningAggregate,
} from '../uploadMaintenanceScheduler.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('incomplete maintenance warnings expose only aggregate counts and successful passes stay quiet', () => {
  assert.equal(uploadMaintenanceWarningAggregate({ examined: 25, removed: 25, partial: 0 }), null);
  const privateCanary = 'synthetic-private-name-row-id-message';
  const warning = uploadMaintenanceWarningAggregate({
    examinedEntries: 10_000,
    managedCandidates: 50,
    removed: 49,
    partial: 1,
    truncated: true,
    filename: privateCanary,
    id: privateCanary,
    error: privateCanary,
    retained: privateCanary,
    [privateCanary]: 3,
  });
  assert.deepEqual(warning, {
    partial: 1,
    truncated: true,
    examinedEntries: 10_000,
    managedCandidates: 50,
    removed: 49,
  });
  assert.doesNotMatch(JSON.stringify(warning), new RegExp(privateCanary));
  assert.deepEqual(uploadMaintenanceWarningAggregate({ examinedEntries: 10_000, partial: 0, truncated: true }), {
    partial: 0,
    truncated: true,
    examinedEntries: 10_000,
  });
});

test('lifecycle passes do not overlap, coalesce ticks, and never invoke historical scanning', async () => {
  const firstStarted = deferred();
  const finishFirst = deferred();
  const finishSecond = deferred();
  let runs = 0;
  let active = 0;
  let historicalRuns = 0;
  const scheduler = createUploadMaintenanceScheduler({
    async runLifecyclePass() {
      active += 1;
      assert.equal(active, 1);
      runs += 1;
      if (runs === 1) {
        firstStarted.resolve();
        await finishFirst.promise;
      } else {
        await finishSecond.promise;
      }
      active -= 1;
    },
    historicalArtifacts: { runPass() { historicalRuns += 1; }, close() {} },
    onError(_kind, error) { throw error; },
  });
  const initial = scheduler.runLifecycle();
  await firstStarted.promise;
  const pending = [scheduler.runLifecycle(), scheduler.runLifecycle(), scheduler.runLifecycle()];
  assert.ok(pending.every((promise) => promise === initial));
  finishFirst.resolve();
  await yieldToEventLoop();
  assert.equal(runs, 2, 'ticks during the first pass queue only one follow-up');
  finishSecond.resolve();
  await initial;
  assert.equal(runs, 2);
  assert.equal(historicalRuns, 0);
  scheduler.close();
});

test('historical batches yield to HTTP work and due lifecycle passes including a coalesced follow-up', async () => {
  const historicalStarted = deferred();
  const resumeHistorical = deferred();
  const lifecycleStarted = deferred();
  const finishLifecycle = deferred();
  const order = [];
  let lifecycleRuns = 0;
  const scheduler = createUploadMaintenanceScheduler({
    async runLifecyclePass() {
      lifecycleRuns += 1;
      order.push(`expiry-${lifecycleRuns}`);
      lifecycleStarted.resolve();
      await finishLifecycle.promise;
    },
    historicalArtifacts: {
      async runPass({ yieldToEventLoop: yieldHistorical }) {
        order.push('historical-first');
        historicalStarted.resolve();
        await resumeHistorical.promise;
        await yieldHistorical();
        order.push('historical-second');
      },
      close() {},
    },
    onError(_kind, error) { throw error; },
  });
  const historical = scheduler.runHistorical();
  await historicalStarted.promise;
  const lifecycle = scheduler.runLifecycle();
  await lifecycleStarted.promise;
  scheduler.runLifecycle();
  scheduler.runLifecycle();
  // An immediate models HTTP handling waiting between maintenance batches.
  const httpHandled = yieldToEventLoop().then(() => order.push('http'));
  resumeHistorical.resolve();
  await httpHandled;
  assert.equal(order.includes('historical-second'), false);
  finishLifecycle.resolve();
  await Promise.all([historical, lifecycle]);
  assert.deepEqual(order, ['historical-first', 'expiry-1', 'http', 'expiry-2', 'historical-second']);
  scheduler.close();
});

test('historical requests do not overlap and shutdown closes its iterator once', async () => {
  const started = deferred();
  const finish = deferred();
  let historicalRuns = 0;
  let closes = 0;
  const scheduler = createUploadMaintenanceScheduler({
    async runLifecyclePass() {},
    historicalArtifacts: {
      async runPass() {
        historicalRuns += 1;
        started.resolve();
        await finish.promise;
      },
      close() { closes += 1; },
    },
    onError(_kind, error) { throw error; },
  });
  const historical = scheduler.runHistorical();
  await started.promise;
  assert.equal(scheduler.runHistorical(), historical);
  scheduler.close();
  scheduler.close();
  await scheduler.runHistorical();
  await scheduler.runLifecycle();
  finish.resolve();
  await historical;
  assert.equal(historicalRuns, 1);
  assert.equal(closes, 1);
});

test('server installs one-minute lifecycle and hourly historical timers after listen', () => {
  const source = fs.readFileSync(new URL('../index.mjs', import.meta.url), 'utf8');
  const beforeListen = source.slice(0, source.indexOf('server.listen(PORT'));
  const afterListen = source.slice(source.indexOf('server.listen(PORT'));
  assert.doesNotMatch(beforeListen, /^runUploadLifecycleMaintenance\(\);/m);
  assert.doesNotMatch(beforeListen, /uploadCleanupTimer = setInterval\(/);
  assert.match(source, /const uploadCleanupIntervalMinutes = 1;/);
  assert.match(source, /const historicalCleanupIntervalMs = 60 \* 60 \* 1000;/);
  assert.match(afterListen, /void runUploadLifecycleMaintenance\(\);/);
  assert.match(afterListen, /void uploadMaintenance\.runHistorical\(\);/);
});
