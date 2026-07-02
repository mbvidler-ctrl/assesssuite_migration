// Standalone sanity check for src/lib/clientDuplicates.js.
// Run with: node scripts/check-duplicates.mjs
// Exits non-zero on any assertion failure.

import { findPotentialDuplicates } from "../src/lib/clientDuplicates.js";

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`PASS: ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}

// 1. Exact match flagged.
{
  const candidate = { full_name: "Jane Doe", date_of_birth: "1990-05-14" };
  const existing = [{ id: "1", full_name: "Jane Doe", date_of_birth: "1990-05-14" }];
  const matches = findPotentialDuplicates(candidate, existing);
  assert(matches.length === 1 && matches[0].id === "1", "exact name + DOB match is flagged");
}

// 2. DD/MM/YYYY vs YYYY-MM-DD, same date, flagged.
{
  const candidate = { full_name: "Jane Doe", date_of_birth: "14/05/1990" };
  const existing = [{ id: "2", full_name: "Jane Doe", date_of_birth: "1990-05-14" }];
  const matches = findPotentialDuplicates(candidate, existing);
  assert(matches.length === 1 && matches[0].id === "2", "DD/MM/YYYY vs ISO same date is flagged");
}

// 3. Different DOB is not flagged.
{
  const candidate = { full_name: "Jane Doe", date_of_birth: "1990-05-15" };
  const existing = [{ id: "3", full_name: "Jane Doe", date_of_birth: "1990-05-14" }];
  const matches = findPotentialDuplicates(candidate, existing);
  assert(matches.length === 0, "different DOB (same name) is NOT flagged");
}

// 4. "Jon Smith" vs "John Smith" - documented token-subset limitation, NOT flagged.
{
  const candidate = { full_name: "Jon Smith", date_of_birth: "1990-05-14" };
  const existing = [{ id: "4", full_name: "John Smith", date_of_birth: "1990-05-14" }];
  const matches = findPotentialDuplicates(candidate, existing);
  assert(matches.length === 0, '"Jon Smith" vs "John Smith" is NOT flagged (known limitation)');
}

// Supplementary: token-subset match still catches a genuine subset name variant.
{
  const candidate = { full_name: "Jane Doe", date_of_birth: "1990-05-14" };
  const existing = [{ id: "5", full_name: "Jane Marie Doe", date_of_birth: "1990-05-14" }];
  const matches = findPotentialDuplicates(candidate, existing);
  assert(matches.length === 1 && matches[0].id === "5", "token-subset name match (shorter name subset of longer) is flagged");
}

// Supplementary: no candidate DOB means no matches at all.
{
  const candidate = { full_name: "Jane Doe" };
  const existing = [{ id: "6", full_name: "Jane Doe", date_of_birth: "1990-05-14" }];
  const matches = findPotentialDuplicates(candidate, existing);
  assert(matches.length === 0, "missing candidate date_of_birth yields no matches");
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll assertions passed.");
}
