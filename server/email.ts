import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY not found - email notifications disabled');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Helper function to get the correct base URL for the current environment
function getBaseUrl(): string {
  // Priority 1: Explicit BASE_URL configuration
  if (process.env.BASE_URL || process.env.FRONTEND_BASE_URL) {
    return process.env.BASE_URL || process.env.FRONTEND_BASE_URL!;
  }
  
  // Priority 2: Replit external hostname (for custom domains)
  if (process.env.REPLIT_EXTERNAL_HOSTNAME) {
    return `https://${process.env.REPLIT_EXTERNAL_HOSTNAME}`;
  }
  
  // Priority 3: Environment-specific defaults
  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  
  if (isDeployment && process.env.REPL_SLUG) {
    // Published site - use the published domain
    return `https://${process.env.REPL_SLUG}.replit.app`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    // Development environment - use development domain
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (process.env.REPL_SLUG && process.env.REPLIT_CLUSTER) {
    // Fallback development URL
    return `https://${process.env.REPL_SLUG}.${process.env.REPLIT_CLUSTER}.repl.co`;
  }
  
  // Critical: Log error and refuse to send broken links
  console.error('Could not determine base URL for email links. Email sending aborted.');
  console.error('Available env vars:', {
    BASE_URL: !!process.env.BASE_URL,
    FRONTEND_BASE_URL: !!process.env.FRONTEND_BASE_URL,
    REPLIT_EXTERNAL_HOSTNAME: !!process.env.REPLIT_EXTERNAL_HOSTNAME,
    REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
    REPL_SLUG: !!process.env.REPL_SLUG,
    REPLIT_DEV_DOMAIN: !!process.env.REPLIT_DEV_DOMAIN,
    REPLIT_CLUSTER: !!process.env.REPLIT_CLUSTER
  });
  
  throw new Error('Unable to determine base URL for email links');
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('Email notification skipped - no SendGrid API key configured');
    return false;
  }

  try {
    const mailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
    };
    
    if (params.text) mailData.text = params.text;
    if (params.html) mailData.html = params.html;
    
    await sgMail.send(mailData);
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function notifyPendingIdVerification(userName: string, userEmail: string, idType: string, adminEmail: string): Promise<boolean> {
  try {
  const subject = `New ID Verification Pending Review - ${userName}`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
        🔍 New ID Verification Pending
      </h2>
      
      <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h3 style="color: #92400e; margin: 0 0 10px 0;">Action Required</h3>
        <p style="color: #92400e; margin: 0;">A new user has submitted their ID for verification and needs manual review.</p>
      </div>
      
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #374151; margin: 0 0 15px 0;">User Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Name:</td>
            <td style="padding: 8px 0; color: #374151;">${userName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Email:</td>
            <td style="padding: 8px 0; color: #374151;">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">ID Type:</td>
            <td style="padding: 8px 0; color: #374151;">${idType}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="color: #1e40af; margin: 0 0 10px 0;">Review Instructions</h4>
        <ol style="color: #1e40af; margin: 0; padding-left: 20px;">
          <li>Visit the admin panel to review the uploaded ID photo</li>
          <li>Verify the photo is clear and matches the provided information</li>
          <li>Approve or reject the verification</li>
        </ol>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${getBaseUrl()}/admin/id-verification" 
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Review ID Verification
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
        Groove Garden Studios - ID Verification System<br>
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  `;
  
  const textContent = `
New ID Verification Pending Review

User: ${userName}
Email: ${userEmail}
ID Type: ${idType}

Action Required: A new user has submitted their ID for verification and needs manual review.

Please visit the admin panel to review the uploaded ID photo and approve or reject the verification.

Review URL: ${getBaseUrl()}/admin/id-verification

---
Groove Garden Studios - ID Verification System
  `;

    return await sendEmail({
      to: adminEmail,
      from: 'groovegardenltd@gmail.com', // Using your verified email address
      subject,
      text: textContent,
      html: htmlContent
    });
  } catch (error) {
    console.error('Failed to send ID verification notification:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, username: string, resetToken: string): Promise<boolean> {
  try {
    const baseUrl = getBaseUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const subject = 'Password Reset Request - Groove Garden Studios';
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">Groove Garden Studios</h1>
        <p style="color: #6b7280; margin: 5px 0;">Music Rehearsal Studio</p>
      </div>
      
      <h2 style="color: #374151;">Password Reset Request</h2>
      <p>Hello ${username},</p>
      
      <p>We received a request to reset your password for your Groove Garden Studios account. If you made this request, please click the button below to set a new password:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset My Password
        </a>
      </div>
      
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;"><strong>Security Notice:</strong> This link will expire in 1 hour for your security.</p>
      </div>
      
      <p style="color: #6b7280;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      
      <p style="color: #6b7280; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        This email was sent for your account security.<br>
        Groove Garden Studios | Music Rehearsal Space
      </p>
    </div>
  `;
  
  const textContent = `
Password Reset Request - Groove Garden Studios

Hello ${username},

We received a request to reset your password for your Groove Garden Studios account. 

To reset your password, please visit the following link:
${resetUrl}

This link will expire in 1 hour for your security.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

---
Groove Garden Studios - Music Rehearsal Space
  `;

    return await sendEmail({
      to: email,
      from: 'groovegardenltd@gmail.com',
      subject,
      text: textContent,
      html: htmlContent
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

export async function sendRejectionNotification(email: string, username: string, reason: string, cancelledBookings: number) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured - skipping email');
    return;
  }

  const subject = 'Account Verification Update - Groove Garden Studios';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">Groove Garden Studios</h1>
        <p style="color: #6b7280; margin: 5px 0;">Music Rehearsal Studio</p>
      </div>
      
      <h2 style="color: #374151;">Account Verification Update</h2>
      <p>Hello ${username},</p>
      
      <p>We have reviewed your submitted verification documents. Unfortunately, we need you to resubmit your verification due to:</p>
      
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;"><strong>Review Notes:</strong> ${reason}</p>
      </div>
      
      ${cancelledBookings > 0 ? `
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #dc2626;"><strong>Booking Update:</strong> ${cancelledBookings} upcoming booking${cancelledBookings !== 1 ? 's have' : ' has'} been temporarily suspended until verification is complete.</p>
      </div>
      ` : ''}
      
      <h3 style="color: #374151;">Next Steps</h3>
      <p>Please resubmit your verification documents with:</p>
      <ul style="color: #4b5563;">
        <li>Clear, well-lit photos</li>
        <li>All document details clearly visible</li>
        <li>Valid, current identification</li>
        <li>Name matching your account details</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Update Verification</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">Questions? Contact our support team at groovegardenltd@gmail.com</p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        This email was sent to verify your account security.<br>
        Groove Garden Studios | Music Rehearsal Space
      </p>
    </div>
  `;

  await sendEmail({
    to: email,
    from: 'groovegardenltd@gmail.com',
    subject,
    html
  });
}