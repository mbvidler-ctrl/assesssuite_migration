# Temporary braces dependency audit exception

- Mission: `UM-AUTO-20261004-ASSESSSUITE-UPLOAD-MAINTENANCE`
- Human authorisation: Maxwell Vidler, 4 October 2026: "Ok, go ahead with option 1. If it fails, move immediately to option 2. Execute autonomously."
- Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack-exhaustion denial of service through deeply nested patterns.
- Reviewed installed package: **braces 3.0.3 only**.
- Automatic expiry: **18 October 2026 at 00:00:00 UTC** (11:00 am Sydney daylight time).

As checked on 4 October 2026, the advisory has no patched braces release. Tailwind 3's chokidar/micromatch/fast-glob dependency graph installs the affected package. Removing that graph requires the separately authorised Tailwind 4 migration. Other identified Axios, brace-expansion, Moment and Undici advisories must be resolved with compatible updates; this exception does not apply to them.

The Docker build runs `npm ci` and copies the complete build tree into the final image. The affected package therefore remains installed in the runnable production image, including through the production tailwindcss-animate peer dependency. The inspected application startup (`server/productionBootstrap.mjs`, then `server/index.mjs`) serves the built assets and HTTP API. Repository imports do not invoke braces, micromatch, chokidar, fast-glob or Tailwind on those startup/request paths. The Tailwind/PostCSS configuration uses fixed project content globs during the build. This supports a bounded temporary risk acceptance; it does not prove the installed package can never be invoked or remove its vulnerability.

`scripts/check-dependency-audit.mjs` accepts this advisory only for the package name `braces`, before the deadline, after every audit node exactly matches the complete lockfile inventory and both the locked and actual installed package identity/version match braces 3.0.3. Missing, malformed, renamed, aliased or mismatched package metadata fails closed. The gate rejects this exception at the exact deadline and afterwards using the runtime UTC clock; no environment override extends it. New advisories on braces, and moderate/high/critical advisories on other packages, continue to block the gate. The previously authorised react-router exception retains its existing terms.

Remove this exception when a patched package is available or the affected dependency graph is eliminated. If the temporary route fails its reachability review or required release gates, proceed to the authorised Tailwind 4 migration. This record authorises no unrelated dependency exception or change to production resources.
