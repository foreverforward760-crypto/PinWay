/**
 * notificationService.js
 * Handles PIN delivery via SMS (Twilio) and Email (SendGrid).
 *
 * Required environment variables:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *   SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME
 */

const logger = require("../config/logger");

// ─── Twilio SMS ───────────────────────────────────────────────────────────────
let twilioClient = null;
function getTwilio() {
  if (!twilioClient) {
    const twilio = require("twilio");
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

/**
 * Send a PIN to a recipient via SMS.
 * @param {string} toPhone   E.164 format, e.g. "+13055551234"
 * @param {string} rawPin    The 16-digit PIN
 * @param {number} amount    Dollar amount
 * @param {string} description  Description of the disbursement
 */
async function sendPinBySms(toPhone, rawPin, amount, description) {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    logger.warn("Twilio not configured — SMS not sent");
    return;
  }

  const formatted = rawPin.replace(/(.{4})/g, "$1 ").trim();
  const body =
    `PinWay: You've received $${Number(amount).toFixed(2)} — "${description}"\n\n` +
    `Your 16-digit PIN: ${formatted}\n\n` +
    `Use at participating merchants. Tap to view restrictions: https://pinway.app/redeem`;

  try {
    const msg = await getTwilio().messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to: toPhone,
    });
    logger.info(`SMS sent to ${toPhone} — SID: ${msg.sid}`);
  } catch (err) {
    logger.error(`Twilio SMS failed: ${err.message}`);
    throw err;
  }
}

// ─── SendGrid Email ───────────────────────────────────────────────────────────
/**
 * Send a PIN to a recipient via email.
 * @param {string} toEmail
 * @param {string} recipientName
 * @param {string} rawPin
 * @param {number} amount
 * @param {string} description
 */
async function sendPinByEmail(toEmail, recipientName, rawPin, amount, description) {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn("SendGrid not configured — email not sent");
    return;
  }

  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const formatted = rawPin.replace(/(.{4})/g, "$1 ").trim();
  const amountFormatted = `$${Number(amount).toFixed(2)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f1f5f9; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #1e293b; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; color: white; }
    .header p { margin: 8px 0 0; color: #d1fae5; font-size: 14px; }
    .body { padding: 32px; }
    .pin-box { background: #0f172a; border: 2px solid #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
    .pin-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; }
    .pin-number { font-size: 28px; font-weight: bold; color: #34d399; letter-spacing: 6px; font-family: monospace; }
    .amount { font-size: 36px; font-weight: 800; color: #f1f5f9; text-align: center; margin: 16px 0; }
    .desc { text-align: center; color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .warning { background: #422006; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #fef3c7; }
    .footer { padding: 16px 32px; background: #0f172a; text-align: center; font-size: 12px; color: #475569; }
    a { color: #34d399; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PinWay</h1>
      <p>Secure PIN-based funds</p>
    </div>
    <div class="body">
      <p>Hi ${recipientName || "there"},</p>
      <p>You've received funds via PinWay:</p>
      <div class="amount">${amountFormatted}</div>
      <div class="desc">${description}</div>
      <div class="pin-box">
        <div class="pin-label">Your 16-Digit PIN</div>
        <div class="pin-number">${formatted}</div>
      </div>
      <p style="font-size:14px; color:#94a3b8;">
        Use this PIN at participating merchants. The PIN may have spending restrictions
        (merchant types, geographies, or daily limits) set by the sender.
      </p>
      <div class="warning">
        ⚠️ Never share this PIN with anyone. PinWay will never ask for your PIN via phone or email.
      </div>
    </div>
    <div class="footer">
      PinWay &bull; Secure Fund Disbursement &bull; <a href="https://pinway.app">pinway.app</a><br/>
      If you did not expect this payment, please contact the sender.
    </div>
  </div>
</body>
</html>`;

  const msg = {
    to: toEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || "noreply@pinway.app",
      name: process.env.SENDGRID_FROM_NAME || "PinWay",
    },
    subject: `You've received ${amountFormatted} via PinWay`,
    text: `Hi ${recipientName || "there"},\n\nYou've received ${amountFormatted} — "${description}"\n\nYour 16-digit PIN: ${formatted}\n\nUse at participating merchants. Never share your PIN with anyone.`,
    html,
  };

  try {
    await sgMail.send(msg);
    logger.info(`PIN email sent to ${toEmail}`);
  } catch (err) {
    logger.error(`SendGrid email failed: ${err.message}`);
    throw err;
  }
}

module.exports = { sendPinBySms, sendPinByEmail };
