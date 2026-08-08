import React, { useState, useEffect } from "react";
import {
  Card as CardPrimitive,
  CardContent as CardContentPrimitive,
  CardHeader as CardHeaderPrimitive,
  CardTitle as CardTitlePrimitive,
} from "@/components/ui/card";
import { Button as ButtonPrimitive } from "@/components/ui/button";
import { Input as InputPrimitive } from "@/components/ui/input";
import { Badge as BadgePrimitive } from "@/components/ui/badge";
import {
  Tabs as TabsPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
} from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import {
  Search,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Target,
  Activity,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { Toaster, toast } from "sonner";
import ClickableReferences from "../components/assessments/ClickableReferences";
import { getReferenceVerificationBadge } from "@/lib/referenceVerificationBadge";
import { normaliseProtocolResponse } from "@/lib/protocolResponse";
import { isInitialClinicalReleaseEligible } from "@/lib/clinicalRelease";
import {
  auditProtocolCatalogue,
  isProtocolAvailableTo,
  normaliseProfession,
  normaliseProtocolText,
  PROTOCOL_SEARCH_STATE,
  searchProtocolCatalogue,
} from "@/lib/clinical/protocol-assistance/index.js";

// The shared JavaScript UI wrappers accept the rendered props below, while
// checkJs infers ref-only signatures from forwardRef. These source-local
// declarations preserve the actual component contract without runtime casts.
const Card = /** @type {React.ComponentType<any>} */ (CardPrimitive);
const CardContent = /** @type {React.ComponentType<any>} */ (CardContentPrimitive);
const CardHeader = /** @type {React.ComponentType<any>} */ (CardHeaderPrimitive);
const CardTitle = /** @type {React.ComponentType<any>} */ (CardTitlePrimitive);
const Button = /** @type {React.ComponentType<any>} */ (ButtonPrimitive);
const Input = /** @type {React.ComponentType<any>} */ (InputPrimitive);
const Badge = /** @type {React.ComponentType<any>} */ (BadgePrimitive);
const Tabs = /** @type {React.ComponentType<any>} */ (TabsPrimitive);
const TabsContent = /** @type {React.ComponentType<any>} */ (TabsContentPrimitive);
const TabsList = /** @type {React.ComponentType<any>} */ (TabsListPrimitive);
const TabsTrigger = /** @type {React.ComponentType<any>} */ (TabsTriggerPrimitive);

const REVIEWED_PROTOCOL_CATEGORIES = new Set([
  "musculoskeletal",
  "cardio_pulmonary",
  "metabolic",
  "neurological",
  "mental_health",
  "geriatric",
  "general",
]);

const PROTOCOL_CATEGORY_ICONS = Object.freeze({
  musculoskeletal: "\u{1F9B4}",
  cardio_pulmonary: "\u2764\uFE0F",
  metabolic: "\u{1F489}",
  neurological: "\u{1F9E0}",
  mental_health: "\u{1F9D8}",
  geriatric: "\u{1F9D3}",
  general: "\u{1F397}\uFE0F",
});

const PROTOCOL_CATALOGUE_ACCESS_STATE = Object.freeze({
  LOADING: "loading",
  READY: "ready",
  UNSUPPORTED: "unsupported",
  UNAVAILABLE: "unavailable",
});

const PROTOCOL_RESULT_LIMIT = 25;
const PROTOCOL_QUERY_MAX_LENGTH = 160;

function toCatalogueCondition(validation) {
  const protocol = validation.record;
  const category = REVIEWED_PROTOCOL_CATEGORIES.has(protocol.category) ? protocol.category : "general";
  return {
    id: protocol.id || protocol.source_id || `${validation.normalisedConditionName}:${validation.metadata.version}`,
    name: validation.conditionName,
    category,
    icon: PROTOCOL_CATEGORY_ICONS[category] || PROTOCOL_CATEGORY_ICONS.general,
    governance: validation.metadata,
    protocol,
  };
}

function toSearchCondition(match) {
  const category = REVIEWED_PROTOCOL_CATEGORIES.has(match.category) ? match.category : "general";
  return {
    id: match.id,
    name: match.condition_name,
    category,
    icon: PROTOCOL_CATEGORY_ICONS[category] || PROTOCOL_CATEGORY_ICONS.general,
    governance: match.governance,
    protocol: match.protocol,
  };
}

function sourceDescription(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return "Source metadata unavailable";
  return source.title || source.citation || source.name || "Source metadata unavailable";
}

function sourceLocator(source) {
  if (!source || typeof source !== "object") return "";
  return source.url || source.doi || source.reference_id || source.source_id || "";
}

function catalogueRecordName(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "";
  const value = Reflect.get(record, "condition_name");
  return typeof value === "string" ? value : "";
}

export function deriveAuthenticatedProtocolSearchContext(user) {
  const profession = normaliseProfession(user?.profession);
  if (
    !isInitialClinicalReleaseEligible(user)
    || profession !== "accredited_exercise_physiologist"
  ) {
    return Object.freeze({
      state: PROTOCOL_CATALOGUE_ACCESS_STATE.UNSUPPORTED,
      context: null,
    });
  }

  const hasCredential = typeof user?.registration_number === "string"
    && user.registration_number.trim() !== ""
    && typeof user?.qualifications === "string"
    && user.qualifications.trim() !== "";
  if (user?.account_status !== "active" || !hasCredential) {
    return Object.freeze({
      state: PROTOCOL_CATALOGUE_ACCESS_STATE.UNAVAILABLE,
      context: null,
    });
  }

  return Object.freeze({
    state: PROTOCOL_CATALOGUE_ACCESS_STATE.READY,
    context: Object.freeze({
      profession,
      // The current product boundary maps an authenticated AEP profile to the
      // exercise-physiology catalogue. It is not accepted from user input.
      scope: "exercise_physiology",
    }),
  });
}

export default function TreatmentProtocols() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [protocolData, setProtocolData] = useState(null);
  const [reviewedProtocols, setReviewedProtocols] = useState([]);
  const [isCatalogueLoading, setIsCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState(false);
  const [catalogueAccess, setCatalogueAccess] = useState(() => (
    /** @type {{state: string, context: null | {profession: string, scope: string}}} */ ({
      state: PROTOCOL_CATALOGUE_ACCESS_STATE.LOADING,
      context: null,
    })
  ));
  const [searchResult, setSearchResult] = useState(null);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    assessment: true,
    exercises: true,
    progression: true,
    contraindications: true,
    outcomes: true,
    meta_analysis: true,
    references: false
  });

  const asOfDate = new Date().toISOString().slice(0, 10);
  const catalogueAudit = auditProtocolCatalogue(
    catalogueError ? null : reviewedProtocols,
    { asOf: asOfDate },
  );
  const blockedCatalogueCount = catalogueAudit.entries.filter((entry) => !entry.ok).length;
  const catalogueConditions = catalogueAudit.entries
    .filter((entry) => (
      catalogueAccess.context !== null
      && isProtocolAvailableTo(entry, catalogueAccess.context)
    ))
    .map(toCatalogueCondition);
  const normalizedSearchTerm = normaliseProtocolText(searchTerm);
  const searchMatchConditions = searchResult?.state === PROTOCOL_SEARCH_STATE.MATCHES
    ? searchResult.matches.map(toSearchCondition)
    : null;
  const filteredConditions = catalogueConditions.filter(condition => {
    const matchesSearch = normaliseProtocolText(condition.name).includes(normalizedSearchTerm);
    const matchesCategory = selectedCategory === "all" || condition.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const visibleConditions = searchMatchConditions || filteredConditions;

  useEffect(() => {
    let active = true;

    (async () => {
      setIsCatalogueLoading(true);
      setCatalogueError(false);
      try {
        const authenticatedUser = await base44.auth.me();
        if (!active) return;
        setCurrentUser(authenticatedUser);
        const derivedAccess = deriveAuthenticatedProtocolSearchContext(authenticatedUser);
        setCatalogueAccess(derivedAccess);
        if (derivedAccess.state !== PROTOCOL_CATALOGUE_ACCESS_STATE.READY) {
          setReviewedProtocols([]);
          return;
        }

        const rows = await base44.entities.TreatmentProtocol.list();
        const catalogue = (Array.isArray(rows) ? [...rows] : [])
          .sort((left, right) => (
            catalogueRecordName(left).localeCompare(
              catalogueRecordName(right),
              undefined,
              { sensitivity: "base" },
            )
          ));
        if (active) setReviewedProtocols(catalogue);
      } catch (error) {
        console.error("Error loading reviewed treatment protocols:", error);
        if (active) {
          setReviewedProtocols([]);
          setCatalogueError(true);
          setCatalogueAccess({
            state: PROTOCOL_CATALOGUE_ACCESS_STATE.UNAVAILABLE,
            context: null,
          });
          toast.error("Failed to load reviewed treatment protocols");
        }
      } finally {
        if (active) setIsCatalogueLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const runProtocolSearch = (queryInput) => {
    if (
      catalogueAccess.state !== PROTOCOL_CATALOGUE_ACCESS_STATE.READY
      || !catalogueAccess.context
    ) {
      setSearchResult({
        state: catalogueAccess.state === PROTOCOL_CATALOGUE_ACCESS_STATE.UNSUPPORTED
          ? PROTOCOL_SEARCH_STATE.UNSUPPORTED
          : PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED,
        matches: [],
        blocked: [],
      });
      return;
    }
    const result = searchProtocolCatalogue({
      query: queryInput,
      catalogue: catalogueError ? null : reviewedProtocols,
      ...catalogueAccess.context,
      limit: PROTOCOL_RESULT_LIMIT,
      asOf: asOfDate,
    });

    setSelectedCondition(null);
    setProtocolData(null);

    if (result.state !== PROTOCOL_SEARCH_STATE.MATCHES) {
      setSearchResult(result);
      return;
    }

    const condition = toSearchCondition(result.matches[0]);
    const reviewed = normaliseProtocolResponse(condition.protocol);
    if (!reviewed.ok || reviewed.degraded) {
      const issues = reviewed.dropped.length > 0
        ? reviewed.dropped.map((path) => ({ field: path, code: "invalid_render_contract" }))
        : [{ field: "protocol", code: "invalid_render_contract" }];
      setSearchResult({
        ...result,
        state: PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED,
        code: "matching_catalogue_entry_failed_render_contract",
        blocked: [{ id: condition.id, condition_name: condition.name, issues }],
        matches: [],
      });
      return;
    }

    setSearchResult(result);
    setSelectedCondition(condition);
    setProtocolData(reviewed.protocol);
  };


  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <>
      <Toaster richColors position="top-center" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Protocol Assistance</h1>
              <p className="text-slate-600">Governed exercise-physiology catalogue cards only</p>
            </div>
          </div>

          {/* Protocol disclaimer popup */}
          {catalogueAccess.state === PROTOCOL_CATALOGUE_ACCESS_STATE.READY && !disclaimerDismissed && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">Clinical Reminder</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Catalogue cards are <strong>reference frameworks only</strong>. Search results are
                  deterministic and never generate, adapt or personalise treatment. Your clinical judgement applies at all times.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { window.history.back(); }}
                    className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setDisclaimerDismissed(true);
                      try {
                        const ip = 'not-collected';
                        await base44.entities.LegalAcceptance.create({
                          user_email: currentUser?.email || 'unknown',
                          user_role: currentUser?.role === 'admin' ? 'Admin' : 'Clinician',
                          document_set_id: "allied-assess-treatment-protocol-disclaimer-v1",
                          document_set_version: "1.0.0",
                          accepted_documents: ["treatment_protocol_disclaimer"],
                          accepted: true,
                          ip_address: ip,
                          user_agent: navigator.userAgent,
                          session_timestamp: new Date().toISOString()
                        });
                      } catch(e) { console.error('Failed to log disclaimer:', e); }
                    }}
                    className="flex-1 py-2 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Condition Search */}
            {!sidebarCollapsed && (
            <div className="lg:col-span-1">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 sticky top-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Select Condition</CardTitle>
                    {protocolData && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarCollapsed(true)}
                        className="flex items-center gap-1"
                      >
                        <ChevronDown className="h-4 w-4 rotate-90" />
                        <span className="text-xs">Hide</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        aria-label="Search governed protocol catalogue"
                        placeholder="Search reviewed catalogue..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setSearchResult(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isCatalogueLoading) {
                            e.preventDefault();
                            runProtocolSearch(searchTerm);
                          }
                        }}
                        maxLength={PROTOCOL_QUERY_MAX_LENGTH}
                        disabled={catalogueAccess.state !== PROTOCOL_CATALOGUE_ACCESS_STATE.READY}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      variant="default"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => runProtocolSearch(searchTerm)}
                      disabled={isCatalogueLoading || catalogueAccess.state !== PROTOCOL_CATALOGUE_ACCESS_STATE.READY}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Search reviewed catalogue
                    </Button>
                    <p className="text-xs text-slate-500">
                      Free text, Enter, presets and autocomplete all use the same bounded catalogue search.
                      No content is generated when there is no approved match.
                    </p>
                  </div>

                  <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                    <TabsList className="grid grid-cols-2 gap-2">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="musculoskeletal">MSK</TabsTrigger>
                    </TabsList>
                    <TabsList className="grid grid-cols-2 gap-2 mt-2">
                      <TabsTrigger value="cardio_pulmonary">Cardio</TabsTrigger>
                      <TabsTrigger value="metabolic">Metabolic</TabsTrigger>
                    </TabsList>
                    <TabsList className="grid grid-cols-2 gap-2 mt-2">
                      <TabsTrigger value="neurological">Neuro</TabsTrigger>
                      <TabsTrigger value="mental_health">Mental</TabsTrigger>
                    </TabsList>
                    <TabsList className="grid grid-cols-2 gap-2 mt-2">
                      <TabsTrigger value="geriatric">Geriatric</TabsTrigger>
                      <TabsTrigger value="general">General</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {!isCatalogueLoading && !catalogueError && blockedCatalogueCount > 0 && (
                    <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <strong>Catalogue governance block:</strong>{" "}
                      {blockedCatalogueCount} of {reviewedProtocols.length} records are missing or have failed
                      required profession, scope, source, reviewer, version, expiry, rights or management-target
                      controls. They remain visible in this count but cannot be searched or rendered.
                    </div>
                  )}

                  {searchResult && (
                    <div
                      data-protocol-search-state={searchResult.state}
                      role={searchResult.state === PROTOCOL_SEARCH_STATE.MATCHES ? "status" : "alert"}
                      className={searchResult.state === PROTOCOL_SEARCH_STATE.MATCHES
                        ? "rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                        : "rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"}
                    >
                      {searchResult.state === PROTOCOL_SEARCH_STATE.MATCHES && (
                        <><strong>Matches.</strong> {searchResult.matches.length} governed catalogue result{searchResult.matches.length === 1 ? "" : "s"}.</>
                      )}
                      {searchResult.state === PROTOCOL_SEARCH_STATE.NO_MATCH && (
                        <><strong>No match.</strong> No approved catalogue card matches this topic. No protocol was generated.</>
                      )}
                      {searchResult.state === PROTOCOL_SEARCH_STATE.UNSUPPORTED && (
                        <div>
                          <strong>Unsupported.</strong> This topic is outside the approved exercise-physiology catalogue or professional scope.
                          {Array.isArray(searchResult.reasons) && searchResult.reasons.length > 0 && (
                            <ul className="mt-2 list-disc pl-5">
                              {searchResult.reasons.map((reason, index) => (
                                <li key={reason.condition_name || index}>{reason.condition_name}: {reason.reason}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {searchResult.state === PROTOCOL_SEARCH_STATE.INVALID_QUERY && (
                        <><strong>Invalid search.</strong> Enter at least two letters and no more than {PROTOCOL_QUERY_MAX_LENGTH} characters.</>
                      )}
                      {searchResult.state === PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED && (
                        <div>
                          <strong>Catalogue blocked.</strong> A matching card failed governance or render-contract checks and cannot be displayed.
                          {Array.isArray(searchResult.blocked) && searchResult.blocked.length > 0 && (
                            <ul className="mt-2 list-disc pl-5">
                              {searchResult.blocked.map((entry) => (
                                <li key={entry.id}>
                                  {entry.condition_name || entry.id}: {entry.issues.map((issue) => issue.field + " (" + issue.code + ")").join(", ")}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {isCatalogueLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading reviewed protocols...
                      </div>
                    ) : catalogueAccess.state === PROTOCOL_CATALOGUE_ACCESS_STATE.UNSUPPORTED ? (
                      <p role="alert" data-protocol-access-state="unsupported" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        <strong>Unsupported professional scope.</strong> Protocol Assistance is currently limited to authenticated Australian Exercise Physiologists. No catalogue content was loaded.
                      </p>
                    ) : catalogueAccess.state === PROTOCOL_CATALOGUE_ACCESS_STATE.UNAVAILABLE ? (
                      <p role="alert" data-protocol-access-state="unavailable" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <strong>Catalogue unavailable.</strong> An active credentialed profile, current primary-practice membership and current legal acceptance are required. No protocol content was loaded.
                      </p>
                    ) : catalogueError ? (
                      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <strong>Catalogue blocked.</strong> The reviewed catalogue is unavailable. No protocol content can be searched or displayed.
                      </p>
                    ) : visibleConditions.length === 0 ? (
                      <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        {normalizedSearchTerm
                          ? "No governed catalogue suggestions match this text. Submit the search for an explicit result."
                          : "No governed catalogue cards are available in this category."}
                      </p>
                    ) : visibleConditions.map((condition) => (
                      <Button
                        key={condition.id || condition.name}
                        variant={selectedCondition?.name === condition.name ? "default" : "outline"}
                        className="w-full justify-start h-auto py-3 text-left"
                        onClick={() => runProtocolSearch({ name: condition.name })}
                      >
                        <span className="mr-2 text-lg">{condition.icon}</span>
                        <span className="flex-1">
                          {condition.name}
                          {condition.governance?.version && (
                            <span className="block text-xs font-normal opacity-70">Version {condition.governance.version}</span>
                          )}
                        </span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            )}

            {/* Collapsed Sidebar Button */}
            {sidebarCollapsed && (
              <div className="fixed left-6 top-24 z-50">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSidebarCollapsed(false)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <ChevronDown className="h-4 w-4 -rotate-90 mr-2" />
                  Show Conditions
                </Button>
              </div>
            )}

            {/* Right Content - Protocol Details */}
            <div className={sidebarCollapsed ? "lg:col-span-3" : "lg:col-span-2"}>
              {!selectedCondition && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      Select a Condition
                    </h3>
                    <p className="text-slate-600">
                      Search or choose a governed catalogue card. Unsupported, unmatched and blocked topics never fall back to generated content.
                    </p>
                  </CardContent>
                </Card>
              )}

              {protocolData && (
                <div className="space-y-4">
                  {/* Header Card */}
                  <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-2xl text-slate-900 mb-2">
                            {selectedCondition?.icon} {selectedCondition?.name}
                          </CardTitle>
                           <div className="flex flex-wrap items-center gap-2 mt-2">
                             <Badge variant="secondary" className="capitalize">
                               {selectedCondition?.category?.replace(/_/g, ' ')}
                             </Badge>
                             <Badge className="bg-green-700 text-white">Governed catalogue card</Badge>
                             <Badge variant="outline">Version {selectedCondition?.governance?.version}</Badge>
                           </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  <Card className="bg-white/90 border-green-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Governance and source record</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-700">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="font-semibold text-slate-900">Independent review</p>
                          <p>
                            {selectedCondition?.governance?.reviewer?.name} ({selectedCondition?.governance?.reviewer?.credentials})
                          </p>
                          <p>Reviewed {selectedCondition?.governance?.reviewer?.reviewed_at}; review due {selectedCondition?.governance?.expiry}.</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Approved boundary</p>
                          <p>Profession: {selectedCondition?.governance?.professions?.join(", ")}</p>
                          <p>Scope: {selectedCondition?.governance?.scopes?.join(", ")}</p>
                          <p>Management target: {selectedCondition?.governance?.managementTarget}</p>
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Rights</p>
                        <p>
                          {selectedCondition?.governance?.rights?.status}: {selectedCondition?.governance?.rights?.holder
                            || selectedCondition?.governance?.rights?.licence
                            || selectedCondition?.governance?.rights?.license
                            || selectedCondition?.governance?.rights?.notice
                            || selectedCondition?.governance?.rights?.terms
                            || selectedCondition?.governance?.rights?.url}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Controlled sources</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {selectedCondition?.governance?.sources?.map((source, index) => (
                            <li key={sourceLocator(source) || index}>
                              {sourceDescription(source)}
                              {sourceLocator(source) && <span className="text-slate-500"> — {sourceLocator(source)}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Clinical Judgment & Responsibility Note - Moved to Top */}
                  <Card className="bg-amber-50 border-amber-300">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-900 mb-1">Clinical Responsibility & Professional Judgment</h4>
                          <p className="text-sm text-amber-800 mb-3">
                            {protocolData.clinical_note || "This reviewed catalogue card is a general reference framework and must not be treated as a patient-specific plan."}
                          </p>
                          <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mt-2">
                            <p className="text-sm text-amber-900 font-medium mb-2">Important Clinician Responsibilities:</p>
                            <ul className="text-xs text-amber-800 space-y-1.5 list-disc list-inside">
                              <li><strong>Exercise Prescription:</strong> The clinician is solely responsible for ensuring all exercise prescriptions are appropriate, safe, and correctly dosed for each individual client.</li>
                              <li><strong>Assessment & Testing:</strong> All assessment protocols, testing procedures, and outcome measures must be verified and correctly administered by the treating clinician.</li>
                              <li><strong>Progression Decisions:</strong> Clinical decisions regarding exercise progression, regression, or modification remain the exclusive responsibility of the treating clinician.</li>
                              <li><strong>Contraindication Screening:</strong> The clinician must independently screen for and identify all contraindications and precautions relevant to each client.</li>
                              <li><strong>Evidence Verification:</strong> While these protocols are evidence-informed, clinicians should verify references and stay current with emerging research in their area of practice.</li>
                              <li><strong>Documentation:</strong> Accurate documentation of clinical reasoning, client responses, and any deviations from suggested protocols is the clinician's responsibility.</li>
                            </ul>
                            <p className="text-xs text-amber-900 mt-3 italic">
                              This information is provided as a clinical decision support tool only. It does not replace professional clinical judgment, formal training, or regulatory requirements for exercise prescription.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Overview */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                    <CardHeader className="cursor-pointer" onClick={() => toggleSection('overview')}>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-blue-600" />
                          Condition Overview
                        </CardTitle>
                        {expandedSections.overview ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.overview && (
                      <CardContent className="space-y-4">
                        {protocolData.overview?.pathophysiology && (
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Pathophysiology</h4>
                            <p className="text-slate-600 leading-relaxed">{protocolData.overview.pathophysiology}</p>
                          </div>
                        )}
                        {protocolData.overview?.functional_impact && (
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Functional Impact</h4>
                            <p className="text-slate-600 leading-relaxed">{protocolData.overview.functional_impact}</p>
                          </div>
                        )}
                        {protocolData.overview?.prevalence && (
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Prevalence</h4>
                            <p className="text-slate-600 leading-relaxed">{protocolData.overview.prevalence}</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Assessment & Screening */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('assessment')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <Target className="w-5 h-5 text-purple-600" />
                         Assessment & Screening
                       </CardTitle>
                       {expandedSections.assessment ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.assessment && (
                     <CardContent className="space-y-4">
                       {protocolData.assessment?.key_assessments && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Key Assessments</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.assessment.key_assessments.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {protocolData.assessment?.outcome_measures && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Outcome Measures</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.assessment.outcome_measures.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {protocolData.assessment?.screening_tools && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Screening Tools</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.assessment.screening_tools.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {protocolData.assessment?.evidence_base && (
                         <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                           <h4 className="font-semibold text-purple-800 mb-2 text-sm">Evidence Base</h4>
                           <p className="text-sm text-slate-700">{protocolData.assessment.evidence_base}</p>
                         </div>
                       )}
                     </CardContent>
                   )}
                  </Card>

                  {/* Exercise Prescription */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('exercises')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <Activity className="w-5 h-5 text-green-600" />
                         Exercise Prescription
                       </CardTitle>
                       {expandedSections.exercises ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.exercises && (
                     <CardContent className="space-y-4">
                       {protocolData.exercise_prescription?.evidence_summary && (
                         <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                           <h4 className="font-semibold text-green-800 mb-2 text-sm">Evidence Summary</h4>
                           <p className="text-sm text-slate-700">{protocolData.exercise_prescription.evidence_summary}</p>
                         </div>
                       )}
                       {protocolData.exercise_prescription?.exercises && (
                         <div className="space-y-3">
                           {protocolData.exercise_prescription.exercises.map((exercise, i) => (
                             <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                               <div className="flex items-start justify-between mb-3">
                                 <div className="flex items-center gap-2">
                                   <span className="font-semibold text-slate-900 text-base">{i + 1}.</span>
                                   <h4 className="font-semibold text-slate-900 text-base">{exercise.name}</h4>
                                 </div>
                                 <div className="flex gap-2 flex-wrap justify-end">
                                   <Badge variant="outline" className="text-xs">{exercise.type}</Badge>
                                   {exercise.evidence_level && (
                                     <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">{exercise.evidence_level}</Badge>
                                   )}
                                 </div>
                               </div>
                               <div className="space-y-2 ml-6">
                                 <p className="text-sm text-slate-600"><span className="font-semibold text-slate-700">Dosage:</span> {exercise.dosage}</p>
                                 <p className="text-sm text-slate-600"><span className="font-semibold text-slate-700">Purpose:</span> {exercise.purpose}</p>
                                 {exercise.equipment && (
                                   <p className="text-sm text-slate-600"><span className="font-semibold text-slate-700">Equipment:</span> {exercise.equipment}</p>
                                 )}
                                 {exercise.modifications && (
                                   <div className="p-2 bg-amber-50 rounded border border-amber-200">
                                     <p className="text-sm text-slate-700"><span className="font-semibold text-amber-800">Modifications:</span> {exercise.modifications}</p>
                                   </div>
                                 )}
                                 {exercise.coaching_cues && (
                                   <div className="p-2 bg-blue-50 rounded border border-blue-200">
                                     <p className="text-sm text-slate-700"><span className="font-semibold text-blue-800">Coaching Cues:</span> {exercise.coaching_cues}</p>
                                   </div>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                       <div className="grid md:grid-cols-3 gap-4 mt-4">
                         {protocolData.exercise_prescription?.frequency && (
                           <div className="p-3 bg-blue-50 rounded-lg">
                             <p className="text-xs text-blue-600 font-semibold mb-1">Frequency</p>
                             <p className="text-sm text-slate-900">{protocolData.exercise_prescription.frequency}</p>
                           </div>
                         )}
                         {protocolData.exercise_prescription?.session_duration && (
                           <div className="p-3 bg-green-50 rounded-lg">
                             <p className="text-xs text-green-600 font-semibold mb-1">Session Duration</p>
                             <p className="text-sm text-slate-900">{protocolData.exercise_prescription.session_duration}</p>
                           </div>
                         )}
                         {protocolData.exercise_prescription?.program_duration && (
                           <div className="p-3 bg-purple-50 rounded-lg">
                             <p className="text-xs text-purple-600 font-semibold mb-1">Program Duration</p>
                             <p className="text-sm text-slate-900">{protocolData.exercise_prescription.program_duration}</p>
                           </div>
                         )}
                       </div>
                     </CardContent>
                   )}
                  </Card>

                  {/* Progression */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('progression')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <TrendingUp className="w-5 h-5 text-orange-600" />
                         Progression Guidelines
                       </CardTitle>
                       {expandedSections.progression ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.progression && (
                     <CardContent className="space-y-3">
                       {protocolData.progression?.evidence_base && (
                         <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                           <h4 className="font-semibold text-orange-800 mb-2 text-sm">Evidence Base</h4>
                           <p className="text-sm text-slate-700">{protocolData.progression.evidence_base}</p>
                         </div>
                       )}
                       {protocolData.progression?.phases && (
                         <>
                           {protocolData.progression.phases.map((phase, i) => (
                             <div key={i} className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                               <div className="flex items-center gap-2 mb-2">
                                 <Badge className="bg-orange-600">Phase {i + 1}</Badge>
                                 <h4 className="font-semibold text-slate-900">{phase.phase_name}</h4>
                               </div>
                               <p className="text-sm text-slate-600 mb-1"><strong>Duration:</strong> {phase.duration}</p>
                               <p className="text-sm text-slate-600 mb-1"><strong>Goals:</strong> {phase.goals}</p>
                               <p className="text-sm text-slate-600"><strong>Progression Criteria:</strong> {phase.criteria}</p>
                             </div>
                           ))}
                         </>
                       )}
                     </CardContent>
                   )}
                  </Card>

                  {/* Contraindications */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                    <CardHeader className="cursor-pointer" onClick={() => toggleSection('contraindications')}>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          Contraindications & Precautions
                        </CardTitle>
                        {expandedSections.contraindications ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.contraindications && (
                      <CardContent className="space-y-4">
                        {protocolData.contraindications?.absolute && (
                          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                            <h4 className="font-semibold text-red-800 mb-2">Absolute Contraindications</h4>
                            <ul className="list-disc list-inside space-y-1 text-red-700">
                              {protocolData.contraindications.absolute.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {protocolData.contraindications?.relative && (
                          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <h4 className="font-semibold text-yellow-800 mb-2">Relative Contraindications</h4>
                            <ul className="list-disc list-inside space-y-1 text-yellow-700">
                              {protocolData.contraindications.relative.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {protocolData.contraindications?.red_flags && (
                          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <h4 className="font-semibold text-orange-800 mb-2">Red Flags</h4>
                            <ul className="list-disc list-inside space-y-1 text-orange-700">
                              {protocolData.contraindications.red_flags.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Expected Outcomes */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('outcomes')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <Clock className="w-5 h-5 text-indigo-600" />
                         Expected Outcomes
                       </CardTitle>
                       {expandedSections.outcomes ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.outcomes && (
                     <CardContent className="space-y-4">
                       {protocolData.outcomes?.effect_sizes && (
                         <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                           <h4 className="font-semibold text-indigo-800 mb-2 text-sm">Effect Sizes from Meta-Analyses</h4>
                           <p className="text-sm text-slate-700">{protocolData.outcomes.effect_sizes}</p>
                         </div>
                       )}
                       {protocolData.outcomes?.expected_timeframe && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Timeframe</h4>
                           <p className="text-slate-600">{protocolData.outcomes.expected_timeframe}</p>
                         </div>
                       )}
                       {protocolData.outcomes?.key_outcomes && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Key Outcomes</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.outcomes.key_outcomes.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {protocolData.outcomes?.success_indicators && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Success Indicators</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.outcomes.success_indicators.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                     </CardContent>
                   )}
                  </Card>

                  {/* Meta-Analysis Summary */}
                  {protocolData.meta_analysis_summary && (
                   <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                     <CardHeader className="cursor-pointer" onClick={() => toggleSection('meta_analysis')}>
                       <div className="flex items-center justify-between">
                         <CardTitle className="flex items-center gap-2">
                           <BookOpen className="w-5 h-5 text-blue-600" />
                           Meta-Analysis Summary
                         </CardTitle>
                         {expandedSections.meta_analysis ? <ChevronUp /> : <ChevronDown />}
                       </div>
                     </CardHeader>
                     {expandedSections.meta_analysis && (
                       <CardContent className="space-y-4">
                         {protocolData.meta_analysis_summary.key_findings && (
                           <div>
                             <h4 className="font-semibold text-slate-800 mb-2">Key Findings</h4>
                             <ul className="list-disc list-inside space-y-1 text-slate-600">
                               {protocolData.meta_analysis_summary.key_findings.map((finding, i) => (
                                 <li key={i}>{finding}</li>
                               ))}
                             </ul>
                           </div>
                         )}
                         {protocolData.meta_analysis_summary.pooled_effects && (
                           <div className="p-3 bg-blue-50 rounded-lg">
                             <h4 className="font-semibold text-blue-800 mb-2 text-sm">Pooled Effects</h4>
                             <p className="text-sm text-slate-700">{protocolData.meta_analysis_summary.pooled_effects}</p>
                           </div>
                         )}
                         {protocolData.meta_analysis_summary.quality_of_evidence && (
                           <div className="p-3 bg-green-50 rounded-lg">
                             <h4 className="font-semibold text-green-800 mb-2 text-sm">Quality of Evidence</h4>
                             <p className="text-sm text-slate-700">{protocolData.meta_analysis_summary.quality_of_evidence}</p>
                           </div>
                         )}
                       </CardContent>
                     )}
                   </Card>
                  )}

                  {/* References */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('references')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <ExternalLink className="w-5 h-5 text-slate-600" />
                         Key References
                       </CardTitle>
                       {expandedSections.references ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.references && (
                     <CardContent>
                       {protocolData.references && protocolData.references.length > 0 ? (
                         <div className="space-y-3">
                           {protocolData.references.map((ref, i) => {
                             const badge = getReferenceVerificationBadge({ ...ref, verified: false });
                             return (
                               <div key={i} className={`p-3 rounded-lg border ${badge.cardClassName}`}>
                                 <div className="flex items-start justify-between gap-2 mb-1">
                                   <div className="text-sm text-slate-900 flex-1">
                                     <ClickableReferences references={ref.citation} verified={false} />
                                   </div>
                                   <div className="flex gap-1 flex-shrink-0">
                                     <Badge className={badge.className}>{badge.label}</Badge>
                                     {ref.study_type && (
                                       <Badge variant="outline" className="text-xs">{ref.study_type}</Badge>
                                     )}
                                   </div>
                                 </div>
                                 {ref.key_finding && (
                                   <p className="text-xs text-slate-600 italic mt-1">Key Finding: {ref.key_finding}</p>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                       ) : (
                         <p className="text-sm text-slate-500 italic">No verified references available for this protocol. Consult current clinical practice guidelines and peer-reviewed literature directly.</p>
                       )}
                     </CardContent>
                     )}
                     </Card>
                     </div>
                     )}
            </div>
          </div>
        </div>
      </div>

</>
  );
}
