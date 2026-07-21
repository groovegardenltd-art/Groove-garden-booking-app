---
name: TTLock lock capacity, flooding root cause, and resync race condition
description: Real hardware capacity, what causes -3009 errors, the autoResyncUnsynced flooding bug, and the double-resync race condition
---

The front door lock (production ID 33130132) holds 100 API-managed codes (confirmed via lock-code-count API returning limit:100), not ~13 as initially assumed.

## -3009 "no space" error
NOT a hardware storage limit. Triggered when the lock's physical hardware is full — caused by codes accumulating faster than they are cleared. Gateway queues add/delete commands and flushes them when "upload data" is triggered in TTLock app.

## Root cause of lock flooding (FIXED)
`autoResyncUnsynced` in server/index.ts ran every 10 minutes with **no time window**. It pushed codes for ALL future bookings where `ttlockPasscodeId IS NULL`. After "Resync All Upcoming" sets `ttlockPasscodeId = null` for all bookings, this flooded the lock with every future booking (potentially hundreds). Fixed by disabling `autoResyncUnsynced` — `pushPendingLockCodes` in routes.ts handles this correctly with a 12h window and check-before-push logic.

## Double-resync race condition (FIXED)
If "Resync All Upcoming" is clicked twice while a push is in progress:
1. First resync wipes all ttlockPasscodeIds
2. Scheduler saves new IDs as it pushes each booking
3. Second resync fires and wipes those freshly-saved IDs again
4. Nightly purge sees bookings with null ttlockPasscodeId, treats their codes as orphaned, deletes them
5. Customers arrive to non-working codes

Fixed by: (a) blocking "Resync All" if schedulerRunning mutex is true, (b) "Resync All" now immediately triggers pushPendingLockCodes(7*24) after resetting, saving IDs atomically.

## Manual push window
- Manual "Push Pending Codes Now" button uses 7-day window (for post-reset scenarios)
- Automatic hourly scheduler uses 12h window (prevents pre-loading too many codes)
- "Resync All Upcoming" now also triggers immediate 7-day push

## How TTLock gateway sync works
- API add/delete commands go to TTLock cloud first
- Gateway queues them and delivers to physical hardware when lock "uploads data"
- "Upload data" in TTLock app flushes ALL queued commands — including any pending pushes from our scheduler
- So purging via Bluetooth then "upload data" still re-adds queued codes if our scheduler has pushed since the purge

## After a lock reset
1. Run admin purge (clears cloud)
2. Clear hardware via Bluetooth in TTLock app
3. Click "Resync All Upcoming" — this now immediately pushes all upcoming codes
4. Then "upload data" on TTLock app to sync to hardware
- Do NOT click "Resync All" twice — it's now blocked if a push is running
