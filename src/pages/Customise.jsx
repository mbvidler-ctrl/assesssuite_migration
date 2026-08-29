import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpenCheck,
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Settings2,
  Unplug,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

function unwrap(response) {
  return response?.data ?? response;
}

function friendlyError(error) {
  return error?.response?.data?.message || error?.message || "The integration action could not be completed.";
}

function statusClasses(status) {
  if (status === "connected") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "configured") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "error") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

const DEFAULT_SETTINGS = {
  import_patients: true,
  import_appointments: true,
  export_patients: false,
  export_appointments: false,
  practitioner_role_id: "",
  healthcare_service_id: "",
  location_type: "clinic",
};

export default function Customise() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("load");
  const [notice, setNotice] = useState(null);
  const [region, setRegion] = useState("au");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [syncResult, setSyncResult] = useState(null);

  const halaxy = useMemo(
    () => data?.connectors?.find((connector) => connector.provider_id === "halaxy") || null,
    [data],
  );

  const applyPayload = useCallback((payload) => {
    setData(payload);
    const connector = payload?.connectors?.find((item) => item.provider_id === "halaxy");
    if (connector) {
      setRegion(connector.region || "au");
      setSettings({ ...DEFAULT_SETTINGS, ...(connector.settings || {}) });
    }
  }, []);

  const load = useCallback(async (preserveNotice = false) => {
    setBusy("load");
    try {
      const payload = unwrap(await base44.functions.invoke("manageIntegrations", { action: "list" }));
      if (payload?.status !== "success") throw new Error(payload?.message || "Integrations are unavailable.");
      applyPayload(payload);
      if (!preserveNotice) setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: friendlyError(error) });
    } finally {
      setBusy("");
    }
  }, [applyPayload]);

  useEffect(() => { load(); }, [load]);

  const mutate = async (action, configuration, successMessage) => {
    setBusy(action);
    setNotice(null);
    try {
      const result = unwrap(await base44.functions.invoke("manageIntegrations", {
        action,
        provider_id: "halaxy",
        org_id: data?.organization?.id,
        ...(configuration ? { configuration } : {}),
      }));
      if (result?.status !== "success") throw new Error(result?.message || "The integration action failed.");
      if (action === "sync") setSyncResult(result.sync || null);
      setNotice({ kind: "success", message: successMessage });
      setClientId("");
      setClientSecret("");
      await load(true);
    } catch (error) {
      setNotice({ kind: "error", message: friendlyError(error) });
      setBusy("");
    }
  };

  const save = (event) => {
    event.preventDefault();
    return mutate("save", {
      region,
      client_id: clientId,
      client_secret: clientSecret,
      settings,
    }, "Halaxy settings were saved. Test the connection to prove the live credentials and permissions.");
  };

  const setSyncSetting = (name, checked) => {
    setSettings((current) => ({ ...current, [name]: checked }));
  };

  const syncDescription = syncResult ? [
    `${syncResult.summary?.patients?.imported || 0} patients imported`,
    `${syncResult.summary?.patients?.updated || 0} patients updated`,
    `${syncResult.summary?.patients?.exported || 0} patients exported`,
    `${syncResult.summary?.appointments?.imported || 0} appointments imported`,
    `${syncResult.summary?.appointments?.updated || 0} appointments updated`,
    `${syncResult.summary?.appointments?.exported || 0} appointments exported`,
  ].join(" · ") : "";

  if (!data && busy === "load") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-700" /><span className="sr-only">Loading customisation</span></div>;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <Card className="max-w-lg"><CardContent className="pt-6 text-center"><Settings2 className="mx-auto h-12 w-12 text-slate-400" /><h1 className="mt-4 text-xl font-bold">Customisation unavailable</h1><p className="mt-2 text-slate-600">{notice?.message || "A practice membership is required."}</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/30 p-5 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-700"><Settings2 className="h-4 w-4" /> Practice configuration</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Customise</h1>
            <p className="mt-2 text-slate-600">Connect {data.organization.name} to its practice systems and shared clinical-research services.</p>
          </div>
          <Button variant="outline" onClick={() => load()} disabled={busy !== ""}><RefreshCw className={`mr-2 h-4 w-4 ${busy === "load" ? "animate-spin" : ""}`} />Refresh</Button>
        </header>

        {notice && (
          <div className={`rounded-xl border p-4 text-sm ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} role="status">
            {notice.message}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-teal-700" />Halaxy practice management</CardTitle>
              <Badge className={statusClasses(halaxy?.status)}>{halaxy?.status || "disconnected"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-950">
              <p className="font-semibold">FHIR R4B connection for patients and appointments</p>
              <p className="mt-1 text-teal-800">Create the API key in Halaxy’s API Key Manager, then enter the Client ID and one-time Client Secret here. Credentials are encrypted before storage and are never displayed again.</p>
              <a className="mt-2 inline-flex items-center gap-1 font-semibold underline" href="https://support.halaxy.com/hc/en-au/articles/13014722009487-Guide-to-Halaxy-API" target="_blank" rel="noreferrer">Halaxy API setup guide <ExternalLink className="h-3.5 w-3.5" /></a>
            </div>

            {!data.encrypted_storage_ready && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Encrypted connector storage has not yet been provisioned on this deployment. Existing clinical functions remain available, but new credentials cannot be saved until deployment configuration is complete.</div>
            )}

            <form onSubmit={save} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label>Halaxy data region</Label><Select value={region} onValueChange={setRegion} disabled={!data.can_manage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="au">Australia and non-EU</SelectItem><SelectItem value="eu">EU and UK</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="halaxyClientId">Client ID</Label><Input id="halaxyClientId" value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" placeholder={halaxy?.credential_hint || "Paste Client ID"} disabled={!data.can_manage} /></div>
                <div className="space-y-2"><Label htmlFor="halaxyClientSecret">Client Secret</Label><Input id="halaxyClientSecret" type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" placeholder={halaxy?.credential_hint ? "Leave blank to retain saved secret" : "Paste Client Secret"} disabled={!data.can_manage} /></div>
              </div>

              <div className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
                {[
                  ["import_patients", "Import patients from Halaxy"],
                  ["import_appointments", "Import appointments from Halaxy"],
                  ["export_patients", "Create and update Halaxy patients from AssessSuite"],
                  ["export_appointments", "Create and update Halaxy appointments from AssessSuite"],
                ].map(([name, label]) => (
                  <div key={name} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-3">
                    <Label htmlFor={`sync-${name}`} className="leading-snug">{label}</Label>
                    <Switch id={`sync-${name}`} checked={settings[name]} onCheckedChange={(checked) => setSyncSetting(name, checked)} disabled={!data.can_manage} />
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Appointment export defaults</p>
                <p className="mt-1 text-xs text-slate-600">Only required when appointment export is enabled. Copy the identifiers from the corresponding Halaxy Practitioner Role and appointment type (Healthcare Service).</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2"><Label htmlFor="halaxyPractitionerRole">Practitioner Role ID</Label><Input id="halaxyPractitionerRole" value={settings.practitioner_role_id || ""} onChange={(event) => setSettings((current) => ({ ...current, practitioner_role_id: event.target.value }))} placeholder="PR-1234567" disabled={!data.can_manage} /></div>
                  <div className="space-y-2"><Label htmlFor="halaxyService">Appointment type ID</Label><Input id="halaxyService" value={settings.healthcare_service_id || ""} onChange={(event) => setSettings((current) => ({ ...current, healthcare_service_id: event.target.value }))} placeholder="33" disabled={!data.can_manage} /></div>
                  <div className="space-y-2"><Label>Default location type</Label><Select value={settings.location_type || "clinic"} onValueChange={(value) => setSettings((current) => ({ ...current, location_type: value }))} disabled={!data.can_manage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clinic">Clinic</SelectItem><SelectItem value="telehealth">Telehealth</SelectItem><SelectItem value="online">Online</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="organization">Organisation</SelectItem></SelectContent></Select></div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {data.can_manage ? <>
                    <Button type="submit" disabled={busy !== "" || !data.encrypted_storage_ready}><KeyRound className="mr-2 h-4 w-4" />Save securely</Button>
                    <Button type="button" variant="outline" disabled={busy !== "" || !halaxy || halaxy.status === "disconnected"} onClick={() => mutate("test", null, "The live Halaxy connection and Patient permission were verified.")}>{busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}Test connection</Button>
                    <Button type="button" variant="outline" disabled={busy !== "" || !halaxy || halaxy.status === "disconnected"} onClick={() => mutate("disconnect", null, "Halaxy was disconnected and its saved credentials were removed.")}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button>
                  </> : null}
                {data.can_sync && <Button type="button" className="bg-teal-700 hover:bg-teal-800" disabled={busy !== "" || !halaxy || halaxy.status === "disconnected"} onClick={() => mutate("sync", null, "Halaxy synchronisation completed with real practice data.")}>{busy === "sync" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sync now</Button>}
                {!data.can_manage && <p className="w-full text-sm text-slate-600">A practice owner manages connection credentials. Practice owners and administrators can run the enabled synchronisation without viewing secrets.</p>}
              </div>
            </form>

            {halaxy?.last_tested_at && <p className="text-xs text-slate-500">Last tested {new Date(halaxy.last_tested_at).toLocaleString("en-AU")}{halaxy.last_error_code ? ` · ${halaxy.last_error_code}` : ""}</p>}
            {syncDescription && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><span className="font-semibold">Latest sync:</span> {syncDescription}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-blue-700" />Academic and clinical research</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">These platform-managed connectors feed the shared evidence search and protocol library. They do not require each practice to provide a key.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {["PubMed", "OpenAlex", "Crossref", "ClinicalTrials.gov"].map((name) => (
                <div key={name} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{name}</span><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                  <p className="mt-2 text-xs text-slate-600">Shared evidence index</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DatabaseZap className="h-5 w-5 text-slate-700" />Recent connector activity</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {data.events.length === 0 && <p className="py-3 text-sm text-slate-500">No connector activity recorded.</p>}
              {data.events.map((event) => (
                <div key={event.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[220px_1fr_auto]">
                  <span className="font-medium text-slate-800">{event.event_type.replaceAll("_", " ")}</span>
                  <span className="text-slate-600">{event.provider_id} · {event.actor_email || "system"}</span>
                  <time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString("en-AU")}</time>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
