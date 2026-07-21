function normalizedPickerText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function clientPickerDisplayName(client) {
  return normalizedPickerText(client?.full_name) || 'Unnamed client';
}

export function sortClientPickerRows(clients) {
  if (!Array.isArray(clients)) return [];
  return [...clients]
    .filter((client) => client && typeof client.id === 'string' && client.id.length > 0)
    .sort((left, right) => {
      const byName = clientPickerDisplayName(left).localeCompare(
        clientPickerDisplayName(right),
        undefined,
        { sensitivity: 'base' },
      );
      if (byName !== 0) return byName;
      return left.id.localeCompare(right.id);
    });
}

export function filterClientPickerRows(clients, searchTerm) {
  const needle = normalizedPickerText(searchTerm).toLocaleLowerCase();
  const sorted = sortClientPickerRows(clients);
  if (!needle) return sorted;
  return sorted.filter((client) => {
    const name = clientPickerDisplayName(client).toLocaleLowerCase();
    const email = normalizedPickerText(client?.email).toLocaleLowerCase();
    return name.includes(needle) || email.includes(needle);
  });
}

export async function loadAccessibleClientPickerRows(clientEntity) {
  if (!clientEntity || typeof clientEntity.list !== 'function') {
    throw new TypeError('The authorised client catalogue is unavailable.');
  }
  // The server, not a client-chosen first membership, intersects this list
  // with every current organisation membership and legal-acceptance gate.
  return sortClientPickerRows(await clientEntity.list());
}
