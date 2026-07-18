---
name: TTLock permanent error retries
description: Certain TTLock errcodes indicate permanent failures that must not be retried or they cause 12s delays before fallback code is used.
---

## Rule
For TTLock errcodes that indicate permanent, non-transient failures, throw `NonRetryableTTLockError` (defined at top of `server/ttlock.ts`) instead of a plain `Error`. The retry loop in `createTimeLimitedPasscode` catches this class and breaks immediately instead of waiting 2s+4s between attempts.

**Permanent errcodes:**
- `-2018` — API-level permission denied (developer account lacks passcode creation rights)
- `20002` — Account is not lock admin for the specific lock
- `-1002` — Invalid credentials

**Why:** With 3 retry attempts (2s+4s delays) and 2 locks, a permanent error causes 12 seconds of useless waiting before the fallback local code is generated. This caused e2e tests to time out and users to see a 12-second "Updating…" spinner even though the fallback always succeeds.

**How to apply:** Any new TTLock errcode that is clearly permanent (auth/permission/device-not-found) should also be added to the `isPermanent` check in `_attemptCreatePasscode`.
