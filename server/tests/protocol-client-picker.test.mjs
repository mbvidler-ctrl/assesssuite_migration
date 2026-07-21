import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clientPickerDisplayName,
  filterClientPickerRows,
  loadAccessibleClientPickerRows,
} from '../../src/lib/protocolClientPicker.js';

test('protocol client picker loads every server-authorised organisation instead of the first membership', async () => {
  let listCalls = 0;
  const rows = await loadAccessibleClientPickerRows({
    list: async () => {
      listCalls += 1;
      return [
        { id: 'client-b', org_id: 'org-secondary', full_name: 'Zulu Patient' },
        { id: 'client-a', org_id: 'org-primary', full_name: 'Alpha Patient' },
      ];
    },
    filter: async () => {
      throw new Error('the component must not narrow the server-authorised result to the first membership');
    },
  });

  assert.equal(listCalls, 1);
  assert.deepEqual(rows.map((row) => row.id), ['client-a', 'client-b']);
});

test('protocol client picker remains searchable when a retained client has no full_name', () => {
  const rows = [
    { id: 'named', full_name: 'Brenton Example', email: 'brenton@example.test' },
    { id: 'unnamed', full_name: null, email: 'recovery@example.test' },
  ];

  assert.equal(clientPickerDisplayName(rows[1]), 'Unnamed client');
  assert.deepEqual(filterClientPickerRows(rows, 'brenton').map((row) => row.id), ['named']);
  assert.deepEqual(filterClientPickerRows(rows, 'recovery').map((row) => row.id), ['unnamed']);
  assert.deepEqual(filterClientPickerRows(rows, '').map((row) => row.id), ['named', 'unnamed']);
});
