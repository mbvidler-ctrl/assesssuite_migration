# Core V1 frozen-evaluation verifier

`verify-frozen-evals.mjs` uses only Node.js built-ins. Its default mode checks
the frozen corpus structure, partition separation, SHA-256 file hashes, source
links, and tuning restrictions. It makes no external calls and invokes no
model or provider.

```powershell
node scripts/core-v1/evals/verify-frozen-evals.mjs --corpus "C:\Users\Maxwe\OneDrive - Maxwell Vidler\Unimatter\02_Client_and_Venture_Matters\AssessSuite\work-product\20260808-assesssuite-core-v1\evaluations"
```

An optional local adapter can exercise future Core modules. Development is the
only partition available without an explicit non-tuning acknowledgement:

```powershell
node scripts/core-v1/evals/verify-frozen-evals.mjs `
  --corpus "<evaluation-root>" `
  --adapter "<local-adapter.mjs>" `
  --partition development
```

The supplied `core-v1-local-adapter.mjs` exercises the actual deterministic
assessment-discovery, protocol-search, and report-composition modules. It does
not import an LLM, SDK, integration, or provider adapter. The recorded run is
in `results/core-v1-local-evaluation-result-20260808.json`.

```powershell
node scripts/core-v1/evals/verify-frozen-evals.mjs `
  --corpus "<evaluation-root>" `
  --adapter scripts/core-v1/evals/core-v1-local-adapter.mjs `
  --partition locked-test `
  --purpose locked-test `
  --run-id core-v1-locked-test-20260808-01 `
  --acknowledge-no-tuning `
  --acknowledge-locked-test `
  --json
```

The locked-test partition was exposed for the recorded run. It must not now be
used to tune code, thresholds, mappings, fixtures, or assertions. A defective
locked case must be superseded by a new freeze, not silently edited.

Validation requires `--purpose validation`, `--run-id <id>`, and
`--acknowledge-no-tuning`. Locked test additionally requires
`--purpose locked-test` and `--acknowledge-locked-test`. The verifier removes common
model-provider credentials and blocks global `fetch` before importing the
adapter. That guard is defence in depth, not a network sandbox; adapters are
still required to be dependency-free/local and must not open sockets.

The adapter contract is:

```js
export const offlineOnly = true;

export async function evaluateCase(caseDefinition, context) {
  // context.constraints contains only the frozen constraint sets referenced
  // by the case. Call local deterministic modules only.
  return {
    provider_calls: 0,
    checks: Object.fromEntries(
      caseDefinition.expected_invariants.map(({ id }) => [id, true]),
    ),
  };
}
```

Returning `true` without actually evaluating an invariant is invalid test
practice. The example only defines the wire contract.
