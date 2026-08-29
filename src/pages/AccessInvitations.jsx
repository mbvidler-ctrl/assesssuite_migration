import React, { useCallback, useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  History,
  KeyRound,
  Loader2,
  MailPlus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRoundCog,
  XCircle,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const roleLabel = { owner: "Owner", admin: "Admin", clinician: "Clinician" };

function unwrap(response) {
  return response?.data ?? response;
}

function friendlyError(error) {
  return error?.response?.data?.message || error?.message || "The access action could not be completed.";
}

function statusVariant(status) {
  if (status === "active" || status === "accepted") return "default";
  if (status === "pending") return "secondary";
  return "destructive";
}

export default function AccessInvitations() {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("clinician");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);

  const load = useCallback(async (preserveNotice = false) => {
    setBusy("load");
    try {
      const payload = unwrap(await base44.functions.invoke("manageOrganizationAccess", { action: "list" }));
      if (payload?.status !== "success") throw new Error(payload?.message || "Access details are unavailable.");
      setData(payload);
      if (!preserveNotice) setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: friendlyError(error) });
    } finally {
      setBusy("");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mutate = async (key, payload, successMessage) => {
    setBusy(key);
    setNotice(null);
    try {
      const response = unwrap(await base44.functions.invoke("manageOrganizationAccess", {
        ...payload,
        org_id: data?.organization?.id,
      }));
      if (response?.status !== "success") throw new Error(response?.message || "The access action failed.");
      setNotice({ kind: "success", message: successMessage });
      await load(true);
      return true;
    } catch (error) {
      setNotice({ kind: "error", message: friendlyError(error) });
      setBusy("");
      return false;
    }
  };

  const invite = async (event) => {
    event.preventDefault();
    const sent = await mutate("invite", { action: "invite", email, role }, `Invitation sent to ${email}.`);
    if (sent) setEmail("");
  };

  if (!data && busy === "load") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-700" /><span className="sr-only">Loading access management</span></div>;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <Card className="max-w-lg"><CardContent className="pt-6 text-center"><ShieldCheck className="mx-auto h-12 w-12 text-slate-400" /><h1 className="mt-4 text-xl font-bold">Owner access required</h1><p className="mt-2 text-slate-600">{notice?.message || "This area is available to practice owners."}</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-blue-50/30 p-5 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-teal-700"><KeyRound className="h-4 w-4" /> Restricted production access</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Access &amp; invitations</h1>
            <p className="mt-2 text-slate-600">Manage authorised people for {data.organization.name}. Invitation links are single-use and expire automatically.</p>
          </div>
          <Button variant="outline" onClick={() => load()} disabled={busy !== ""}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </header>

        {notice && (
          <div className={`rounded-xl border p-4 text-sm ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} role="status">
            {notice.message}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MailPlus className="h-5 w-5 text-teal-700" />Invite an authorised person</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={invite} className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
              <div className="space-y-2"><Label htmlFor="inviteEmail">Email address</Label><Input id="inviteEmail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="clinician@example.com" required /></div>
              <div className="space-y-2"><Label>Organisation role</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clinician">Clinician</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="owner">Owner</SelectItem></SelectContent></Select></div>
              <Button type="submit" disabled={busy !== ""} className="bg-teal-800 hover:bg-teal-900">{busy === "invite" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}Send invitation</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRoundCog className="h-5 w-5 text-blue-700" />Current users</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.members.map((member) => (
              <div key={member.membership_id} className="grid gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-[1fr_180px_auto] lg:items-center">
                <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{member.full_name || member.email}</p><Badge variant={statusVariant(member.account_status)}>{member.account_status}</Badge>{member.email_verified && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Email verified" />}</div><p className="mt-1 text-sm text-slate-500">{member.email}</p></div>
                <Select value={member.role} onValueChange={(nextRole) => mutate(`role:${member.membership_id}`, { action: "change_role", membership_id: member.membership_id, role: nextRole }, `${member.email} is now ${roleLabel[nextRole].toLowerCase()}.`)} disabled={busy !== ""}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="clinician">Clinician</SelectItem></SelectContent></Select>
                <div className="flex justify-end gap-2">
                  {member.account_status === "suspended" ? (
                    <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => mutate(`reinstate:${member.membership_id}`, { action: "reinstate", membership_id: member.membership_id }, `${member.email} has been reinstated.`)}><RotateCcw className="mr-2 h-4 w-4" />Reinstate</Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => mutate(`suspend:${member.membership_id}`, { action: "suspend", membership_id: member.membership_id }, `${member.email} has been suspended.`)}><Ban className="mr-2 h-4 w-4" />Suspend</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MailPlus className="h-5 w-5 text-amber-700" />Invitations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.invitations.length === 0 && <p className="text-sm text-slate-500">No invitations have been issued.</p>}
            {data.invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{invitation.email}</p><Badge variant={statusVariant(invitation.status)}>{invitation.status}</Badge><Badge variant="outline">{roleLabel[invitation.role]}</Badge></div><p className="mt-1 text-xs text-slate-500">Expires {new Date(invitation.expires_at).toLocaleString("en-AU")}</p></div>
                {(invitation.status === "pending" || invitation.status === "expired") && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => mutate(`resend:${invitation.id}`, { action: "resend", invitation_id: invitation.id }, `A new invitation link was sent to ${invitation.email}.`)}><RefreshCw className="mr-2 h-4 w-4" />Resend</Button>{invitation.status === "pending" && <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => mutate(`revoke:${invitation.id}`, { action: "revoke", invitation_id: invitation.id }, `The invitation for ${invitation.email} was revoked.`)}><XCircle className="mr-2 h-4 w-4" />Revoke</Button>}</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-slate-700" />Access-event history</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {data.events.length === 0 && <p className="py-3 text-sm text-slate-500">No access events recorded.</p>}
              {data.events.map((event) => <div key={event.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[180px_1fr_auto]"><span className="font-medium text-slate-800">{event.event_type.replaceAll("_", " ")}</span><span className="text-slate-600">{event.subject_email}{event.prior_role || event.next_role ? ` · ${event.prior_role || "—"} → ${event.next_role || "—"}` : ""}</span><time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString("en-AU")}</time></div>)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
