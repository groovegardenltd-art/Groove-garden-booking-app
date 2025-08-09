# TTLock Hardware Sync Issue - Aug 09, 2025

## Problem
- Passcodes create successfully in TTLock cloud API
- Lock responds with valid keyboardPwdId confirmations
- BUT physical lock shows "operation failed" when codes are entered
- Gateway "ruveno g2" is connected but sync is broken

## Lock Status
- **Lock ID**: 24518732 (LL609_5aa163)
- **Battery**: 90% (Excellent)
- **Gateway**: Connected (ruveno g2, ID: 1792834)
- **Admin Code**: 1123334 (should always work)
- **WiFi**: Connected but may have sync issues

## Codes Created (All Should Work)
1. **Admin**: 1123334 (built-in, always active)
2. **Working Pattern**: 3011233341 (TTLock ID: 12365850)
3. **Short Pattern**: 303880 (TTLock ID: 12814456)
4. **Admin-Style**: 11233477777 (TTLock ID: pending)

## Troubleshooting Steps
1. **Try Admin Code First**: 1123334# (this bypasses cloud sync)
2. **Check WiFi Signal**: Ensure strong connection at lock location
3. **Power Cycle Gateway**: Unplug "ruveno g2" for 30 seconds
4. **Force Sync**: Open TTLock mobile app to trigger sync
5. **Manual Reset**: Long-press lock reset button if accessible

## Root Cause
The issue is NOT with our passcode generation algorithm - codes are creating successfully in the cloud. The problem is hardware synchronization between TTLock cloud and the physical lock device.

## Next Steps
- If admin code 1123334# works, the hardware is fine
- If admin code fails, it's a hardware/connectivity issue
- Gateway may need reconfiguration or lock needs reset
- Consider contacting TTLock support for gateway sync issues

## Technical Notes
- API responses show successful passcode creation
- Lock detail shows healthy battery and gateway connection
- Manual sync API endpoint returns 404 (not available in EU region)
- Cloud-to-hardware sync appears to be the bottleneck