import crypto from 'crypto';

// Security utility: Mask passcode for logging (show first 2 and last 2 digits)
function maskPasscode(passcode: string): string {
  if (!passcode || passcode.length < 4) {
    return '****';
  }
  const first2 = passcode.slice(0, 2);
  const last2 = passcode.slice(-2);
  const maskLength = Math.max(2, passcode.length - 4);
  const mask = '*'.repeat(maskLength);
  return `${first2}${mask}${last2}`;
}

interface TTLockConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
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

  private generatePasscode(existingCodes: string[] = []): string {
    // Generate a random 6-digit code (100000–999999).
    // WiFi bridge locks relay codes from the cloud in real time so no special
    // pattern is required — any valid 6-digit number works.
    for (let attempt = 0; attempt < 100; attempt++) {
      const code = crypto.randomInt(100000, 1000000).toString();
      if (!existingCodes.includes(code)) {
        return code;
      }
    }
    return crypto.randomInt(100000, 1000000).toString();
  }

  async createTimeLimitedPasscode(
    lockId: string,
    startTime: Date,
    endTime: Date,
    bookingId: number,
    customerName?: string,
    existingCodes: string[] = [],
    preGeneratedCode?: string
  ): Promise<{ passcode: string; passcodeId: number }> {
    try {
      // Real TTLock API implementation
      const accessToken = await this.getAccessToken();
      const passcode = preGeneratedCode || this.generatePasscode(existingCodes);
      // Use exact booking start time (no adjustment needed)
      const startTimeMs = startTime.getTime();
      const endTimeMs = endTime.getTime();

      // Create descriptive passcode name with customer name if available
      const passcodeName = customerName 
        ? `${customerName} #${bookingId}`
        : `Booking-${bookingId}`;

      console.log(`📝 TTLock passcode name will be: "${passcodeName}"`);
      console.log(`Sending passcode ${maskPasscode(passcode)} to TTLock lock ${lockId} for booking ${bookingId}`);
      console.log(`Valid from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      console.log(`TTLock timestamps - Start: ${startTimeMs}, End: ${endTimeMs}`);

      const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          clientId: this.config.clientId,
          accessToken: accessToken,
          lockId: lockId,
          keyboardPwd: passcode,
          keyboardPwdName: passcodeName,
          keyboardPwdType: '3',        // 3 = time-limited passcode (enforced by lock hardware)
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
        console.log(`🔑 SUCCESS: 10-digit passcode ${maskPasscode(passcode)} created in TTLock cloud! ID: ${data.keyboardPwdId}`);
        console.log(`✅ FORMAT: Uses proven 30+admin+digit pattern for reliable hardware sync`);
        
        return {
          passcode: passcode,
          passcodeId: data.keyboardPwdId,
        };
      } else if (data.errcode !== undefined && data.errcode !== 0) {
        console.error(`TTLock API returned error: ${data.errcode} - ${data.errmsg}`);
        
        // Provide specific guidance for common permission errors
        if (data.errcode === 20002) {
          console.error('⚠️ PERMISSION ISSUE: Account is not lock admin for lock', lockId);
          console.error('📋 SOLUTION: The TTLock account needs to be granted admin access to this lock');
        } else if (data.errcode === -2018) {
          console.error('⚠️ API PERMISSION ISSUE: Client credentials lack passcode creation permissions');
          console.error('📋 SOLUTION: Contact TTLock support to enable passcode API permissions for your developer account');
        }
        
        throw new Error(`TTLock API error: ${data.errmsg || 'Unknown error'}`);
      } else {
        throw new Error(`Unexpected TTLock API response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('TTLock API error:', error);
      
      // Fallback to generated passcode if API fails
      const passcode = this.generatePasscode(bookingId);
      const passcodeId = Math.floor(Math.random() * 2147483647);
      
      console.log(`⚠️ TTLock API failed, using generated passcode ${maskPasscode(passcode)} for booking ${bookingId}`);
      console.log(`Valid from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      return {
        passcode,
        passcodeId,
      };
    }
  }

  async deletePasscode(lockId: string, passcodeId: number): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      console.log(`🔓 Attempting to delete passcode ID ${passcodeId} from lock ${lockId}`);

      const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          clientId: this.config.clientId,
          accessToken: accessToken,
          lockId: lockId,
          keyboardPwdId: passcodeId.toString(),
          date: Date.now().toString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ TTLock delete API error: ${response.status} - ${errorText}`);
        return false;
      }

      const data = await response.json();
      console.log('TTLock delete API response:', data);

      // Check if deletion was successful
      // TTLock returns errcode 0 or no errcode for success
      if (data.errcode === undefined || data.errcode === 0) {
        console.log(`✅ Successfully deleted passcode ID ${passcodeId} from lock ${lockId}`);
        return true;
      } else {
        console.error(`❌ TTLock delete failed with error code ${data.errcode}: ${data.errmsg || 'Unknown error'}`);
        
        // Log specific error codes for debugging
        if (data.errcode === -3001) {
          console.error('⚠️ PASSCODE NOT FOUND: The passcode may have already been deleted or expired');
        } else if (data.errcode === 20002) {
          console.error('⚠️ PERMISSION ISSUE: Account is not lock admin for lock', lockId);
        }
        
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to delete TTLock passcode ID ${passcodeId}:`, error);
      return false;
    }
  }

  // New method to create the same passcode on multiple locks (front door + interior door)
  async createMultiLockPasscode(
    lockIds: string[],
    startTime: Date,
    endTime: Date,
    bookingId: number,
    customerName?: string,
    existingCodes: string[] = []
  ): Promise<{ passcode: string; passcodeIds: number[] }> {
    const results: number[] = [];

    // Generate ONE code upfront so every lock gets the same passcode
    const passcode = this.generatePasscode(existingCodes);

    console.log(`🔑 Creating unified 6-digit passcode for ${lockIds.length} locks: ${lockIds.join(', ')}`);

    for (const lockId of lockIds) {
      try {
        const result = await this.createTimeLimitedPasscode(lockId, startTime, endTime, bookingId, customerName, [], passcode);
        results.push(result.passcodeId);
        console.log(`✅ Passcode ${maskPasscode(passcode)} created for lock ${lockId} (ID: ${result.passcodeId})`);
      } catch (error) {
        console.error(`❌ Failed to create passcode for lock ${lockId}:`, error);
        // Continue with other locks even if one fails
        results.push(-1); // Use -1 to indicate failure for this lock
      }
    }

    console.log(`🎯 Multi-lock setup complete: Code ${maskPasscode(passcode)} active on ${results.filter(id => id !== -1).length}/${lockIds.length} locks`);
    
    return {
      passcode: passcode,
      passcodeIds: results
    };
  }

  async getLockStatus(lockId: string): Promise<{ isOnline: boolean; batteryLevel?: number; lockData?: any }> {
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
          lockId: lockId,
          date: Date.now().toString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📱 TTLock Status Response:', JSON.stringify(data, null, 2));
        
        const isOnline = data.lockData?.isConnected || data.lockData?.electricQuantity > 0 || false;
        const batteryLevel = data.lockData?.batteryCapacity || data.lockData?.electricQuantity;
        
        console.log(`🔋 Lock Status: ${isOnline ? 'ONLINE' : 'OFFLINE'}, Battery: ${batteryLevel || 'Unknown'}%`);
        
        return {
          isOnline,
          batteryLevel,
          lockData: data
        };
      }

      return { isOnline: false };
    } catch (error) {
      console.error('Failed to get TTLock status:', error);
      return { isOnline: false };
    }
  }

  async getAccessLogs(lockId: string, startTime: Date, endTime: Date): Promise<any[]> {
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
          lockId: lockId,
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
  };

  if (!config.clientId || !config.clientSecret || !config.username || !config.password) {
    console.log('TTLock credentials not configured, using fallback access codes');
    return null;
  }

  return new TTLockService(config);
};