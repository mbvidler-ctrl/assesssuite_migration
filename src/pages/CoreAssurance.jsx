import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fetchCoreAssurance } from "@/api/coreClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, Boxes, Database, FileCheck2, GitPullRequest, Loader2, ServerCog, ShieldCheck,
} from "lucide-react";

// These local adapters compensate for the legacy shadcn wrappers losing their
// child props during JavaScript declaration inference. Keep the widening at
// the imported component boundary rather than weakening checking for the page.
/** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */
const CoreTable = /** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */ (/** @type {unknown} */ (Table));
/** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */
const CoreTableBody = /** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */ (/** @type {unknown} */ (TableBody));
/** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */
const CoreTableCell = /** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */ (/** @type {unknown} */ (TableCell));
/** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */
const CoreTableHead = /** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */ (/** @type {unknown} */ (TableHead));
/** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */
const CoreTableHeader = /** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */ (/** @type {unknown} */ (TableHeader));
/** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */
const CoreTableRow = /** @type {React.ComponentType<{children?: React.ReactNode, className?: string}>} */ (/** @type {unknown} */ (TableRow));
/** @type {React.ComponentType<{children?: React.ReactNode, id?: string}>} */
const CoreSelectTrigger = /** @type {React.ComponentType<{children?: React.ReactNode, id?: string}>} */ (/** @type {unknown} */ (SelectTrigger));
/** @type {React.ComponentType<{children?: React.ReactNode}>} */
const CoreSelectContent = /** @type {React.ComponentType<{children?: React.ReactNode}>} */ (/** @type {unknown} */ (SelectContent));
/** @type {React.ComponentType<{children?: React.ReactNode, value: string}>} */
const CoreSelectItem = /** @type {React.ComponentType<{children?: React.ReactNode, value: string}>} */ (/** @type {unknown} */ (SelectItem));

const TABLES = [
  { key: "capabilities", idField: "capabilityKey", title: "Capabilities", columns: [["capabilityKey", "Capability"], ["state", "State"], ["activeConfigVersionId", "Active config"], ["updatedAt", "Updated"]] },
  { key: "config_versions", idField: "configVersionId", title: "Configuration versions", columns: [["configKey", "Configuration"], ["version", "Version"], ["state", "State"], ["contentHash", "Content hash"]] },
  { key: "runs", idField: "runId", title: "Runs", columns: [["runId", "Run"], ["purpose", "Purpose"], ["state", "State"], ["createdAt", "Created"]] },
  { key: "artifacts", idField: "artifactId", title: "Artifacts", columns: [["artifactId", "Artifact"], ["artifactType", "Type"], ["state", "State"], ["updatedAt", "Updated"]] },
  { key: "reviews", idField: "reviewId", title: "Reviews", columns: [["reviewId", "Review"], ["artifactId", "Artifact"], ["state", "State"], ["createdAt", "Created"]] },
  { key: "jobs", idField: "jobId", title: "Jobs", columns: [["jobId", "Job"], ["jobType", "Type"], ["state", "State"], ["availableAt", "Available"]] },
];

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "—";
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toLocaleString();
  }
  return value.length > 48 ? `${value.slice(0, 45)}…` : value;
}

function StateBadge({ state }) {
  const safeState = typeof state === "string" && state ? state : "unavailable";
  return <Badge variant="outline" className="font-mono text-[11px]">{safeState}</Badge>;
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <Card className="border-slate-200/70 bg-white/80">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Icon className="h-5 w-5" /></div>
        <div><p className="text-2xl font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
      </CardContent>
    </Card>
  );
}

function AssuranceTable({ definition, rows }) {
  return (
    <Card className="border-slate-200/70 bg-white/80">
      <CardHeader className="pb-2"><CardTitle className="text-base">{definition.title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-slate-500">No {definition.title.toLowerCase()} recorded for this organisation.</p>
        ) : (
          <CoreTable>
            <CoreTableHeader><CoreTableRow>{definition.columns.map(([, label]) => <CoreTableHead key={label}>{label}</CoreTableHead>)}</CoreTableRow></CoreTableHeader>
            <CoreTableBody>
              {rows.map((row, index) => (
                <CoreTableRow key={typeof row?.[definition.idField] === "string" ? row[definition.idField] : `${definition.key}-${index}`}>
                  {definition.columns.map(([field]) => (
                    <CoreTableCell key={field} className="max-w-[260px] font-mono text-xs">
                      {field === "state" ? <StateBadge state={row?.[field]} /> : displayValue(row?.[field])}
                    </CoreTableCell>
                  ))}
                </CoreTableRow>
              ))}
            </CoreTableBody>
          </CoreTable>
        )}
      </CardContent>
    </Card>
  );
}

function StatusPanel({ title, detail, tone = "slate" }) {
  const colors = tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-700";
  return <div className={`rounded-xl border p-6 text-center ${colors}`}><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm">{detail}</p></div>;
}

