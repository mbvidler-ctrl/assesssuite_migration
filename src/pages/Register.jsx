import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input as InputPrimitive } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, User as UserIcon } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { createPageUrl } from "@/utils";

const Input = /** @type {React.ComponentType<any>} */ (InputPrimitive);
const RESEND_COOLDOWN_SECONDS = 30;

function maskEmailDestination(value) {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return "your email address";

  const visiblePrefix = localPart.slice(0, 1);
  return `${visiblePrefix}${"*".repeat(Math.max(3, localPart.length - 1))}@${domain}`;
}

export default function Register() {
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setIsDuplicate(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await base44.auth.register({ email, password, full_name: fullName.trim() });
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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setVerifying(true);
    try {
      const response = await base44.auth.verifyOtp({ email, otpCode });
      await base44.auth.setToken(response.access_token);
      // Persist the registrant's name on the verified record (belt-and-braces:
      // the register payload also carries it, but this guarantees it is set
      // even if the SDK register call did not forward the custom field).
      if (fullName.trim()) {
        await base44.auth.updateMe({ full_name: fullName.trim() }).catch(() => {});
      }
      // Not "/" — see the identical note in Login.jsx. A brand-new user must
      // reach the ProfileSetup/legal-acceptance gate chain, not the
      // marketing page App.jsx renders unconditionally at the root path.
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

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
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
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
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
                ? `Resend code in ${resendCooldown}s`
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
      subtitle="Join AssessSuite Clinical"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {/* Google SSO removed for the private demo: no provider-auth route in the
          local backend. Email/password registration is used. */}

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
              onChange={(e) => setFullName(e.target.value)}
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
              onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
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
              onChange={(e) => setConfirmPassword(e.target.value)}
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
