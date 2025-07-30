# TTLock API Setup Guide for Music Rehearsal Studio

## Step 1: Create TTLock Developer Account

1. **Register as a Developer**
   - Go to: https://developer.ttlock.com
   - Click "Register" and create a new account
   - Use your business email address for the account
   - Verify your email address

2. **Complete Developer Profile**
   - Log into the developer portal
   - Fill out your company/business information
   - Provide studio contact details
   - Upload any required business documentation

## Step 2: Create Application

1. **Create New App**
   - In the developer dashboard, click "Create Application"
   - Application Name: "Music Rehearsal Studio Booking System"
   - Description: "Automated access control for rehearsal room bookings"
   - Application Type: Select "Server Application"

2. **Get API Credentials**
   After creating the app, you'll receive:
   - **Client ID**: (e.g., "1234567890abcdef")
   - **Client Secret**: (e.g., "abcdef1234567890ghijklmn")

## Step 3: Find Your Lock Information

1. **Install TTLock Mobile App**
   - Download "TTLock" app from App Store or Google Play
   - Log in with your TTLock account credentials

2. **Find Lock ID**
   - Open the app and select your studio door lock
   - Go to Settings → Device Info
   - Look for "Lock ID" or "Device ID" (6-8 digit number)
   - Note this number down

## Step 4: Set Up Environment Variables

Add these to your Replit Secrets or environment configuration:

```
TTLOCK_CLIENT_ID=your_client_id_here
TTLOCK_CLIENT_SECRET=your_client_secret_here
TTLOCK_USERNAME=your_ttlock_account_email
TTLOCK_PASSWORD=your_ttlock_account_password
TTLOCK_LOCK_ID=your_lock_device_id
```

## Step 5: Test Connection

1. Navigate to the "Smart Lock" page in your booking system
2. Click "Test Connection"
3. Verify the lock shows as "Online" with battery level

## Troubleshooting

**Critical Permission Issues:**

- **Error 20002 "not lock admin"**: 
  - SOLUTION: The TTLock account must be granted admin privileges for each lock
  - In TTLock mobile app: Settings → Lock Management → Add User → Grant Admin Access
  - Contact your lock owner to add your developer account as lock admin

- **Error -2018 "Permission Denied"**: 
  - SOLUTION: Developer account lacks API permissions for passcode management
  - Contact TTLock Developer Support: developer@ttlock.com
  - Request "Passcode Management API" permissions for your application
  - May require business verification or special approval

**Other Common Issues:**
- **Lock Offline**: Ensure lock has WiFi connection and is powered
- **Authentication Failed**: Double-check username/password
- **Invalid Lock ID**: Verify the ID from TTLock mobile app
- **API Rate Limits**: TTLock has rate limits - wait if you get errors

**Current Status:**
- ✅ Booking system working with fallback demo passcodes
- ⚠️ TTLock API integration pending permission resolution
- 📱 Demo passcodes: 6-digit codes generated for each booking
- 🔋 Lock status monitoring operational

**Getting Help:**
- TTLock Developer Support: developer@ttlock.com
- Documentation: https://developer.ttlock.com/docs

## Security Notes

- Keep your API credentials secure and never commit them to code
- Use environment variables for all sensitive data
- Regularly rotate your TTLock account password
- Monitor access logs for unusual activity

## Cost Information

- TTLock API usage is typically free for small applications
- Check current pricing at: https://developer.ttlock.com/pricing
- Monitor your API usage in the developer dashboard