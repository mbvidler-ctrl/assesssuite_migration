# Session lifecycle hardening

## Security outcome

The server now enforces an eight-hour absolute lifetime for every opaque
application session. Expiry is evaluated against the server clock on every
token lookup; an expired, malformed or legacy null-expiry row is deleted and
treated as unauthenticated.

The same maximum is enforced at the SQLite storage boundary. Inserts reject
malformed, expired, materially future or overlong rows, and stored session rows
are immutable so neither timestamp can be advanced to renew a token. Repository
configuration may shorten but cannot exceed the universal eight-hour limit.
Migration revokes rather than preserves any row that does not satisfy the same
creation/expiry relationship.

The eight-hour limit is the upper end of OWASP's example absolute-timeout range
for an office-day application. It is fixed in code for this narrow change so a
missing or malformed production setting cannot silently restore unbounded
sessions.

Active sessions are also capped at eight per user. Issuing a ninth session
retains the new token and the seven most recently issued existing tokens, and
revokes only that user's older tokens. This leaves ordinary desktop, mobile
and secondary-browser use available while preventing a valid credential from
growing one user's session set without limit.

References:

- <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#absolute-timeout>
- <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#user-resets-password>

## Availability finding and patch contract

The Low/P3 availability path required a caller to know a valid user's
credentials and repeatedly complete the ordinary login route. Each successful
login called `sessions.create()`, which repeated a non-sargable whole-table
cleanup already performed by the insert trigger, and no control bounded that
user's active rows. Five hundred synthetic successful issuances retained five
hundred rows and SQLite reported `SCAN session_records` for the cleanup plan.

The remediation boundary is the session store, rather than login-specific rate
handling, because OTP verification and the retained rollback binary also issue
sessions. The required invariants are: indexed work during normal issuance; a
finite per-user active-session set; no cross-user eviction; eight-hour absolute
expiry; reset-wide revocation; and unchanged legitimate login, logout,
authenticated password-change and password-reset behaviour.

## Migration and rollback behaviour

`openDatabase()` replaces the legacy three-column `sessions` table with a
`session_records` backing table and a filtered compatibility view retaining the
name `sessions`. Existing unbounded rows are revoked. Valid already-bounded
rows are preserved, and the migration is idempotent.

This indirection is part of the security boundary. The retained rollback image
still executes its original three-column `INSERT` and `SELECT` statements
against `sessions`. SQLite `INSTEAD OF` triggers derive an eight-hour expiry
from SQLite's own current time, while the view hides malformed and expired
rows. A rollback therefore cannot trust a caller-supplied future creation
time, make an expired token valid again, mint an unbounded session or insert an
explicit expiry beyond eight hours. Valid rollback inserts also purge stale
backing rows. The original rollback image remains data-path compatible without
reopening AS-HIGH-002.

The backing table indexes expiry and user identity. Hardened startup removes
expired or malformed rows and reduces any pre-existing per-user excess to the
same eight-session ceiling. Every new session issuance opportunistically
removes expired rows and enforces the ceiling at the SQLite insert boundary,
including inserts made by the retained rollback binary.

Routine issuance does not repeat the previous non-sargable whole-table cleanup
in both the repository and insert trigger. Expiry cleanup uses an expression
index on `julianday(expires_date)`, and per-user retention uses the covering
`(user_id, created_date DESC, token DESC)` index. The repository performs the
single insert; the database trigger owns cleanup, validation and retention for
both current and rollback callers.

Rollback safety assumes the reviewed image/config rollback continues to use
the migrated production volume. The release workflow does not automatically
restore the pre-deployment volume snapshot. Restoring a pre-migration snapshot
would also restore the legacy table and is therefore prohibited as a session-
hardening rollback unless the hardened migration is immediately re-applied.

## Password recovery

A successful password reset now revalidates the single-use token only after
obtaining the SQLite write lock, then updates the password, consumes the reset
token and revokes every session for that user inside one transaction. Either
all three effects commit or none do. Malformed expiry values fail closed, and
concurrent completion attempts cannot both consume the same token. The user
must authenticate again with the new password.

SQLite writer contention uses a bounded five-second busy timeout. This allows
the losing process in a concurrent reset attempt to acquire the write lock,
re-read the now-consumed token and return the controlled invalid-token response
instead of exposing transient lock contention as an internal server error.

The migrated database also retains a narrowly scoped password-reset trigger:
when a password hash changes while a non-null reset token is consumed, all
sessions for that user are deleted. This keeps reset-driven revocation in force
if the reviewed retained application image is restored. It does not fire for
an ordinary authenticated change-password operation.

This change does not add an inactivity timeout, session-token renewal, device
management or MFA. It also does not change the existing authenticated
change-password user experience. Those are separate improvements and must not
be inferred from this patch.

## Verification contract

`server/tests/session-lifecycle.test.mjs` proves:

1. rejection of unknown reset tokens before password hashing with an
   authoritative recheck after the write lock;
2. issuance and exact eight-hour server-side expiry;
3. fail-closed legacy migration, including revocation of unbounded and
   overlong rows;
4. old-binary rollback insertion using SQLite time, lookup filtering and
   deletion through the compatibility view;
5. storage-boundary rejection of explicit overlong and future-created rows;
6. idempotent migration and preservation of a valid bounded session;
7. migration-time and retained-binary enforcement of the eight-session
   per-user cap;
8. opportunistic expired-row cleanup through the insert boundary;
9. indexed query plans for routine expiry cleanup and per-user retention, with
   no session-table scan or temporary ordering tree;
10. retention of only the newest eight sessions without cross-user eviction;
11. rejection of a repository TTL above eight hours;
12. backing-row immutability against timestamp renewal;
13. concurrent session revocation without cross-user impact;
14. persistence across a database restart;
15. database-layer reset revocation that survives a retained-image rollback;
16. non-activation of that trigger for ordinary authenticated password change;
17. logout-route revocation;
18. entity-route and function-route rejection of an expired token;
19. end-to-end password-reset revocation, true two-process single-use
    completion, malformed-expiry rejection, old-password rejection and fresh
    login; and
20. transactional rollback of password/reset-token changes when session
    revocation is fault-injected to fail.

The suite is included in `npm run test:assurance`.
