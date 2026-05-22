export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;margin:0;padding:24px;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${title}</h1>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px"/>
      <p style="font-size:12px;color:#6b7280;margin:0">BugSense — AI-powered bug triage.</p>
    </td></tr>
  </table>
</body></html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:500">${label}</a></p>
  <p style="font-size:13px;color:#374151;margin:8px 0">Or paste this URL into your browser:</p>
  <p style="font-size:13px;color:#6b7280;word-break:break-all;margin:4px 0">${url}</p>`;
}

export function verificationEmail(verifyUrl: string): EmailContent {
  const subject = 'Verify your BugSense email';
  return {
    subject,
    html: shell(
      'Verify your email',
      `<p>Thanks for signing up. Click the button below to verify your email address. The link expires in 24 hours.</p>${button(
        verifyUrl,
        'Verify email',
      )}<p style="font-size:13px;color:#6b7280">If you didn't sign up for BugSense, you can ignore this email.</p>`,
    ),
    text: `Verify your BugSense email.

Open this URL in your browser to verify (expires in 24 hours):
${verifyUrl}

If you didn't sign up, ignore this email.`,
  };
}

export function passwordResetEmail(resetUrl: string): EmailContent {
  const subject = 'Reset your BugSense password';
  return {
    subject,
    html: shell(
      'Reset your password',
      `<p>You asked to reset your BugSense password. Click the button below to choose a new one. This link expires in 1 hour.</p>${button(
        resetUrl,
        'Reset password',
      )}<p style="font-size:13px;color:#6b7280">If you didn't request this, your password is unchanged and you can ignore this email.</p>`,
    ),
    text: `Reset your BugSense password.

Open this URL to choose a new password (expires in 1 hour):
${resetUrl}

If you didn't request this, your password is unchanged.`,
  };
}

export function magicLinkEmail(signInUrl: string): EmailContent {
  const subject = 'Sign in to BugSense';
  return {
    subject,
    html: shell(
      'Sign in to BugSense',
      `<p>Click the button below to sign in. This link expires in 10 minutes and can only be used once.</p>${button(
        signInUrl,
        'Sign in',
      )}<p style="font-size:13px;color:#6b7280">If you didn't request a sign-in link, you can safely ignore this email.</p>`,
    ),
    text: `Sign in to BugSense.

Open this URL to sign in (expires in 10 minutes, single use):
${signInUrl}

If you didn't request this, ignore the email.`,
  };
}
