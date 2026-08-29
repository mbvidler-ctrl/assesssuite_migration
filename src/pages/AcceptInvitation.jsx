import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound, Loader2, Lock, User as UserIcon } from "lucide-react";

import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appParams } from "@/lib/app-params";

function authEndpoint(action) {
  const base = String(appParams.serverUrl || "").replace(/\/$/, "");
  return `${base}/api/apps/${encodeURIComponent(appParams.appId)}/auth/${action}`;
}

async function postAuth(action, body) {
  const response = await fetch(authEndpoint(action), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Id": appParams.appId },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "The invitation could not be completed.");
  return payload;
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const invitationToken = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [invitation, setInvitation] = useState(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!invitationToken) {
      setStatus("invalid");
      setError("The invitation link is missing or invalid.");
      return () => { active = false; };
    }
    postAuth("inspect-invitation", { token: invitationToken })
      .then((payload) => {
        if (!active) return;
        setInvitation(payload);
        setStatus("ready");
        window.history.replaceState({}, "", "/accept-invitation");
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason.message);
        setStatus("invalid");
      });
    return () => { active = false; };
  }, [invitationToken]);

  const accept = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setStatus("submitting");
    try {
      const payload = await postAuth("accept-invitation", {
        token: invitationToken,
        password,
        full_name: fullName,
      });
      base44.auth.setToken(payload.access_token);
      window.location.replace(payload.organization_role === "owner" ? "/AccessInvitations" : "/ProfileSetup");
    } catch (reason) {
      setError(reason.message);
      setStatus("ready");
    }
  };

  return (
    <AuthLayout
      icon={KeyRound}
      title="Accept your invitation"
      subtitle={invitation ? `${invitation.organization.name} · ${invitation.role}` : "AssessSuite Physio secure access"}
      footer={<Link to="/login" className="text-primary font-medium hover:underline">Return to sign in</Link>}
    >
      {status === "loading" && (
        <div className="flex min-h-40 items-center justify-center" role="status">
          <Loader2 className="h-7 w-7 animate-spin text-teal-700" />
          <span className="sr-only">Validating invitation</span>
        </div>
      )}

      {status === "invalid" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          <p className="text-sm text-muted-foreground">Ask a practice owner to resend your invitation. Resending creates a new single-use link.</p>
          <Button asChild variant="outline" className="h-12 w-full"><Link to="/login">Return to sign in</Link></Button>
        </div>
      )}

      {(status === "ready" || status === "submitting") && invitation && (
        <form onSubmit={accept} className="space-y-4">
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
            This invitation is for <strong>{invitation.email}</strong> and expires {new Date(invitation.expires_at).toLocaleString("en-AU")}.
          </div>
          {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="fullName" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-12 pl-10" required autoFocus />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Create password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 pl-10" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={256} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12" required />
          </div>
          <Button type="submit" className="h-12 w-full bg-teal-800 hover:bg-teal-900" disabled={status === "submitting"}>
            {status === "submitting" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Activating access...</> : "Activate account"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
