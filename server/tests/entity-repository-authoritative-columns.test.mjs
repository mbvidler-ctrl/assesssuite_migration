import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { createEntityRepository } from '../db.mjs';

test('entity repository columns cannot be shadowed by imported JSON payload fields', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE entity_Client (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL,
        created_by TEXT
      )
    `);
    db.prepare(`
      INSERT INTO entity_Client (id, data, created_date, updated_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'column-client-id',
      JSON.stringify({
        id: 'payload-shadow-id',
        created_date: '2099-01-01T00:00:00.000Z',
        updated_date: '2099-01-02T00:00:00.000Z',
        created_by: 'payload-shadow-actor',
        org_id: 'org-alpha',
      }),
      '2026-08-08T00:00:00.000Z',
      '2026-08-08T01:00:00.000Z',
      'column-actor-id',
    );

    const record = createEntityRepository(db, 'Client').getById('column-client-id');
    assert.deepEqual(record, {
      id: 'column-client-id',
      created_date: '2026-08-08T00:00:00.000Z',
      updated_date: '2026-08-08T01:00:00.000Z',
      created_by: 'column-actor-id',
      org_id: 'org-alpha',
    });
  } finally {
    db.close();
  }
});