export default function CoreAssurance() {
  const [authState, setAuthState] = useState("loading");
  const [organisations, setOrganisations] = useState([]);
  const [orgState, setOrgState] = useState("loading");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [assuranceState, setAssuranceState] = useState("idle");
  const [assurance, setAssurance] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!active) return;
        if (user?.role !== "admin") {
          setAuthState("denied");
          setOrgState("idle");
          return;
        }
        setAuthState("admin");
        try {
          const records = await base44.entities.Organization.list();
          if (!active) return;
          const safeRecords = (Array.isArray(records) ? records : [])
            .filter((org) => typeof org?.id === "string" && org.id)
            .map((org) => ({ id: org.id, name: typeof org.name === "string" && org.name.trim() ? org.name.trim() : `Organisation ${org.id.slice(0, 8)}` }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setOrganisations(safeRecords);
          setOrgState(safeRecords.length ? "ready" : "empty");
          if (safeRecords.length) setSelectedOrgId(safeRecords[0].id);
        } catch {
          if (active) setOrgState("error");
        }
      } catch {
        if (active) {
          setAuthState("error");
          setOrgState("idle");
        }
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authState !== "admin" || !selectedOrgId) return undefined;
    const controller = new AbortController();
    setAssurance(null);
    setErrorMessage("");
    setAssuranceState("loading");
    fetchCoreAssurance({ orgId: selectedOrgId, limit: 100, signal: controller.signal })
      .then((result) => {
        setAssurance(result);
        setAssuranceState("ready");
      })
      .catch((error) => {
        if (error?.code === "CORE_REQUEST_CANCELLED") return;
        setErrorMessage(error?.message || "Core assurance is unavailable.");
        setAssuranceState(error?.status === 404 ? "unavailable" : "error");
      });
    return () => controller.abort();
  }, [authState, selectedOrgId]);

  const counts = useMemo(() => Object.fromEntries(TABLES.map(({ key }) => [key, assurance?.[key]?.length || 0])), [assurance]);

  if (authState === "loading") return <div className="min-h-screen grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-600" aria-label="Checking admin access" /></div>;
  if (authState === "denied") return <div className="min-h-screen grid place-items-center p-6"><StatusPanel title="Admin access required" detail="Core Assurance is restricted to AssessSuite administrators." tone="red" /></div>;
  if (authState === "error") return <div className="min-h-screen grid place-items-center p-6"><StatusPanel title="Access check unavailable" detail="Administrator access could not be verified. No Core data was requested." tone="red" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><ServerCog className="h-8 w-8 text-violet-600" /> Core Assurance</h1>
            <p className="mt-1 text-slate-500">Read-only orchestration, review and runtime assurance metadata. No patient content, prompts or queries are shown.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Core V1 sandbox</Badge>
            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Production disabled</Badge>
            <Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" />Content-free</Badge>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Availability contract pending</p>
          <p className="mt-1">This dormant administration page is intentionally omitted from navigation until the server publishes Core availability. Direct inspection can show sandbox metadata only when the admin endpoint is available.</p>
        </div>

        <Card className="border-slate-200/70 bg-white/80">
          <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(240px,420px)_1fr] md:items-end">
            <div>
              <label htmlFor="core-organisation" className="mb-2 block text-sm font-medium text-slate-700">Organisation</label>
              {orgState === "ready" ? (
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <CoreSelectTrigger id="core-organisation"><SelectValue placeholder="Select an organisation" /></CoreSelectTrigger>
                  <CoreSelectContent>{organisations.map((org) => <CoreSelectItem key={org.id} value={org.id}>{org.name}</CoreSelectItem>)}</CoreSelectContent>
                </Select>
              ) : <p className="text-sm text-slate-500">{orgState === "loading" ? "Loading organisations…" : orgState === "empty" ? "No organisations are available." : "Organisation records are unavailable."}</p>}
            </div>
            <div className="text-sm text-slate-500">The server independently enforces administrator role and organisation scope.</div>
          </CardContent>
        </Card>

        {assuranceState === "idle" && orgState !== "ready" && <StatusPanel title="Core data not requested" detail="Select an available organisation after organisation records become available." />}
        {assuranceState === "loading" && <StatusPanel title="Loading Core assurance" detail="Reading bounded, content-free operational metadata…" />}
        {assuranceState === "unavailable" && <StatusPanel title="Core assurance unavailable" detail="The Core V1 assurance endpoint is not enabled on this server. Production remains disabled." />}
        {assuranceState === "error" && <StatusPanel title="Core assurance could not be loaded" detail={errorMessage || "No Core data is displayed."} tone="red" />}

        {assuranceState === "ready" && assurance && (
          <>
            <Card className="border-violet-200 bg-violet-50/60">
              <CardContent className="grid gap-3 p-4 text-sm md:grid-cols-4">
                <div><span className="text-slate-500">Runtime mode</span><div className="mt-1"><StateBadge state={assurance.environment.mode} /></div></div>
                <div><span className="text-slate-500">Schema version</span><p className="mt-1 font-mono">{displayValue(assurance.schema.version)}</p></div>
                <div><span className="text-slate-500">Schema checksum</span><p className="mt-1 font-mono text-xs">{displayValue(assurance.schema.checksum)}</p></div>
                <div><span className="text-slate-500">Response window limit</span><p className="mt-1 font-mono">{assurance.windowLimit} per collection</p></div>
              </CardContent>
            </Card>
            <p className="text-sm text-slate-500">Counts below are records visible in this bounded recent response, not organisation-wide totals.</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <SummaryCard icon={Boxes} label="Visible capabilities" value={counts.capabilities} />
              <SummaryCard icon={Database} label="Visible configurations" value={counts.config_versions} />
              <SummaryCard icon={Activity} label="Recent runs shown" value={counts.runs} />
              <SummaryCard icon={FileCheck2} label="Recent artifacts shown" value={counts.artifacts} />
              <SummaryCard icon={GitPullRequest} label="Recent reviews shown" value={counts.reviews} />
              <SummaryCard icon={ServerCog} label="Recent jobs shown" value={counts.jobs} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">{TABLES.map((definition) => <AssuranceTable key={definition.key} definition={definition} rows={assurance[definition.key]} />)}</div>
          </>
        )}
      </div>
    </div>
  );
}
