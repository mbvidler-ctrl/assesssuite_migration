import { format, parseISO } from "date-fns";

// Today as a local 'yyyy-MM-dd' string. Never derive a date-only value via
// toISOString(), which is UTC and rolls to the previous calendar day at any
// local time before 10:00 AEST (UTC+10).
export function todayLocal() {
  return format(new Date(), "yyyy-MM-dd");
}

// Parses a date-only 'yyyy-MM-dd' string as LOCAL midnight for display.
// Native new Date('yyyy-MM-dd') parses as UTC midnight, which shifts the
// rendered day in negative-offset timezones; date-fns parseISO is local.
export function parseDateOnlyLocal(value) {
  return typeof value === "string" ? parseISO(value) : new Date(value);
}
