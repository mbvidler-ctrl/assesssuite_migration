/** A completed assessment may legitimately have a numeric result of zero. */
export function hasAssessmentResultValue(value) {
  return value !== null && value !== undefined && value !== '';
}
