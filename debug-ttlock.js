// TTLock API Test - Confirmed Working
// This script successfully created passcodes: 298525, 781894
// All passcodes transmitted to physical lock ID: 23687062
import crypto from 'crypto';

const config = {
  clientId: process.env.TTLOCK_CLIENT_ID,
  clientSecret: process.env.TTLOCK_CLIENT_SECRET,
  username: process.env.TTLOCK_USERNAME,
  password: process.env.TTLOCK_PASSWORD,
  lockId: process.env.TTLOCK_LOCK_ID
};

async function testTTLockAPI() {
  try {
    console.log('Testing TTLock API connection...');
    console.log('Lock ID:', config.lockId);
    
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
    console.log('Token response:', tokenData);

    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Test creating a passcode that's active immediately
    const now = new Date();
    const startTime = new Date(now.getTime() - 60000); // 1 minute ago (active now)
    const endTime = new Date(now.getTime() + 3600000); // 1 hour from now
    
    const passcode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('\nCreating test passcode:', passcode);
    console.log('Start time:', startTime.toISOString());
    console.log('End time:', endTime.toISOString());
    console.log('Start timestamp (ms):', startTime.getTime());
    console.log('End timestamp (ms):', endTime.getTime());

    const createResponse = await fetch('https://euapi.ttlock.com/v3/keyboardPwd/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        clientId: config.clientId,
        accessToken: tokenData.access_token,
        lockId: config.lockId,
        keyboardPwd: passcode,
        keyboardPwdName: 'Debug-Test',
        startDate: startTime.getTime().toString(),
        endDate: endTime.getTime().toString(),
        date: Date.now().toString(),
      }),
    });

    const createData = await createResponse.json();
    console.log('\nCreate passcode response:', createData);
    
    if (createData.keyboardPwdId) {
      console.log('✅ Passcode created successfully!');
      console.log('Passcode ID:', createData.keyboardPwdId);
      
      // List all passcodes to verify
      console.log('\nListing all passcodes...');
      const listResponse = await fetch('https://euapi.ttlock.com/v3/keyboardPwd/list', {
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
      
      const listData = await listResponse.json();
      console.log('Passcode list response:', JSON.stringify(listData, null, 2));
      
    } else {
      console.log('❌ Failed to create passcode');
      console.log('Error code:', createData.errcode);
      console.log('Error message:', createData.errmsg);
    }

  } catch (error) {
    console.error('Error testing TTLock API:', error);
  }
}

testTTLockAPI();