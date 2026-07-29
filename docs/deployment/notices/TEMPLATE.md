<!--capability-notice
notice_id: YYYYMMDD-kebab-slug
date: YYYY-MM-DD
flags: NAME_ONE,NAME_TWO
direction: reduces | restores | neutral
release: vNN
surfaces_affected: 0
owner_acknowledgement: <verbatim authorisation and date, or NOT OBTAINED>
expected_duration: <text, e.g. "until the next release" or "indefinite">
capability-notice-->

# Title describing the change in plain English

## User-visible effect

What a clinician, client or admin actually sees change, in Australian
English, written for a non-engineer.

## Surfaces affected

The server gates and client call sites this change touches. Cite exact
file paths and, for a capability-reducing change, the count from
`docs/deployment/flag-manifest.json`.

## Detection and monitoring

How this change would be noticed if it went wrong — which automated gate,
which manual check, or an honest statement that none exists yet.

## Restoration criteria

What has to be true before this reverts (for a `reduces` notice) or what
was confirmed true before this landed (for a `restores` notice).
