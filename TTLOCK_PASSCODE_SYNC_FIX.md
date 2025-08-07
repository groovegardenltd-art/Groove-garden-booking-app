# TTLock Temporary Passcode Sync Fix Guide

## Current Issue Analysis
- Remote unlock commands work successfully (errcode: 0)
- Gateway "ruveno g2" is online and connected
- Multiple temporary passcodes fail to sync (555666, 777888, 999000)
- Initialization passcode 1123334 works reliably
- Lock shows hasGateway: 1 but state remains 0

## Root Cause Possibilities

### 1. Lock Firmware Issues
- Keyboard password module may need firmware update
- Lock may require factory reset to clear corrupted passcode cache
- Firmware version 6.5.20.240724 may have known sync bugs

### 2. TTLock App Configuration
- "Remote Control" feature may not be properly enabled
- Lock may need re-initialization in TTLock mobile app
- Gateway association may be partial (connected but not fully configured)

### 3. API Permission Issues
- Keyboard passcode creation may require different API permissions
- Account may lack specific temporary passcode management rights
- API rate limiting may be causing silent failures

## Technical Solutions to Try

### Solution 1: Lock Factory Reset
1. Hold lock reset button for 20+ seconds until LED changes
2. Re-pair lock completely in TTLock mobile app
3. Re-associate with gateway "ruveno g2"
4. Enable all remote features (Remote Control, Keyboard Passcode)
5. Test with fresh temporary passcode

### Solution 2: TTLock App Reconfiguration
1. Delete lock from TTLock app completely
2. Factory reset lock hardware
3. Add lock as "new device" in app
4. Configure gateway association from scratch
5. Verify "Keyboard Passcode" feature is enabled
6. Test remote unlock and temporary passcode creation

### Solution 3: API Permission Verification
1. Contact TTLock developer support for account audit
2. Verify keyboard passcode API permissions are enabled
3. Check if account requires enterprise-level permissions
4. Request passcode sync diagnostic from TTLock technical team

### Solution 4: Alternative Passcode Method
1. Try creating permanent passcodes instead of temporary ones
2. Use different passcode types (periodic, one-time)
3. Test with longer passcode validity windows
4. Verify timezone synchronization between cloud and lock

## Advanced Troubleshooting

### Check Lock Internal State
- Verify lock's internal time synchronization
- Check if lock memory is full (passcode limit reached)
- Clear all existing passcodes and retry
- Monitor lock's Bluetooth connectivity alongside WiFi

### Gateway Optimization
- Position gateway closer to lock (within 5ft)
- Check for WiFi interference on 2.4GHz band
- Verify gateway firmware is current
- Test with direct Bluetooth connection (no gateway)

## Expected Timeline
- Firmware reset: 30 minutes
- Complete reconfiguration: 1-2 hours
- API permission resolution: 1-3 business days
- Hardware replacement: 3-5 business days if needed

## Immediate Workaround
Continue using initialization passcode 1123334 for reliable access while implementing permanent fixes.