import crypto from 'crypto';

const config = {
  clientId: process.env.TTLOCK_CLIENT_ID,
  clientSecret: process.env.TTLOCK_CLIENT_SECRET,
  username: process.env.TTLOCK_USERNAME,
  password: process.env.TTLOCK_PASSWORD,
  lockId: process.env.TTLOCK_LOCK_ID
};

async function checkLockConnectivity() {
  try {
    console.log('🔍 Checking TTLock connectivity for lock ID:', config.lockId);
    
    // Get access token
    const md5Password = crypto.createHash('md5').update(config.password).digest('hex');
    
    const tokenResponse = await fetch('https://euapi.ttlock.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        username: config.username,
        password: md5Password,
        grant_type: 'password',
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    console.log('✅ Token obtained successfully');

    // Check lock details
    console.log('\n📋 Checking lock details...');
    const detailResponse = await fetch('https://euapi.ttlock.com/v3/lock/detail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        clientId: config.clientId,
        accessToken: tokenData.access_token,
        lockId: config.lockId,
        date: Date.now().toString(),
      }),
    });

    const detailData = await detailResponse.json();
    console.log('Lock details:', JSON.stringify(detailData, null, 2));

    // Check lock state
    console.log('\n🔌 Checking lock connection state...');
    const stateResponse = await fetch('https://euapi.ttlock.com/v3/lock/queryOpenState', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        clientId: config.clientId,
        accessToken: tokenData.access_token,
        lockId: config.lockId,
        date: Date.now().toString(),
      }),
    });

    const stateData = await stateResponse.json();
    console.log('Lock state:', JSON.stringify(stateData, null, 2));

    // List current passcodes
    console.log('\n🔑 Checking active passcodes...');
    const passcodeResponse = await fetch('https://euapi.ttlock.com/v3/keyboardPwd/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        clientId: config.clientId,
        accessToken: tokenData.access_token,
        lockId: config.lockId,
        pageNo: '1',
        pageSize: '20',
        date: Date.now().toString(),
      }),
    });

    const passcodeData = await passcodeResponse.json();
    console.log('Active passcodes:', JSON.stringify(passcodeData, null, 2));

    // Summary
    console.log('\n📊 DIAGNOSIS SUMMARY:');
    console.log('===================');
    
    const isConnected = detailData.lockData?.isConnected || stateData.state === 1;
    const battery = detailData.lockData?.batteryCapacity || detailData.lockData?.electricQuantity || stateData.electricQuantity;
    
    console.log(`Lock Online: ${isConnected ? 'YES' : 'NO'}`);
    console.log(`Battery Level: ${battery || 'Unknown'}%`);
    console.log(`Active Passcodes: ${passcodeData.list?.length || 0}`);
    
    if (!isConnected) {
      console.log('\n⚠️  PROBLEM IDENTIFIED:');
      console.log('Your physical lock is OFFLINE from the TTLock cloud service.');
      console.log('This means:');
      console.log('- Passcodes are sent to the cloud successfully');
      console.log('- But your physical lock cannot receive them');
      console.log('- The lock needs to be reconnected to Wi-Fi/Bluetooth');
      console.log('\n🔧 SOLUTIONS:');
      console.log('1. Check lock\'s Wi-Fi/Bluetooth connection');
      console.log('2. Reset lock\'s network connection via TTLock app');
      console.log('3. Ensure lock has sufficient battery power');
      console.log('4. Move lock closer to Wi-Fi router if needed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkLockConnectivity();