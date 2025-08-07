// Debug TTLock Commands - Using native fetch
const fetch = globalThis.fetch;

// TTLock Debug Commands
const TTLOCK_CONFIG = {
  clientId: process.env.TTLOCK_CLIENT_ID,
  clientSecret: process.env.TTLOCK_CLIENT_SECRET,
  username: process.env.TTLOCK_USERNAME,
  password: process.env.TTLOCK_PASSWORD,
  baseUrl: 'https://euapi.ttlock.com'
};

let accessToken = null;

async function authenticateDebug() {
  console.log('🔐 Authenticating with TTLock...');
  
  const response = await fetch(`${TTLOCK_CONFIG.baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TTLOCK_CONFIG.clientId,
      client_secret: TTLOCK_CONFIG.clientSecret,
      grant_type: 'password',
      username: TTLOCK_CONFIG.username,
      password: TTLOCK_CONFIG.password,
    }),
  });

  const data = await response.json();
  if (data.access_token) {
    accessToken = data.access_token;
    console.log('✅ Authentication successful');
    return true;
  } else {
    console.error('❌ Authentication failed:', data);
    return false;
  }
}

async function sendUnlockCommand() {
  try {
    if (!accessToken) {
      const authSuccess = await authenticateDebug();
      if (!authSuccess) return null;
    }

    console.log('🔓 Sending unlock command to lock 24518732...');
    
    const response = await fetch(`${TTLOCK_CONFIG.baseUrl}/v3/lock/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        clientId: TTLOCK_CONFIG.clientId,
        accessToken: accessToken,
        lockId: '24518732',
        date: Date.now().toString(),
      }),
    });

    const result = await response.json();
    console.log('📡 Response from lock:', JSON.stringify(result, null, 2));
    
    if (result.errcode === 0) {
      console.log('✅ Unlock command sent successfully');
    } else {
      console.log('❌ Unlock command failed');
    }
    
    return result;
  } catch (error) {
    console.error('🚨 Error sending unlock command:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

async function createDebugPasscode(testCode = '456654') {
  try {
    if (!accessToken) {
      const authSuccess = await authenticateDebug();
      if (!authSuccess) return null;
    }

    const startTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    const endTime = Date.now() + (2 * 60 * 60 * 1000); // 2 hours from now

    console.log(`🔑 Creating debug passcode: ${testCode}`);
    console.log(`⏰ Valid from: ${new Date(startTime).toISOString()}`);
    console.log(`⏰ Valid to: ${new Date(endTime).toISOString()}`);
    
    const response = await fetch(`${TTLOCK_CONFIG.baseUrl}/v3/keyboardPwd/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        clientId: TTLOCK_CONFIG.clientId,
        accessToken: accessToken,
        lockId: '24518732',
        keyboardPwd: testCode,
        keyboardPwdName: 'Debug-Test',
        startDate: startTime.toString(),
        endDate: endTime.toString(),
        date: Date.now().toString(),
      }),
    });

    const result = await response.json();
    console.log('📡 Passcode creation response:', JSON.stringify(result, null, 2));
    
    if (result.keyboardPwdId) {
      console.log(`✅ Passcode ${testCode} created with ID: ${result.keyboardPwdId}`);
      console.log('🧪 Test this code on the lock keypad now');
    } else {
      console.log('❌ Passcode creation failed');
    }
    
    return result;
  } catch (error) {
    console.error('🚨 Error creating passcode:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

async function checkLockStatus() {
  try {
    if (!accessToken) {
      const authSuccess = await authenticateDebug();
      if (!authSuccess) return null;
    }

    console.log('🔍 Checking detailed lock status...');
    
    const response = await fetch(`${TTLOCK_CONFIG.baseUrl}/v3/lock/detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        clientId: TTLOCK_CONFIG.clientId,
        accessToken: accessToken,
        lockId: '24518732',
        date: Date.now().toString(),
      }),
    });

    const result = await response.json();
    console.log('📊 Lock status:', JSON.stringify(result, null, 2));
    
    // Parse key status information
    if (result.lockName) {
      console.log(`🏷️  Lock Name: ${result.lockName}`);
      console.log(`🔋 Battery: ${result.electricQuantity}%`);
      console.log(`🌐 Has Gateway: ${result.hasGateway ? 'Yes' : 'No'}`);
      console.log(`⏰ Last Update: ${new Date(result.lockUpdateDate).toISOString()}`);
      console.log(`🔐 Init Passcode: ${result.noKeyPwd}`);
    }
    
    return result;
  } catch (error) {
    console.error('🚨 Error checking lock status:', error.message);
    return null;
  }
}

// Main debug function
async function runTTLockDebug() {
  console.log('🚀 Starting TTLock Debug Session');
  console.log('================================');
  
  // 1. Check lock status
  await checkLockStatus();
  
  console.log('\n================================');
  
  // 2. Test unlock command
  await sendUnlockCommand();
  
  console.log('\n================================');
  
  // 3. Create debug passcode
  const debugCode = Math.floor(100000 + Math.random() * 900000).toString();
  await createDebugPasscode(debugCode);
  
  console.log('\n🎯 Debug session complete');
  console.log(`Try passcode: ${debugCode} on the lock keypad`);
}

// Export for use in other modules
module.exports = {
  sendUnlockCommand,
  createDebugPasscode,
  checkLockStatus,
  runTTLockDebug
};

// Run if called directly
if (require.main === module) {
  runTTLockDebug().catch(console.error);
}