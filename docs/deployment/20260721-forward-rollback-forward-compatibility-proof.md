# Forward -> rollback -> forward compatibility proof

Run the local compatibility contract with:

```powershell
npm.cmd run test:forward-rollback-compatibility
```

The proof runs three server processes, one at a time, against one caller-owned
temporary SQLite/uploads store:

1. The current posture starts once with `SELFTEST=1` to create an empty
   synthetic gate store. It proves the canonical 39-field, two-file,
   one-provider-request-per-file merge; commits the reviewed client,
   conditions, two documents and bound bytes; proves receipt replay/conflict;
   and creates a quarantined age fixture.
2. The rollback posture starts with `SELFTEST=0`, extraction disabled and the
   exact current/superseded legal allowlist. It proves the pre-registering
   schema migration, interrupted-registration reconciliation, orphan final,
   `.registering` and `.provider-block` cleanup, age-quarantine cleanup, exact
   503/zero-provider-call/byte-for-byte-and-row-for-row no-mutation behaviour,
   tenant isolation and a rollback-phase client write.
3. The current posture starts again with `SELFTEST=0`. It proves the rollback
   write and all original bound clinical state are readable, replays and
   conflicts the original durable receipt, performs a new current write, and
   rechecks SQLite integrity plus database and upload SHA-256 hashes.

The shared-store harness never removes a caller-owned store during a phase
stop. It removes the synthetic store only after the complete proof (or a
failure) exits. No real patient data, credential or external provider is used;
the only provider is the loopback synthetic Responses API fixture.

The four `ROLLBACK_PROOF_...=PASS` lines are emitted together, exactly once,
only after every relevant assertion and the final integrity/hash checks pass.
A failed or partial run emits none of them.

## Exact-image mode

The same contract can later execute immutable forward and rollback images:

```powershell
$env:FORWARD_IMAGE='registry.example/assesssuite@sha256:<64-hex-digest>'
$env:ROLLBACK_IMAGE='registry.example/assesssuite@sha256:<64-hex-digest>'
npm.cmd run test:forward-rollback-compatibility
```

Both variables are required together, and each must be a named
`repository@sha256:<digest>` reference. `COMPATIBILITY_CONTAINER_CLI` may be
set to a Docker-compatible CLI; it defaults to `docker`.

The canonical current Fly process is
`node server/productionBootstrap.mjs && exec node server/index.mjs`, matching
the current Dockerfile command. Image compatibility mode deliberately
overrides that command with `node server/index.mjs`: the proof needs an
isolated synthetic database and must not claim to exercise production
bootstrap, catalogue or secret gates. It mounts the same temporary store into
each image and uses host networking so the app and synthetic provider remain
on `127.0.0.1`. The container runtime must therefore support host networking.
The wrapper removes `FLY_API_TOKEN` and production provider/payment secret
variables from the proof subprocess before any phase starts.

This is a data-contract and image-compatibility proof. It is not a substitute
for the separate Fly volume-topology, snapshot, restore, release-provenance or
live-deployment gates: image mode uses an isolated test database override and
does not contact Fly, a registry API or any production service.
