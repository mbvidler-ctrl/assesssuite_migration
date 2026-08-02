import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  brisbaneDay,
  createUsageAnalyticsRepository,
  openDatabase,
  USAGE_METRIC_NAMES,
} from '../db.mjs';

function restoreEnvironment(previous) {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test('daily usage repository is identifier-free, Brisbane-bounded, atomic and zero-filled', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-usage-repository-'));
  const dbPath = path.join(tempRoot, 'usage.db');
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SELFTEST: process.env.SELFTEST,
    ASSESSSUITE_DB_PATH: process.env.ASSESSSUITE_DB_PATH,
    ASSESSSUITE_DB_PATH_ACK: process.env.ASSESSSUITE_DB_PATH_ACK,
  };
  process.env.NODE_ENV = 'test';
  process.env.SELFTEST = '0';
  process.env.ASSESSSUITE_DB_PATH = dbPath;
  process.env.ASSESSSUITE_DB_PATH_ACK =
    'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';

  let db;
  try {
    ({ db } = openDatabase());
    const columns = db.prepare("PRAGMA table_info('usage_daily_aggregate')").all();
    assert.deepEqual(columns.map((column) => column.name), [
      'day',
      'marketing_page_load',
      'successful_sign_in',
      'new_verified_account',
      'app_open',
    ]);
    assert.deepEqual(columns.map((column) => column.type), ['TEXT', 'INTEGER', 'INTEGER', 'INTEGER', 'INTEGER']);
    assert.equal(columns[0].pk, 1);
    assert.ok(columns.slice(1).every((column) => column.notnull === 1));
    assert.throws(
      () => db.prepare('SELECT rowid FROM usage_daily_aggregate').all(),
      /no such column: rowid/i,
      'WITHOUT ROWID prevents an implicit identifier dimension',
    );

    assert.deepEqual(USAGE_METRIC_NAMES, [
      'marketing_page_load',
      'successful_sign_in',
      'new_verified_account',
      'app_open',
    ]);
    assert.equal(brisbaneDay(new Date('2026-01-01T13:59:59.999Z')), '2026-01-01');
    assert.equal(brisbaneDay(new Date('2026-01-01T14:00:00.000Z')), '2026-01-02');

    const clock = () => new Date('2026-01-01T14:00:00.000Z');
    const repository = createUsageAnalyticsRepository(db, { clock });
    for (let index = 0; index < 100; index += 1) repository.increment('marketing_page_load');
    repository.increment('successful_sign_in');
    repository.increment('new_verified_account');
    repository.increment('app_open');
    assert.throws(() => repository.increment('patient@example.test'), /unknown usage metric/);

    assert.deepEqual(
      db.prepare('SELECT * FROM usage_daily_aggregate').all().map((row) => ({ ...row })),
      [{
        day: '2026-01-02',
        marketing_page_load: 100,
        successful_sign_in: 1,
        new_verified_account: 1,
        app_open: 1,
      }],
    );

    assert.deepEqual(repository.summarize(3), [
      {
        day: '2025-12-31',
        marketing_page_load: 0,
        successful_sign_in: 0,
        new_verified_account: 0,
        app_open: 0,
      },
      {
        day: '2026-01-01',
        marketing_page_load: 0,
        successful_sign_in: 0,
        new_verified_account: 0,
        app_open: 0,
      },
      {
        day: '2026-01-02',
        marketing_page_load: 100,
        successful_sign_in: 1,
        new_verified_account: 1,
        app_open: 1,
      },
    ]);
    for (const invalid of [0, 91, 1.5, '30', null]) {
      assert.throws(() => repository.summarize(invalid), /integer from 1 to 90/);
    }
  } finally {
    db?.close();
    restoreEnvironment(previous);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
