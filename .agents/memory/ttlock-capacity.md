---
name: TTLock lock capacity and -3009 error
description: Real hardware capacity and what causes -3009 "no space" errors on TTLock locks
---

The front door lock (production ID 33130132) holds ~250+ passcodes, not ~13 as initially assumed. A single purge deleted over 250 codes successfully.

The -3009 "There is NO SPACE to store Customized Passcodes" error is NOT a hardware storage limit. It is triggered by the TTLock gateway sync queue being overloaded with too many pending operations at once (e.g. many codes queued to push before the lock physically syncs).

**Why:** Codes added via gateway (addType: '2') are queued in TTLock cloud pending sync to the physical lock. If too many are queued simultaneously, -3009 is returned. Once the lock syncs (keypad press), the queue clears.

**How to apply:** Do not reduce push windows or code limits based on assumed hardware capacity. Instead, prevent duplicate queuing via check-before-push logic. The real fix for -3009 is ensuring the lock syncs regularly and codes are not duplicated.

Codes show as "Permanent Custom" in TTLock app regardless of keyboardPwdType sent — this appears to be a display quirk, not evidence that time-limited codes aren't working.
