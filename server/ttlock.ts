import crypto from 'crypto';

// Error class for TTLock failures that should not be retried (e.g. permission denied)
class NonRetryableTTLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableTTLockError';
  }
}

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

  private generatePasscode(bookingId: number): string {
    // 6-digit code — TTLock gateway sync requires 6-9 digits (addType:2 enforces this)
    return Math.floor(Math.random() * 900000 + 100000).toString();
  }

  // Public method to generate a passcode string without pushing to the lock
  generatePasscodeString(): string {
    return Math.floor(Math.random() * 900000 + 100000).toString();
  }

  async createTimeLimitedPasscode(
    lockId: string,
    startTime: Date,
    endTime: Date,
    bookingId: number,
    customerName?: string
  ): Promise<{ passcode: string; passcodeId: number }> {
    const MAX_ATTEMPTS = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this._attemptCreatePasscode(lockId, startTime, endTime, bookingId, customerName);
        return result;
      } catch (err) {
        lastError = err;
        // Don't retry permanent errors (permission denied, invalid credentials, etc.)
        if (err instanceof NonRetryableTTLockError) {
          console.warn(`⚠️ TTLock permanent error for lock ${lockId} — skipping retries, using fallback code`);
          break;
        }
        if (attempt < MAX_ATTEMPTS) {
          const delay = attempt * 2000; // 2s, 4s
          console.warn(`⚠️ TTLock attempt ${attempt}/${MAX_ATTEMPTS} failed for lock ${lockId}, retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed — fall back to a local code so booking still completes,
    // but log clearly so admin knows to resync
    const passcode = this.generatePasscode(bookingId);
    console.error(`❌ TTLock API failed after ${MAX_ATTEMPTS} attempts for lock ${lockId} (booking ${bookingId}). Fallback code generated — admin must resync.`);
    console.error('Last error:', lastError);
    return { passcode, passcodeId: -1 }; // -1 signals "not registered"
  }

  private async _attemptCreatePasscode(
    lockId: string,
    startTime: Date,
    endTime: Date,
    bookingId: number,
    customerName?: string
  ): Promise<{ passcode: string; passcodeId: number }> {
    try {
      // Real TTLock API implementation
      const accessToken = await this.getAccessToken();
      const passcode = this.generatePasscode(bookingId);
      // If the booking has already started, use now as startDate so the gateway
      // pushes immediately instead of waiting for a past sync point
      const now = Date.now();
      const startTimeMs = startTime.getTime() < now ? now - 60000 : startTime.getTime(); // 1 min buffer
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
          keyboardPwdType: '2',        // 2 = period/timed passcode (start → end date)
          addType: '2',                // 2 = add via Gateway (not Bluetooth)
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
        const isPermanent = data.errcode === 20002 || data.errcode === -2018 || data.errcode === -1002 || data.errcode === -3009;
        if (data.errcode === 20002) {
          console.error('⚠️ PERMISSION ISSUE: Account is not lock admin for lock', lockId);
          console.error('📋 SOLUTION: The TTLock account needs to be granted admin access to this lock');
        } else if (data.errcode === -2018) {
          console.error('⚠️ API PERMISSION ISSUE: Client credentials lack passcode creation permissions');
          console.error('📋 SOLUTION: Contact TTLock support to enable passcode API permissions for your developer account');
        }
        
        if (isPermanent) {
          throw new NonRetryableTTLockError(`TTLock API error: ${data.errmsg || 'Unknown error'} (errcode ${data.errcode})`);
        }
        throw new Error(`TTLock API error: ${data.errmsg || 'Unknown error'}`);
      } else {
        throw new Error(`Unexpected TTLock API response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      // Re-throw so the retry loop in createTimeLimitedPasscode can handle it
      throw error;
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

  // Push a specific pre-generated passcode string to a single lock.
  // Used by the rolling-window scheduler to activate codes as sessions approach.
  async pushPasscodeToLock(
    lockId: string,
    passcode: string,
    startTime: Date,
    endTime: Date,
    bookingId: number,
    customerName?: string
  ): Promise<{ passcode: string; passcodeId: number }> {
    // Guard: don't push a code whose validity window has already closed
    if (endTime.getTime() <= Date.now()) {
      console.warn(`⚠️ Skipping push for booking ${bookingId} on lock ${lockId} — end time ${endTime.toISOString()} is already in the past`);
      return { passcode, passcodeId: -1 };
    }

    const MAX_ATTEMPTS = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const accessToken = await this.getAccessToken();
        const passcodeName = customerName ? `${customerName} #${bookingId}` : `Booking-${bookingId}`;
        const now = Date.now();
        const startTimeMs = startTime.getTime() < now ? now - 60000 : startTime.getTime();

        const response = await fetch(`${this.baseUrl}/v3/keyboardPwd/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            clientId: this.config.clientId,
            accessToken,
            lockId,
            keyboardPwd: passcode,
            keyboardPwdName: passcodeName,
            keyboardPwdType: '2',
            addType: '2',
            startDate: startTimeMs.toString(),
            endDate: endTime.getTime().toString(),
            date: Date.now().toString(),
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.keyboardPwdId) {
          console.log(`✅ Scheduler pushed passcode ${maskPasscode(passcode)} to lock ${lockId} (ID: ${data.keyboardPwdId})`);
          return { passcode, passcodeId: data.keyboardPwdId };
        }

        const isPermanent = [-2018, 20002, -1002, -3009].includes(data.errcode);
        if (isPermanent) throw new NonRetryableTTLockError(`errcode ${data.errcode}: ${data.errmsg}`);
        throw new Error(`TTLock errcode ${data.errcode}: ${data.errmsg}`);
      } catch (err) {
        lastError = err;
        if (err instanceof NonRetryableTTLockError) break;
        if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }

    console.error(`❌ pushPasscodeToLock failed for lock ${lockId} booking ${bookingId}:`, lastError);
    return { passcode, passcodeId: -1 };
  }

  // Create the same passcode on multiple locks (front door + interior door)
  async createMultiLockPasscode(
    lockIds: string[],
    startTime: Date,
    endTime: Date,
    bookingId: number,
    customerName?: string
  ): Promise<{ passcode: string; passcodeIds: number[] }> {
    const results: number[] = [];
    let passcode = '';

    console.log(`🔑 Creating unified passcode for ${lockIds.length} locks: ${lockIds.join(', ')}`);

    for (const lockId of lockIds) {
      try {
        const result = await this.createTimeLimitedPasscode(lockId, startTime, endTime, bookingId, customerName);
        passcode = result.passcode; // Same passcode for all locks
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

  // Fetch every passcode currently stored on a lock from the TTLock cloud.
  // Returns an array of { keyboardPwdId, keyboardPwdName, keyboardPwdType, startDate, endDate, isCustom, status }
  async listPasscodes(lockId: string): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      const allCodes: any[] = [];
      let pageNo = 1;
      const pageSize = 100;

      while (true) {
        const response = await fetch(`${this.baseUrl}/v3/lock/listKeyboardPwd`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            clientId: this.config.clientId,
            accessToken,
            lockId,
            pageNo: pageNo.toString(),
            pageSize: pageSize.toString(),
            date: Date.now().toString(),
          }),
        });

        if (!response.ok) break;
        const data = await response.json();
        const list: any[] = data.list || [];
        allCodes.push(...list);
        if (list.length < pageSize) break; // last page
        pageNo++;
      }

      return allCodes;
    } catch (error) {
      console.error('Failed to list TTLock passcodes:', error);
      return [];
    }
  }

  // Delete every passcode on the lock that is NOT in the keepIds set.
  // Returns { deleted, failed, kept } counts.
  async purgeOrphanedPasscodes(
    lockId: string,
    keepIds: Set<number>
  ): Promise<{ deleted: number; failed: number; kept: number; errors: string[] }> {
    const allCodes = await this.listPasscodes(lockId);
    let deleted = 0, failed = 0, kept = 0;
    const errors: string[] = [];

    for (const code of allCodes) {
      const id: number = code.keyboardPwdId;
      if (keepIds.has(id)) {
        kept++;
        continue;
      }
      const ok = await this.deletePasscode(lockId, id);
      if (ok) {
        deleted++;
        console.log(`🧹 Purged orphaned code "${code.keyboardPwdName}" (ID ${id}) from lock ${lockId}`);
      } else {
        failed++;
        errors.push(`Failed to delete code ID ${id} (${code.keyboardPwdName || 'unnamed'})`);
      }
    }

    console.log(`🧹 Purge complete for lock ${lockId}: ${deleted} deleted, ${kept} kept, ${failed} failed`);
    return { deleted, failed, kept, errors };
  }

  // Delete ALL codes on a lock that belong to a specific booking ID.
  // Codes are named "CustomerName #bookingId" or "Booking-bookingId" — match on the numeric suffix.
  async deleteAllBookingCodes(lockId: string, bookingId: number): Promise<number> {
    const allCodes = await this.listPasscodes(lockId);
    const suffix = `#${bookingId}`;
    const altSuffix = `-${bookingId}`;
    const matching = allCodes.filter(c =>
      (c.keyboardPwdName ?? '').endsWith(suffix) ||
      (c.keyboardPwdName ?? '').endsWith(altSuffix)
    );

    let deleted = 0;
    for (const code of matching) {
      const ok = await this.deletePasscode(lockId, code.keyboardPwdId);
      if (ok) {
        deleted++;
        console.log(`🗑 Deleted stale code "${code.keyboardPwdName}" (ID ${code.keyboardPwdId}) for booking ${bookingId}`);
      }
    }
    return deleted;
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