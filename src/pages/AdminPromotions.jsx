import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgePercent,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  TicketPercent,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// The captured UI primitives predate typed prop declarations. Keep this new
// surface typechecked by adapting those four primitives at the import edge.
const FormInput = /** @type {React.ComponentType<any>} */ (Input);
const FormLabel = /** @type {React.ComponentType<any>} */ (Label);
const FormSwitch = /** @type {React.ComponentType<any>} */ (Switch);
const FormTextarea = /** @type {React.ComponentType<any>} */ (Textarea);

const EMPTY_FORM = {
  code: "",
  name: "",
  discount_type: "percent",
  discount_value: "",
  duration: "once",
  max_redemptions: "",
  expires_at: "",
  first_time_only: false,
  minimum_amount: "",
  internal_note: "",
};

function formatDate(timestamp) {
  if (!timestamp) return "No expiry";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function discountLabel(promotion) {
  const coupon = promotion.coupon || {};
  if (coupon.percent_off != null) return `${coupon.percent_off}% off`;
  if (coupon.amount_off != null) {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })
      .format(coupon.amount_off / 100) + " off";
  }
  return "Discount";
}

function statusOf(promotion) {
  if (!promotion.active || promotion.coupon?.valid === false) return "inactive";
  if (promotion.expires_at && promotion.expires_at * 1000 <= Date.now()) return "expired";
  if (promotion.max_redemptions && promotion.times_redeemed >= promotion.max_redemptions) return "used";
  return "active";
}

function StatusBadge({ status }) {
  const styles = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    inactive: "border-slate-200 bg-slate-100 text-slate-600",
    expired: "border-amber-200 bg-amber-50 text-amber-700",
    used: "border-blue-200 bg-blue-50 text-blue-700",
  };
  return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
}

