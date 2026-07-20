---
name: TTLock lock capacity and flooding root cause
description: Real hardware capacity, what causes -3009 errors, and the autoResyncUnsynced flooding bug
---

The front door lock (production ID 33130132) holds ~250+ passcodes, not ~13 as initially assumed.

## -3009 "no space" error
NOT a hardware storage limit. Triggered when the lock's physical hardware is full — caused by codes accumulating faster than they are cleared. Gateway queues add/delete commands and flushes them when "upload data" is triggered in TTLock app.

## Root cause of lock flooding (FIXED)
`autoResyncUnsynced` in server/index.ts ran every 10 minutes with **no time window**. It pushed codes for ALL future bookings where `ttlockPasscodeId IS NULL`. After "Resync All Upcoming" sets `ttlockPasscodeId = null` for all bookings, this flooded the lock with every future booking (potentially hundreds). Fixed by disabling `autoResyncUnsynced` — `pushPendingLockCodes` in routes.ts handles this correctly with a 12h window and check-before-push logic.

## How TTLock gateway sync works
- API add/delete commands go to TTLock cloud first
- Gateway queues them and delivers to physical hardware when lock "uploads data"
- "Upload data" in TTLock app flushes ALL queued commands — including any pending pushes from our scheduler
- So purging via Bluetooth then "upload data" still re-adds queued codes if our scheduler has pushed since the purge

## How to apply
- Never run "Resync All Upcoming" unless doing a full lock hardware reset (it sets ttlockPasscodeId=null for all bookings, triggering mass re-push)
- The safe push path is pushPendingLockCodes (12h window, check-before-push, hourly)
- After a purge, wait for scheduler to naturally push only current-window codes before uploading data to lock hardware
