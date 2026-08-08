# Protocol Assistance search contract

This directory is the deterministic, catalogue-only discovery seam for Core V1.
It does not generate treatment plans and deliberately accepts no patient or
client context.

`searchProtocolCatalogue()` requires:

- a free-text string or preset/autocomplete object (`name`, `label`, `value`,
  `condition_name`, or `query`);
- a reviewed catalogue array;
- a server-derived profession and scope; and
- an optional reproducible `asOf` date and bounded result limit.

Each searchable catalogue row must contain `condition_name` plus governance
metadata for `profession`, `scope`, `source`, `reviewer`, `version`, `expiry`,
`rights`, and `management_target`. Metadata can sit in a nested `governance`
object. Legacy rows are blocked rather than silently grandfathered.

The result state is one of `matches`, `invalid_query`, `no_match`,
`unsupported`, or `catalogue_blocked`. A caller must render those states
explicitly and must never use `no_match` as permission to invoke a generative
clinical fallback.

Integration should occur behind a purpose-specific server endpoint. The server
must derive the organisation, profession and scope from authenticated context,
then return only reviewed catalogue matches. The existing Base44 page can be
migrated later through this compatibility seam without preserving its current
browser-owned clinical-generation path.
