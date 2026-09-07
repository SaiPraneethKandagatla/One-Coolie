const nodemailer = require('nodemailer');

/*
|--------------------------------------------------------------------------
| Email Service — Gmail SMTP via Nodemailer
|--------------------------------------------------------------------------
|
| Free · 500 emails/day · No domain required · Any recipient works
|
| SETUP:
|   1. Create/use a Gmail account for OneCoolie
|        e.g. noreply.onecoolie@gmail.com
|   2. Enable 2-Step Verification:
|        https://myaccount.google.com/security
|   3. Create App Password:
|        https://myaccount.google.com/apppasswords
|        → Name it "OneCoolie"
|        → Copy the 16-char password (no spaces needed)
|   4. Set in server/.env:
|        GMAIL_USER=noreply.onecoolie@gmail.com
|        GMAIL_APP_PASSWORD=abcdefghijklmnop
|
*/

const FROM_NAME  = process.env.OTP_FROM_NAME || 'OneCoolie';
const FROM_EMAIL = process.env.GMAIL_USER;

const buildOtpHtml = (otp, expiryMinutes = 10) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Your OneCoolie OTP</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#000;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="background:#2563EB;width:36px;height:36px;border-radius:10px;display:inline-block;text-align:center;line-height:36px;color:#fff;font-weight:700;font-size:14px;vertical-align:middle;">OC</div>
                <span style="color:#fff;font-size:18px;font-weight:700;margin-left:10px;vertical-align:middle;">OneCoolie</span>
              </td>
              <td align="right"><span style="color:#71717a;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Verification</span></td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 6px;color:#71717a;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">One-Time Password</p>
            <h1 style="margin:0 0 16px;color:#09090b;font-size:22px;font-weight:700;">Your verification code</h1>
            <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.6;">
              Use this code to verify your email for OneCoolie. Valid for <strong>${expiryMinutes} minutes</strong>.
            </p>
            <div style="background:#f4f4f5;border-radius:12px;padding:28px;text-align:center;margin:0 0 24px;">
              <span style="font-family:'Courier New',monospace;font-size:48px;font-weight:700;letter-spacing:14px;color:#09090b;">
                ${otp}
              </span>
            </div>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin:0 0 20px;">
              <p style="margin:0;color:#1d4ed8;font-size:13px;line-height:1.5;">
                <strong>Never share this code.</strong> OneCoolie staff will never ask for your OTP. Expires in ${expiryMinutes} minutes.
              </p>
            </div>
            <p style="margin:0;color:#a1a1aa;font-size:12px;">If you didn't request this, ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:16px 32px;">
            <p style="margin:0;color:#a1a1aa;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
              OneCoolie Pilot Network · KZJ · WL · BZA · SC
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

let resendClient = null;
try {
  if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
} catch (e) {
  console.warn('Resend client initialization skipped:', e.message);
}

const sendOtpEmail = async (to, otp, expiryMinutes = 10) => {
  let lastProviderError = null;

  // Option 1: Brevo (Sendinblue) HTTPS REST API (Port 443 — NO custom domain required, delivers to ANY Gmail recipient)
  if (process.env.BREVO_API_KEY) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: FROM_NAME,
            email: process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'onecoolie.noreply@gmail.com',
          },
          to: [{ email: to }],
          subject: `${otp} — Your OneCoolie verification code`,
          htmlContent: buildOtpHtml(otp, expiryMinutes),
          textContent: `Your OneCoolie OTP: ${otp}\n\nExpires in ${expiryMinutes} minutes. Never share this code.`,
        }),
      });

      const resJson = await response.json();
      if (response.ok) {
        console.log('BREVO EMAIL ACCEPTED:', {
          to,
          messageId: resJson.messageId || null,
          messageIds: resJson.messageIds || null
        });
        return resJson;
      } else {
        console.error('BREVO API ERROR:', resJson);
        lastProviderError = new Error(resJson.message || 'Brevo rejected the email request.');
      }
    } catch (err) {
      console.error('BREVO API DELIVERY ERROR:', err.message);
      lastProviderError = err;
    }
  }

  // Option 2: Resend HTTPS REST API (Port 443 — if domain is verified or recipient matches Resend account)
  if (resendClient) {
    try {
      const { data, error } = await resendClient.emails.send({
        from: process.env.RESEND_FROM || 'OneCoolie <onboarding@resend.dev>',
        to: [to],
        subject: `${otp} — Your OneCoolie verification code`,
        html: buildOtpHtml(otp, expiryMinutes),
        text: `Your OneCoolie OTP: ${otp}\n\nExpires in ${expiryMinutes} minutes. Never share this code.`,
      });

      if (error) {
        console.error('RESEND API NOTICE:', error.message || error);
        lastProviderError = new Error(error.message || 'Resend rejected the email request.');
      } else {
        console.log('RESEND EMAIL SENT SUCCESSFULLY:', { to });
        return data;
      }
    } catch (err) {
      console.error('RESEND API DELIVERY ERROR:', err.message);
      lastProviderError = err;
    }
  }

  // Option 3: Gmail SMTP via Nodemailer (Port 465 SSL)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        family: 4,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
        connectionTimeout: 10000,
      });

      const info = await transport.sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to,
        subject: `${otp} — Your OneCoolie verification code`,
        html: buildOtpHtml(otp, expiryMinutes),
        text: `Your OneCoolie OTP: ${otp}\n\nExpires in ${expiryMinutes} minutes. Never share this code.`,
      });

      console.log('GMAIL SMTP SENT SUCCESSFULLY:', { messageId: info?.messageId, to });
      return info;
    } catch (err) {
      console.error('GMAIL SMTP DELIVERY ERROR:', err.message);
      throw err;
    }
  }

  throw lastProviderError || new Error(
    'No email provider configured. Set BREVO_API_KEY, RESEND_API_KEY, or both GMAIL_USER and GMAIL_APP_PASSWORD.'
  );
};

const sendOtpSms = async (to, otp, expiryMinutes = 10) => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is required for SMS OTP delivery.');
  }

  const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      sender: process.env.BREVO_SMS_SENDER || 'ONECOOLIE',
      recipient: to,
      content: `Your OneCoolie verification code is ${otp}. It expires in ${expiryMinutes} minutes. Never share this code.`,
      type: 'transactional'
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'Brevo rejected the SMS request.');
  }

  console.log('BREVO SMS ACCEPTED:', { recipient: to, messageId: result.messageId || null });
  return result;
};

module.exports = { sendOtpEmail, sendOtpSms };
