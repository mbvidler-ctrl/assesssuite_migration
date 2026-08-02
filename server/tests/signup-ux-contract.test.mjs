import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const registerSource = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'Register.jsx'), 'utf8');

test('registration OTP entry exposes mobile autofill and requires exactly six digits', () => {
  assert.match(registerSource, /inputMode="numeric"/);
  assert.match(registerSource, /pattern="\[0-9\]\{6\}"/);
  assert.match(registerSource, /autoComplete="one-time-code"/);
  assert.match(registerSource, /maxLength=\{6\}/);
  assert.match(registerSource, /disabled=\{verifying \|\| !\/\^\\d\{6\}\$\/.test\(otpCode\)\}/);
});

test('registration OTP resend provides confirmation, delivery guidance, and a cooldown', () => {
  assert.match(registerSource, /const RESEND_COOLDOWN_SECONDS = 30/);
  assert.match(registerSource, /setResendCooldown\(RESEND_COOLDOWN_SECONDS\)/);
  assert.match(registerSource, /resending \|\| resendCooldown > 0/);
  assert.match(registerSource, /Verification code request received\./);
  assert.match(registerSource, /spam or junk folder/i);
  assert.match(registerSource, /maskEmailDestination\(email\)/);
  assert.match(registerSource, /`Resend code in \$\{resendCooldown\}s`/);
});

test('resend clears stale feedback before making another request', () => {
  const handler = registerSource.slice(
    registerSource.indexOf('const handleResendOtp'),
    registerSource.indexOf('const handleGoogle'),
  );
  assert.match(handler, /setError\(""\)/);
  assert.match(handler, /setResendConfirmation\(""\)/);
  assert.ok(
    handler.indexOf('setError("")') < handler.indexOf('base44.auth.resendOtp(email)'),
    'stale errors must clear before the resend request',
  );
});
