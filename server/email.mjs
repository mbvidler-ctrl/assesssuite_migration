// Transactional email — real Resend adapter behind the house mock-fallback
// pattern (same shape as server/stripeGateway.mjs and server/llm.mjs):
// OUTBOUND_EMAIL_ENABLED=1 plus RESEND_API_KEY, outside self-test/parity mode,
// enables real sends via https://api.resend.com; otherwise this is outbox-only.
// EVERY send — real or not — is also recorded to the
// SQLite outbox_email table as the audit log, so the existing selftest
// assertions and local inspection keep working unchanged.
//
// Zero new npm dependencies: built-in fetch, form-free JSON API.
//
// Delivery failures are logged and never thrown: an email provider outage
// must not 500 a registration or reset request. The OTP/reset flows remain
// recoverable via resend.

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 15000;

// Sender/reply-to per Brenton's 12 July 2026 confirmations: platform mail
// from noreply@assesssuite.com; replies and feedback to admin@assesssuite.com.
const EMAIL_FROM = () => process.env.EMAIL_FROM || 'AssessSuite <noreply@assesssuite.com>';
const EMAIL_REPLY_TO = () => process.env.EMAIL_REPLY_TO || 'admin@assesssuite.com';

export function adminNotificationRecipient(environment = process.env) {
  const configured = environment.EMAIL_ADMIN_NOTIFY;
  return typeof configured === 'string' && configured.trim() !== ''
    ? configured.trim()
    : 'admin@assesssuite.com';
}

const ADMIN_NOTIFY_TO = () => adminNotificationRecipient();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let outbox = null;

/** Called once from server/index.mjs boot with the outbox_email repository. */
export function initEmail(outboxRepo) {
  outbox = outboxRepo;
}

export function emailEnabled(environment = process.env) {
  if (environment.SELFTEST === '1' || environment.PARITY_ASSURANCE_MODE === '1') return false;
  if (environment.OUTBOUND_EMAIL_ENABLED !== '1') return false;
  const key = environment.RESEND_API_KEY;
  return typeof key === 'string' && key.trim() !== '';
}

/**
 * Future real-SMS adapters must branch on this affirmative capability gate.
 * The current SendSMS implementation remains outbox-only regardless of this
 * value; exposing the gate now makes the no-egress release posture explicit.
 */
export function smsEnabled(environment = process.env) {
  if (environment.SELFTEST === '1' || environment.PARITY_ASSURANCE_MODE === '1') return false;
  return environment.OUTBOUND_SMS_ENABLED === '1';
}

/**
 * Records to the outbox (always) and dispatches via Resend (when enabled).
 * Returns { recorded: true, sent: boolean } and never throws.
 */
export async function sendEmail({ to, subject, text, html }) {
  let recorded = false;
  try {
    // Retain delivery metadata only. Transactional message bodies can contain
    // OTPs, password-reset links or future sensitive context and must not be
    // duplicated into an indefinitely retained plaintext audit table.
    if (outbox) {
      outbox.record({ to, subject, body: null });
      recorded = true;
    }
  } catch (err) {
    console.log('[email] outbox record failed:', err.message);
  }
  if (!emailEnabled()) return { recorded, sent: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM(),
          to: [to],
          reply_to: EMAIL_REPLY_TO(),
          subject,
          text,
          ...(html ? { html } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Resend ${res.status}: ${detail.slice(0, 200)}`);
      }
      return { recorded, sent: true };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.log('[email] real send failed (outbox record retained):', err.message);
    return { recorded, sent: false };
  }
}

// ---------------------------------------------------------------------------
// Templates — plain text first (deliverability), minimal HTML wrapper.
// British English; no contractions.
// ---------------------------------------------------------------------------

function htmlWrap(title, bodyHtml) {
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:520px;margin:0 auto;padding:24px">
<h2 style="color:#0f172a;font-size:18px">${escapeHtml(title)}</h2>
${bodyHtml}
<p style="color:#94a3b8;font-size:12px;margin-top:28px">AssessSuite Clinical — a product of Assess Suite Pty Ltd (ABN 53 694 044 481). This is an automated message; replies reach ${escapeHtml(EMAIL_REPLY_TO())}.</p>
</body></html>`;
}

export function otpEmail(code) {
  const safeCode = escapeHtml(code);
  return {
    subject: 'Your AssessSuite verification code',
    text: `Your AssessSuite verification code is: ${code}\n\nThe code expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: htmlWrap(
      'Verify your email',
      `<p>Your AssessSuite verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#0f172a">${safeCode}</p><p>The code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
    ),
  };
}

export function resetEmail(link) {
  const safeLink = escapeHtml(link);
  return {
    subject: 'Reset your AssessSuite password',
    text: `A password reset was requested for your AssessSuite account.\n\nReset your password here (link expires in 60 minutes):\n${link}\n\nIf you did not request this, you can ignore this email — your password is unchanged.`,
    html: htmlWrap(
      'Reset your password',
      `<p>A password reset was requested for your AssessSuite account.</p><p><a href="${safeLink}" style="background:#2563eb;color:#ffffff;padding:10px 22px;border-radius:8px;text-decoration:none;display:inline-block">Reset password</a></p><p>The link expires in 60 minutes. If you did not request this, you can ignore this email — your password is unchanged.</p>`,
    ),
  };
}

export function welcomeEmail(name) {
  const who = name ? ` ${name}` : '';
  const htmlWho = name ? ` ${escapeHtml(name)}` : '';
  return {
    subject: 'Your AssessSuite account is active',
    text: `Welcome${who},\n\nYour AssessSuite account is now active. You can sign in and begin using the platform.\n\nSupport: ${EMAIL_REPLY_TO()} | 1800 317 553 (Mon–Thu, 10 am–2 pm AEST)`,
    html: htmlWrap(
      'Your account is active',
      `<p>Welcome${htmlWho},</p><p>Your AssessSuite account is now active. You can sign in and begin using the platform.</p><p>Support: ${escapeHtml(EMAIL_REPLY_TO())} | 1800 317 553 (Mon–Thu, 10 am–2 pm AEST)</p>`,
    ),
  };
}

export function adminNotifyEmail(newUserEmail) {
  const safeEmail = escapeHtml(newUserEmail);
  return {
    to: ADMIN_NOTIFY_TO(),
    subject: 'AssessSuite: new registration',
    text: `A new account has registered on AssessSuite: ${newUserEmail}\n\nThe account is pending; it activates automatically on successful subscription payment.`,
    html: htmlWrap(
      'New registration',
      `<p>A new account has registered on AssessSuite: <strong>${safeEmail}</strong></p><p>The account is pending; it activates automatically on successful subscription payment.</p>`,
    ),
  };
}

export function inviteEmail(role) {
  const safeRole = escapeHtml(role);
  return {
    subject: 'You have been invited to AssessSuite',
    text: `You have been invited to AssessSuite (role: ${role}).\n\nCreate your login at the AssessSuite site using this email address.`,
    html: htmlWrap(
      'You have been invited',
      `<p>You have been invited to AssessSuite (role: <strong>${safeRole}</strong>).</p><p>Create your login at the AssessSuite site using this email address.</p>`,
    ),
  };
}
