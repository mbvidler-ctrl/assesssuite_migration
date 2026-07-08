// Shared assessment-date resolution for the TestRunner submit path and the
// standalone assessment wrappers.
//
// Decided behaviour (8 July 2026): a completed assessment is dated with the
// runner-provided date where the runner supplied one, and otherwise dated
// today (local time). Re-running an old-dated assessment therefore re-dates
// it to the day it was actually performed; it must never silently keep the
// stale date of the record being re-run, because the SOAP write keys its
// appointment lookup to this date.
import { format } from "date-fns";

// Returns the runner-provided date unchanged when present (whatever format
// the runner used - 'yyyy-MM-dd' for most runners, full ISO for HADS), else
// today as a local 'yyyy-MM-dd' string. date-fns format() is local-time,
// unlike new Date().toISOString(), which is UTC and rolls to the previous
// day before 10:00 AEST.
export function resolveAssessmentDate(runnerProvidedDate) {
  if (runnerProvidedDate) return runnerProvidedDate;
  return format(new Date(), "yyyy-MM-dd");
}
