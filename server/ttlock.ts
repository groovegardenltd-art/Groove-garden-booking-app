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
    if (this.token && Date.now() < this.token.expires_at) {
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
        username: this.config.username,
        password: this.config.password,
        grant_type: 'password',
      }),
    });

    if (!response.ok) {
      throw new Error(`TTLock auth failed: ${response.status}`);
    }

    const data = await response.json();
    this.token = {
      ...data,
      expires_at: Date.now() + (data.expires_in * 1000) - 60000, // 1 minute buffer
    };

    return this.token.access_token;
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
    const accessToken = await this.getAccessToken();
    const passcode = this.generatePasscode();

    const startTimeMs = startTime.getTime();
    const endTimeMs = endTime.getTime();

    const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${accessToken}`,
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
    
    if (data.errcode !== 0) {
      console.error(`TTLock API returned error: ${data.errcode} - ${data.errmsg}`);
      throw new Error(`TTLock API error: ${data.errmsg || 'Unknown error'}`);
    }
    
    return {
      passcode: data.keyboardPwd,
      passcodeId: data.keyboardPwdId,
    };
  }

  async deletePasscode(passcodeId: number): Promise<boolean> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${accessToken}`,
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
  }

  async getLockStatus(): Promise<{ isOnline: boolean; batteryLevel?: number }> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v3/lock/detail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: new URLSearchParams({
        clientId: this.config.clientId,
        accessToken: accessToken,
        lockId: this.config.lockId,
        date: Date.now().toString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get lock status: ${response.status}`);
    }

    const data = await response.json();
    return {
      isOnline: data.isOnline === 1,
      batteryLevel: data.electricQuantity,
    };
  }

  async getAccessLogs(startTime: Date, endTime: Date): Promise<any[]> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v3/lock/listKeyboardPwdLog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: new URLSearchParams({
        clientId: this.config.clientId,
        accessToken: accessToken,
        lockId: this.config.lockId,
        startDate: startTime.getTime().toString(),
        endDate: endTime.getTime().toString(),
        pageNo: '1',
        pageSize: '100',
        date: Date.now().toString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access logs: ${response.status}`);
    }

    const data = await response.json();
    return data.list || [];
  }
}

// Initialize TTLock service
export const createTTLockService = (): TTLockService | null => {
  const config = {
    clientId: process.env.TTLOCK_CLIENT_ID || '',
    clientSecret: process.env.TTLOCK_CLIENT_SECRET || '',
    username: process.env.TTLOCK_USERNAME || '',
    password: process.env.TTLOCK_PASSWORD || '',
    lockId: process.env.TTLOCK_LOCK_ID || '',
  };

  // Check if all required config is present
  if (!config.clientId || !config.clientSecret || !config.username || !config.password || !config.lockId) {
    console.warn('TTLock configuration incomplete - smart lock features disabled');
    return null;
  }

  return new TTLockService(config);
};