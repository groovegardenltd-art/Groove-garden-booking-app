import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY not found - email notifications disabled');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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
        <a href="${process.env.REPLIT_EXTERNAL_HOSTNAME ? `https://${process.env.REPLIT_EXTERNAL_HOSTNAME}` : 'your-domain.com'}/admin/id-verification" 
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

Review URL: ${process.env.REPLIT_EXTERNAL_HOSTNAME ? `https://${process.env.REPLIT_EXTERNAL_HOSTNAME}` : 'your-domain.com'}/admin/id-verification

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
}