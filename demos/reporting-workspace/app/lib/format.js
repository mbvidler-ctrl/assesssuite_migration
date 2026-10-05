import { STATUS_LABELS, EVIDENCE_CATEGORIES, RECIPIENT_ROLE_LABELS } from '@domain/reportTypes.mjs';

export function formatDate(value) {
  const day = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

export function formatDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ''));
  if (!match) return formatDate(value);
  const [, year, month, date, hours, minutes] = match;
  return `${date}/${month}/${year} ${hours}:${minutes} UTC`;
}

export function titleCase(value) {
  const text = String(value || '').replace(/_/g, ' ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || titleCase(status);
}

export function categoryLabel(category) {
  return EVIDENCE_CATEGORIES[category] || titleCase(category);
}

export function recipientRoleLabel(role) {
  return RECIPIENT_ROLE_LABELS[role] || titleCase(role);
}

export function describeError(error) {
  if (!error) return '';
  const code = error.code ? ` (${error.code})` : '';
  return `${error.message || 'The action could not be completed.'}${code}`;
}
