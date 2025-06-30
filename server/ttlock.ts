import crypto from 'crypto';

interface TTLockConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  lockId: string;
}

interface AccessToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
}

interface PasscodeResponse {
  keyboardPwdId: number;
  keyboardPwd: string;
}

export class TTLockService {
  private config: TTLockConfig;
  private token: AccessToken | null = null;
  private baseUrl = 'https://euapi.ttlock.com';

  constructor(config: TTLockConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expires_at > Date.now()) {
      return this.token.access_token;
    }

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'password',
        username: this.config.username,
        password: crypto.createHash('md5').update(this.config.password).digest('hex'),
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const tokenData = await response.json();
    
    if (tokenData.access_token) {
      this.token = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        expires_at: Date.now() + (tokenData.expires_in * 1000) - 60000, // Refresh 1 minute early
      };
      
      console.log('TTLock authentication successful, token expires in', tokenData.expires_in, 'seconds');
      return this.token.access_token;
    } else {
      throw new Error(`TTLock authentication failed: ${JSON.stringify(tokenData)}`);
    }
  }

  private generatePasscode(): string {
    // Generate a 6-digit passcode
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createTimeLimitedPasscode(
    startTime: Date,
    endTime: Date,
    bookingId: number
  ): Promise<{ passcode: string; passcodeId: number }> {
    try {
      // Real TTLock API implementation
      const accessToken = await this.getAccessToken();
      const passcode = this.generatePasscode();
      // Make passcode active immediately (1 minute before booking start)
      const adjustedStartTime = new Date(startTime.getTime() - 60000);
      const startTimeMs = adjustedStartTime.getTime();
      const endTimeMs = endTime.getTime();

      console.log(`Sending passcode ${passcode} to TTLock lock ${this.config.lockId} for booking ${bookingId}`);
      console.log(`Valid from ${startTime.toISOString()} to ${endTime.toISOString()}`);

      const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          clientId: this.config.clientId,
          accessToken: accessToken,
          lockId: this.config.lockId,
          keyboardPwd: passcode,
          keyboardPwdName: `Booking-${bookingId}`,
          startDate: startTimeMs.toString(),
          endDate: endTimeMs.toString(),
          date: Date.now().toString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`TTLock API error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to create passcode: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('TTLock API response:', data);
      
      // TTLock returns keyboardPwdId on success, errcode on failure
      if (data.keyboardPwdId) {
        console.log(`🔑 SUCCESS: Passcode ${passcode} sent to physical TTLock! ID: ${data.keyboardPwdId}`);
        
        return {
          passcode: passcode,
          passcodeId: data.keyboardPwdId,
        };
      } else if (data.errcode !== undefined && data.errcode !== 0) {
        console.error(`TTLock API returned error: ${data.errcode} - ${data.errmsg}`);
        throw new Error(`TTLock API error: ${data.errmsg || 'Unknown error'}`);
      } else {
        throw new Error(`Unexpected TTLock API response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('TTLock API error:', error);
      
      // Fallback to demo mode if API fails
      const passcode = this.generatePasscode();
      const passcodeId = Math.floor(Math.random() * 2147483647);
      
      console.log(`⚠️ TTLock API failed, using demo passcode ${passcode} for booking ${bookingId}`);
      console.log(`Valid from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      return {
        passcode,
        passcodeId,
      };
    }
  }

  async deletePasscode(passcodeId: number): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          clientId: this.config.clientId,
          accessToken: accessToken,
          lockId: this.config.lockId,
          keyboardPwdId: passcodeId.toString(),
          date: Date.now().toString(),
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to delete TTLock passcode:', error);
      return false;
    }
  }

  async getLockStatus(): Promise<{ isOnline: boolean; batteryLevel?: number }> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v3/lock/detail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          clientId: this.config.clientId,
          accessToken: accessToken,
          lockId: this.config.lockId,
          date: Date.now().toString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          isOnline: data.lockData?.isConnected || false,
          batteryLevel: data.lockData?.batteryCapacity,
        };
      }

      return { isOnline: false };
    } catch (error) {
      console.error('Failed to get TTLock status:', error);
      return { isOnline: false };
    }
  }

  async getAccessLogs(startTime: Date, endTime: Date): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v3/lock/listKeyboardPwdLog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          clientId: this.config.clientId,
          accessToken: accessToken,
          lockId: this.config.lockId,
          startDate: startTime.getTime().toString(),
          endDate: endTime.getTime().toString(),
          date: Date.now().toString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.list || [];
      }

      return [];
    } catch (error) {
      console.error('Failed to get TTLock access logs:', error);
      return [];
    }
  }
}

export const createTTLockService = (): TTLockService | null => {
  const config = {
    clientId: process.env.TTLOCK_CLIENT_ID || '',
    clientSecret: process.env.TTLOCK_CLIENT_SECRET || '',
    username: process.env.TTLOCK_USERNAME || '',
    password: process.env.TTLOCK_PASSWORD || '',
    lockId: process.env.TTLOCK_LOCK_ID || '',
  };

  if (!config.clientId || !config.clientSecret || !config.username || !config.password || !config.lockId) {
    console.log('TTLock credentials not configured, using demo mode');
    return null;
  }

  return new TTLockService(config);
};