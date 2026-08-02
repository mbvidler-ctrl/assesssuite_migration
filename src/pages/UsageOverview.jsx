import React, { useEffect, useMemo, useState } from "react";
import { Activity, AppWindow, BarChart3, Loader2, LogIn, MousePointerClick, ShieldCheck, UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const VIEWER_EMAILS = new Set([
  "mb.vidler@gmail.com",
  "brenton@primehealthclinics.com",
]);
const METRIC_KEYS = ["marketing_page_load", "successful_sign_in", "new_verified_account", "app_open"];

function canView(user) {
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  return user?.role === "admin" || VIEWER_EMAILS.has(email);
}

function validSummary(value) {
  return value?.time_zone === "Australia/Brisbane"
    && value?.range_days === 30
    && Array.isArray(value?.daily)
    && value.daily.length === 30
    && value.daily.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row?.day || "")
      && METRIC_KEYS.every((key) => Number.isSafeInteger(row[key]) && row[key] >= 0));
}

async function fetchSummary() {
  if (!appParams.token) return null;
  const response = await fetch("/api/usage/summary?days=30", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${appParams.token}`,
      "X-App-Id": appParams.appId,
    },
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) return null;
  const value = await response.json();
  return validSummary(value) ? value : null;
}

function MetricCard({ icon: Icon, label, value, detail, accent }) {
  return (
    <Card className="bg-white/90 border-slate-200/70 overflow-hidden">
      <div className={`h-1 ${accent}`} />
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Icon className="w-4 h-4" /> {label}
        </div>
        <p className="text-4xl font-bold tracking-tight text-slate-900 mt-4">{value}</p>
        <p className="text-xs text-slate-500 mt-2">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function UsageOverview() {
  const [state, setState] = useState({ status: "loading", user: null, summary: null });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!canView(user)) {
          if (active) setState({ status: "denied", user, summary: null });
          return;
        }
        const summary = await fetchSummary();
        if (active) setState({ status: summary ? "ready" : "unavailable", user, summary });
      } catch {
        if (active) setState({ status: "unavailable", user: null, summary: null });
      }
    })();
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => {
    const rows = state.summary?.daily || [];
    const today = rows.at(-1) || Object.fromEntries(METRIC_KEYS.map((key) => [key, 0]));
    const sum = (key, days) => rows.slice(-days).reduce((total, row) => total + row[key], 0);
    return { rows, today, loads7: sum("marketing_page_load", 7), signIns7: sum("successful_sign_in", 7), accounts30: sum("new_verified_account", 30), opens7: sum("app_open", 7) };
  }, [state.summary]);

  if (state.status === "loading") {
    return <div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /><span className="sr-only">Loading practice overview</span></div>;
  }
  if (state.status === "denied") {
    return <div className="min-h-[70vh] flex items-center justify-center p-6"><Card className="max-w-md"><CardContent className="pt-6 text-center"><ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h1 className="text-xl font-bold">Dashboard access is not enabled</h1><p className="text-slate-600 mt-2">This summary is limited to authorised AssessSuite viewers.</p></CardContent></Card></div>;
  }

  const available = state.status === "ready";
  const value = (number) => available ? new Intl.NumberFormat("en-AU").format(number) : "-";
  const max = Math.max(1, ...totals.rows.flatMap((row) => [row.marketing_page_load, row.app_open]));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/30 p-5 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700"><BarChart3 className="w-4 h-4" /> AssessSuite practice overview</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-2">Site and app activity at a glance</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">Simple daily totals showing interest in AssessSuite and successful use of the application. No patient information or individual activity is shown.</p>
        </header>

        {!available && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Current totals are temporarily unavailable. Reopen the dashboard shortly to retry.</div>}

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Today's activity">
          <MetricCard icon={MousePointerClick} label="Page loads today" value={value(totals.today.marketing_page_load)} detail={available ? `${value(totals.loads7)} over 7 days` : "Temporarily unavailable"} accent="bg-blue-500" />
          <MetricCard icon={LogIn} label="Successful sign-ins today" value={value(totals.today.successful_sign_in)} detail={available ? `${value(totals.signIns7)} over 7 days` : "Temporarily unavailable"} accent="bg-amber-500" />
          <MetricCard icon={UserPlus} label="New verified accounts today" value={value(totals.today.new_verified_account)} detail={available ? `${value(totals.accounts30)} over 30 days` : "Temporarily unavailable"} accent="bg-violet-500" />
          <MetricCard icon={AppWindow} label="App opens today" value={value(totals.today.app_open)} detail={available ? `${value(totals.opens7)} over 7 days` : "Temporarily unavailable"} accent="bg-emerald-500" />
        </section>

        <Card className="bg-white/90 border-slate-200/70">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-blue-600" /> Last 30 days</CardTitle><p className="text-sm text-slate-500">Blue bars are page loads; green bars are signed-in app opens.</p></CardHeader>
          <CardContent>
            <div className="h-56 flex items-end gap-1 border-b border-slate-200" role="img" aria-label="Daily page loads and app opens over the last 30 days">
              {totals.rows.map((row) => (
                <div key={row.day} className="h-full flex-1 flex items-end gap-px" title={`${row.day}: ${row.marketing_page_load} page loads, ${row.app_open} app opens`}>
                  <span className="flex-1 bg-blue-500 rounded-t-sm min-h-px" style={{ height: `${Math.max(1, Math.round((row.marketing_page_load / max) * 100))}%` }} />
                  <span className="flex-1 bg-emerald-500 rounded-t-sm min-h-px" style={{ height: `${Math.max(1, Math.round((row.app_open / max) * 100))}%` }} />
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-5 text-sm text-slate-600">
              <p><strong className="text-slate-800">Page loads are not people.</strong> Reloading or returning can add another load.</p>
              <p><strong className="text-slate-800">App opens are session activity.</strong> They do not count clinical work.</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">Daily totals use Brisbane time. No names, email addresses, IP addresses, devices, referring sites, page addresses, patient information or clinical content are retained in these totals.</p>
      </div>
    </div>
  );
}