export default function AdminPromotions() {
  const [currentUser, setCurrentUser] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [mode, setMode] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [showCreate, setShowCreate] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);

  const invoke = async (payload) => {
    const response = await base44.functions.invoke("managePromotions", payload);
    return response?.data ?? response;
  };

  const loadPromotions = async () => {
    const result = await invoke({ action: "list" });
    setPromotions(result?.promotions || []);
    setMode(result?.mode || null);
    setHasMore(Boolean(result?.has_more));
  };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!live) return;
        setCurrentUser(user);
        if (user?.role === "admin") await loadPromotions();
      } catch (error) {
        toast.error(error?.message || "Could not load promotion codes.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const filteredPromotions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return promotions.filter((promotion) => {
      const status = statusOf(promotion);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesQuery = !needle || [
        promotion.code,
        promotion.coupon?.name,
        promotion.metadata?.assesssuite_internal_note,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
      return matchesStatus && matchesQuery;
    });
  }, [promotions, query, statusFilter]);

  const stats = useMemo(() => ({
    active: promotions.filter((promotion) => statusOf(promotion) === "active").length,
    redeemed: promotions.reduce((sum, promotion) => sum + (promotion.times_redeemed || 0), 0),
    limited: promotions.filter((promotion) => promotion.max_redemptions || promotion.expires_at).length,
  }), [promotions]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const result = await invoke({
        action: "create",
        ...form,
        // datetime-local is intentionally converted in the administrator's
        // browser so the server receives an unambiguous instant.
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : "",
      });
      toast.success(`${result.promotion.code} is ready to use.`);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await loadPromotions();
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || "Could not create the promotion code.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (promotion) => {
    if (!window.confirm(`Deactivate ${promotion.code}? Existing subscriptions keep discounts already applied, but the code cannot be used again.`)) return;
    setDeactivatingId(promotion.id);
    try {
      await invoke({ action: "deactivate", promotion_id: promotion.id });
      toast.success(`${promotion.code} has been deactivated.`);
      await loadPromotions();
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || "Could not deactivate the promotion code.");
    } finally {
      setDeactivatingId(null);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`${code} copied.`);
    } catch {
      toast.error("Copy failed. Select the code and copy it manually.");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div>;
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Card className="max-w-md w-full border-slate-200 shadow-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <ShieldCheck className="h-11 w-11 mx-auto text-red-500 mb-4" />
            <h1 className="text-xl font-semibold text-slate-900">Admin access required</h1>
            <p className="text-sm text-slate-600 mt-2">Only AssessSuite administrators can issue or retire promotion codes.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
                <TicketPercent className="h-4 w-4" /> Commercial controls
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Promotion codes</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                Create controlled discounts for Stripe checkout, see redemption activity, and stop a code instantly.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link to="/AdminApprovals"><Users className="mr-2 h-4 w-4" /> Manage administrators</Link>
              </Button>
              <Button onClick={() => setShowCreate((value) => !value)} className="bg-violet-500 text-white hover:bg-violet-400">
                <Plus className="mr-2 h-4 w-4" /> New promo code
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Active codes", value: stats.active, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
            { label: "Total redemptions", value: stats.redeemed, icon: Clipboard, tone: "text-blue-600 bg-blue-50" },
            { label: "Codes with limits", value: stats.limited, icon: Clock3, tone: "text-violet-600 bg-violet-50" },
          ].map((item) => (
            <Card key={item.label} className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div><p className="text-sm text-slate-500">{item.label}</p><p className="mt-1 text-3xl font-semibold text-slate-950">{item.value}</p></div>
                <div className={`rounded-2xl p-3 ${item.tone}`}><item.icon className="h-5 w-5" /></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {showCreate && (
          <Card className="border-violet-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-xl"><BadgePercent className="h-5 w-5 text-violet-600" /> Issue a promotion code</CardTitle>
              <p className="text-sm text-slate-500">The code becomes available in the secure Stripe checkout as soon as it is created.</p>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <FormLabel htmlFor="promo-code">Customer code</FormLabel>
                    <FormInput id="promo-code" value={form.code} onChange={(e) => updateForm("code", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="WELCOME20" minLength={3} maxLength={32} required />
                    <p className="text-xs text-slate-500">Letters, numbers and hyphens only.</p>
                  </div>
                  <div className="space-y-2">
                    <FormLabel htmlFor="campaign-name">Campaign name</FormLabel>
                    <FormInput id="campaign-name" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="August launch offer" maxLength={40} required />
                  </div>
                  <div className="space-y-2">
                    <FormLabel htmlFor="discount-type">Discount type</FormLabel>
                    <select id="discount-type" value={form.discount_type} onChange={(e) => updateForm("discount_type", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                      <option value="percent">Percentage</option>
                      <option value="amount">Fixed amount (AUD)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <FormLabel htmlFor="discount-value">{form.discount_type === "percent" ? "Percentage off" : "Amount off (AUD)"}</FormLabel>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm text-slate-500">{form.discount_type === "percent" ? "%" : "$"}</span>
                      <FormInput id="discount-value" className="pl-8" type="number" min="0.01" max={form.discount_type === "percent" ? "100" : "10000"} step="0.01" value={form.discount_value} onChange={(e) => updateForm("discount_value", e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <FormLabel htmlFor="duration">Applies to</FormLabel>
                    <select id="duration" value={form.duration} onChange={(e) => updateForm("duration", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                      <option value="once">First subscription payment only</option>
                      <option value="forever">Every subscription payment</option>
                    </select>
                    {form.duration === "forever" && <p className="text-xs font-medium text-amber-700">This discount continues for the life of each redeemed subscription.</p>}
                  </div>
                  <div className="space-y-2">
                    <FormLabel htmlFor="max-redemptions">Redemption limit <span className="font-normal text-slate-400">optional</span></FormLabel>
                    <FormInput id="max-redemptions" type="number" min="1" max="100000" step="1" value={form.max_redemptions} onChange={(e) => updateForm("max_redemptions", e.target.value)} placeholder="Unlimited" />
                  </div>
                  <div className="space-y-2">
                    <FormLabel htmlFor="expiry">Expiry <span className="font-normal text-slate-400">optional</span></FormLabel>
                    <FormInput id="expiry" type="datetime-local" value={form.expires_at} onChange={(e) => updateForm("expires_at", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <FormLabel htmlFor="minimum-amount">Minimum first payment <span className="font-normal text-slate-400">optional</span></FormLabel>
                    <div className="relative"><span className="absolute left-3 top-2 text-sm text-slate-500">$</span><FormInput id="minimum-amount" className="pl-8" type="number" min="0.01" max="10000" step="0.01" value={form.minimum_amount} onChange={(e) => updateForm("minimum_amount", e.target.value)} placeholder="No minimum" /></div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                    <div><FormLabel htmlFor="first-time" className="cursor-pointer">New customers only</FormLabel><p className="mt-1 text-xs text-slate-500">Stripe checks prior payments and invoices.</p></div>
                    <FormSwitch id="first-time" checked={form.first_time_only} onCheckedChange={(checked) => updateForm("first_time_only", checked)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FormLabel htmlFor="internal-note">Internal note <span className="font-normal text-slate-400">optional</span></FormLabel>
                  <FormTextarea id="internal-note" value={form.internal_note} onChange={(e) => updateForm("internal_note", e.target.value)} placeholder="Why this code was issued, who approved it, or where it will be shared." maxLength={500} />
                  <p className="text-right text-xs text-slate-400">{form.internal_note.length}/500</p>
                </div>
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={creating} className="bg-violet-600 hover:bg-violet-700">
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-2 h-4 w-4" />} Create active code
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="gap-4 border-b border-slate-100 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-xl">Issued codes</CardTitle>
              <p className="mt-1 text-sm text-slate-500">{mode === "mock" ? "Local test data — no Stripe changes are being made." : "Live data from the connected Stripe account."}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><FormInput className="pl-9 sm:w-64" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, campaign or note" /></div>
              <select aria-label="Filter promotion codes by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm">
                <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="expired">Expired</option><option value="used">Limit reached</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {hasMore && <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">Showing the first 100 Stripe promotion records. Use Stripe for older history until pagination is added.</div>}
            {filteredPromotions.length === 0 ? (
              <div className="px-6 py-14 text-center"><TicketPercent className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-medium text-slate-700">No promotion codes found</p><p className="mt-1 text-sm text-slate-500">Create the first code or change the current filters.</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPromotions.map((promotion) => {
                  const status = statusOf(promotion);
                  return (
                    <article key={promotion.id} className="grid gap-4 px-5 py-5 transition-colors hover:bg-slate-50/70 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => copyCode(promotion.code)} className="group flex items-center gap-2 rounded-md font-mono text-lg font-semibold tracking-wide text-slate-950 focus:outline-none focus:ring-2 focus:ring-violet-500"><span>{promotion.code}</span><Copy className="h-4 w-4 text-slate-400 group-hover:text-violet-600" /></button><StatusBadge status={status} /></div>
                        <p className="mt-1 text-sm text-slate-500">{promotion.coupon?.name || "Unnamed campaign"}</p>
                        {promotion.metadata?.assesssuite_internal_note && <p className="mt-2 line-clamp-2 text-xs text-slate-400">{promotion.metadata.assesssuite_internal_note}</p>}
                      </div>
                      <div><p className="font-semibold text-slate-900">{discountLabel(promotion)}</p><p className="mt-1 text-sm text-slate-500">{promotion.coupon?.duration === "forever" ? "Every subscription payment" : "First payment only"}{promotion.restrictions?.first_time_transaction ? " · New customers" : ""}</p></div>
                      <div><p className="text-sm font-medium text-slate-700">{promotion.times_redeemed || 0}{promotion.max_redemptions ? ` of ${promotion.max_redemptions}` : " redemptions"}</p><p className="mt-1 text-sm text-slate-500">{formatDate(promotion.expires_at)}</p></div>
                      <div className="flex justify-end">{status === "active" ? <Button variant="outline" size="sm" onClick={() => handleDeactivate(promotion)} disabled={deactivatingId === promotion.id} className="text-red-700 hover:bg-red-50 hover:text-red-800">{deactivatingId === promotion.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Deactivate</Button> : <span className="flex items-center gap-1 text-xs text-slate-400"><CheckCircle2 className="h-4 w-4" /> History retained</span>}</div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
