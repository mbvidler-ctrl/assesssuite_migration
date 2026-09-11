import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input as InputPrimitive } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Mail, User as UserIcon } from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import {
  REGISTRATION_ACCESS_MODES,
  resolveRegistrationAccessMode,
} from "@/lib/registrationAccess";
import { buildTimeProfession } from "@/lib/profession";
import { createPageUrl } from "@/utils";

const Input = /** @type {React.ComponentType<any>} */ (InputPrimitive);
const RESEND_COOLDOWN_SECONDS = 30;

function maskEmailDestination(value) {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return "your email address";

  const visiblePrefix = localPart.slice(0, 1);
  return visiblePrefix + "*".repeat(Math.max(3, localPart.length - 1)) + "@" + domain;
}

function InvitationOnlyRegistration() {
  return (
    <AuthLayout
      icon={Lock}
      title="Invitation-only access"
      subtitle={buildTimeProfession.productName + " is a restricted production platform"}
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          Return to authorised sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
          Public registration is not available. A practice owner must invite your exact email address before you can create a password and access the platform.
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          If you have been authorised, use the single-use link in your invitation email. Existing members can sign in or reset their password below.
        </p>
        <Button asChild className="h-12 w-full">
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 w-full">
          <Link to="/forgot-password">Reset an existing password</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}

function RegistrationUnavailable() {
  return (
    <AuthLayout
      icon={Lock}
      title="Registration is currently unavailable"
      subtitle={buildTimeProfession.productName + " is not accepting new self-service registrations"}
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          Return to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          We cannot confirm that new registrations are available right now. Please try again shortly.
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Existing members can sign in or reset their password below.
        </p>
        <Button asChild className="h-12 w-full">
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 w-full">
          <Link to="/forgot-password">Reset an existing password</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}

function OpenRegistration() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendConfirmation, setResendConfirmation] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setIsDuplicate(false);

    if (!fullName.trim()) {
      setError("Enter your full name");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setResendConfirmation("Verification code sent.");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtpSent(true);
    } catch (err) {
      // A verified account already owns this email (409): offer a route onward
      // (sign in / reset) rather than dead-ending on a bare error message.
      if (err?.status === 409 || /already exists/i.test(err?.message || "")) {
        setIsDuplicate(true);
      }
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError("");
    setVerifying(true);
    try {
      const response = await base44.auth.verifyOtp({ email, otpCode });
      await base44.auth.setToken(response.access_token);
      // The typed SDK registration call carries only its declared fields;
      // persist the supplied name after the account is verified.
      await base44.auth.updateMe({ full_name: fullName.trim() }).catch(() => {});
      // Avoid "/" because it is the public entry route. A newly verified user
      // must enter the profile, entitlement and legal-acceptance gate chain.
      window.location.href = createPageUrl("Dashboard");
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resending || resendCooldown > 0) return;

    setError("");
    setResendConfirmation("");
    setResending(true);
    try {
      await base44.auth.resendOtp(email);
      setResendConfirmation("Verification code request received.");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  if (otpSent) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle="Enter the code we sent you"
        footer={
          <button
            onClick={() => setOtpSent(false)}
            className="text-primary font-medium hover:underline bg-none border-none cursor-pointer p-0"
          >
            Back to registration
          </button>
        }
      >
        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="font-medium text-foreground" role="status" aria-live="polite">
            {resendConfirmation || "Verification code sent."}
          </p>
          <p className="mt-1 text-muted-foreground">
            We sent a six-digit code to {maskEmailDestination(email)}. It may take a few minutes to arrive.
            Check your spam or junk folder if you cannot see it.
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              value={otpCode}
              onChange={(event) => {
                setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (error) setError("");
              }}
              maxLength={6}
              className="h-12 text-center tracking-widest text-lg"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full h-12 font-medium"
            disabled={verifying || !/^\d{6}$/.test(otpCode)}
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify code"
            )}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">Didn't receive a code?</p>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resending || resendCooldown > 0}
            className="text-sm text-primary font-medium hover:underline bg-none border-none cursor-pointer p-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending
              ? "Resending..."
              : resendCooldown > 0
                ? "Resend code in " + resendCooldown + "s"
                : "Resend code"}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Mail}
      title="Create your account"
      subtitle={"Join " + buildTimeProfession.productName}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
          {isDuplicate && (
            <div className="mt-2 flex gap-4">
              <Link to="/login" className="font-medium underline">Sign in</Link>
              <Link to="/forgot-password" className="font-medium underline">Forgot password</Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              autoFocus
              placeholder="Jane Doe"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function Register() {
  const { appPublicSettings } = useAuth();
  const registrationMode = resolveRegistrationAccessMode(
    buildTimeProfession.id,
    appPublicSettings,
  );

  if (registrationMode === REGISTRATION_ACCESS_MODES.OPEN) {
    return <OpenRegistration />;
  }
  if (registrationMode === REGISTRATION_ACCESS_MODES.INVITATION_ONLY) {
    return <InvitationOnlyRegistration />;
  }
  return <RegistrationUnavailable />;
}
