import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Save, Loader2, RotateCcw, Plus, ChevronDown, ChevronUp,
  CheckCircle2, Archive, Star, AlertCircle, Copy, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { todayLocal } from "@/lib/localDate";

const DEFAULT_TEXTS = {
  consent_primary_text: "I consent to receive clinical assessment and treatment services. I understand that this may involve physical examination, movement assessment, and therapeutic interventions.",
  consent_privacy_text: "I consent to the collection, storage, and use of my personal health information for the purpose of providing clinical services and maintaining medical records in accordance with privacy regulations.",
  consent_assessment_text: "I consent to participate in various physical and psychological assessment tests as recommended by my clinician. I understand the purpose, risks, and benefits of these assessments.",
  consent_pricing_text: "I confirm that the pricing schedule for services has been explained to me and I agree to the stated fees and payment terms.",
  cancellation_policy_text: "I understand that appointments cancelled with less than 24 hours notice may incur a cancellation fee. I agree to provide adequate notice when cancelling or rescheduling appointments."
};

const CONSENT_ITEMS = [
  { key: "show_primary_consent", textKey: "consent_primary_text", label: "Primary Consent for Assessment and Treatment" },
  { key: "show_privacy_consent", textKey: "consent_privacy_text", label: "Privacy and Data Storage Consent" },
  { key: "show_assessment_consent", textKey: "consent_assessment_text", label: "Assessment and Testing Consent" },
  { key: "show_pricing_consent", textKey: "consent_pricing_text", label: "Pricing Schedule Agreement" },
  { key: "show_cancellation_policy", textKey: "cancellation_policy_text", label: "Cancellation Policy" },
];

function emptyPolicy(orgId) {
  return {
    org_id: orgId || "",
    policy_name: "Standard Consent Policy",
    version_label: "v1.0",
    effective_date: todayLocal(),
    is_active: true,
    show_primary_consent: true,
    show_privacy_consent: true,
    show_assessment_consent: true,
    show_pricing_consent: true,
    show_cancellation_policy: true,
    ...DEFAULT_TEXTS,
    notes: ""
  };
}

export default function ClinicPolicies() {
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [orgId, setOrgId] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      const mems = await base44.entities.OrganizationMember.filter({ user_email: user.email }).catch(() => []);
      const primary = (mems || []).find(m => m.is_primary) || (mems || [])[0];
      const uid = primary?.org_id || user.id;
      setOrgId(uid);
      try {
        const results = await base44.entities.ClinicPolicy.list();
        const filtered = (results || []).filter(p => p.org_id === uid);
        const sorted = filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setPolicies(sorted);
      } catch (policyErr) {
        console.warn("Could not load policies:", policyErr);
        setPolicies([]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load profile data");
    }
    setIsLoading(false);
  };

  const handleNew = () => {
    setEditingId(null);
    setEditingPolicy(emptyPolicy(orgId));
    setExpandedItems({});
    setShowNewForm(true);
  };

  const handleEdit = (policy) => {
    setEditingId(policy.id);
    setEditingPolicy({ ...policy });
    setExpandedItems({});
    setShowNewForm(true);
  };

  const handleDuplicate = (policy) => {
    const copy = {
      ...policy,
      id: undefined,
      policy_name: policy.policy_name + " (Copy)",
      version_label: policy.version_label + "-copy",
      is_active: false,
      effective_date: todayLocal(),
    };
    setEditingId(null);
    setEditingPolicy(copy);
    setExpandedItems({});
    setShowNewForm(true);
    toast.info("Duplicated — edit as needed then save");
  };

  const handleCancel = () => {
    setEditingPolicy(null);
    setEditingId(null);
    setShowNewForm(false);
  };

  const handleChange = (field, value) => {
    setEditingPolicy(prev => ({ ...prev, [field]: value }));
  };

  const handleSetActive = async (policy) => {
    try {
      await Promise.all(
        policies
          .filter(p => p.is_active && p.id !== policy.id)
          .map(p => base44.entities.ClinicPolicy.update(p.id, { is_active: false }))
      );
      await base44.entities.ClinicPolicy.update(policy.id, { is_active: true });
      toast.success(`"${policy.policy_name} ${policy.version_label}" is now the active policy`);
      loadData();
    } catch (e) {
      toast.error("Failed to set active policy");
    }
  };

  const handleDelete = async (policy) => {
    if (policy.is_active) {
      toast.error("Cannot delete the active policy. Set another as active first.");
      return;
    }
    if (!confirm(`Delete "${policy.policy_name} ${policy.version_label}"? This cannot be undone.`)) return;
    try {
      await base44.entities.ClinicPolicy.delete(policy.id);
      toast.success("Policy deleted");
      loadData();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const handleSave = async () => {
    if (!editingPolicy.policy_name?.trim()) { toast.error("Please enter a policy name"); return; }
    if (!editingPolicy.version_label?.trim()) { toast.error("Please enter a version label"); return; }
    setIsSaving(true);
    try {
      const payload = { ...editingPolicy, org_id: orgId };
      if (editingId) {
        if (editingPolicy.is_active) {
          await Promise.all(
            policies
              .filter(p => p.is_active && p.id !== editingId)
              .map(p => base44.entities.ClinicPolicy.update(p.id, { is_active: false }))
          );
        }
        await base44.entities.ClinicPolicy.update(editingId, payload);
        toast.success("Policy updated");
      } else {
        if (editingPolicy.is_active) {
          await Promise.all(
            policies
              .filter(p => p.is_active)
              .map(p => base44.entities.ClinicPolicy.update(p.id, { is_active: false }))
          );
        }
        if (policies.length === 0) payload.is_active = true;
        await base44.entities.ClinicPolicy.create(payload);
        toast.success("Policy created");
      }
      handleCancel();
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save policy");
    }
    setIsSaving(false);
  };

  const toggleItemExpand = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (showNewForm && editingPolicy) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {editingId ? "Edit Policy" : "New Policy"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border">
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Policy Name *</Label>
              <Input
                value={editingPolicy.policy_name}
                onChange={e => handleChange("policy_name", e.target.value)}
                placeholder="e.g. Standard Consent Policy"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Version *</Label>
              <Input
                value={editingPolicy.version_label}
                onChange={e => handleChange("version_label", e.target.value)}
                placeholder="e.g. v1.0, v2.1, 2025-Jan"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Effective Date</Label>
              <Input
                type="date"
                value={editingPolicy.effective_date}
                onChange={e => handleChange("effective_date", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Switch
              checked={!!editingPolicy.is_active}
              onCheckedChange={v => handleChange("is_active", v)}
            />
            <div>
              <p className="text-sm font-medium text-blue-900">Set as Active Policy</p>
              <p className="text-xs text-blue-600">This policy will be shown to new clients during onboarding. Only one policy can be active at a time.</p>
            </div>
            {editingPolicy.is_active && <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Consent Items — toggle which appear on the pre-exercise screening consent form</p>
            <div className="space-y-3">
              {CONSENT_ITEMS.map(item => (
                <div key={item.key} className={`border rounded-lg overflow-hidden ${editingPolicy[item.key] ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={!!editingPolicy[item.key]}
                        onCheckedChange={v => handleChange(item.key, v)}
                      />
                      <span className={`text-sm font-medium ${editingPolicy[item.key] ? 'text-slate-800' : 'text-slate-400'}`}>
                        {item.label}
                      </span>
                    </div>
                    {editingPolicy[item.key] && (
                      <button
                        type="button"
                        onClick={() => toggleItemExpand(item.key)}
                        className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-800"
                      >
                        {expandedItems[item.key] ? <><ChevronUp className="w-3 h-3" /> Hide text</> : <><ChevronDown className="w-3 h-3" /> Edit text</>}
                      </button>
                    )}
                  </div>
                  {editingPolicy[item.key] && expandedItems[item.key] && (
                    <div className="px-3 pb-3 border-t border-blue-100">
                      <div className="flex justify-between items-center mb-1 pt-2">
                        <span className="text-xs text-slate-500">Policy text shown to client</span>
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                          onClick={() => handleChange(item.textKey, DEFAULT_TEXTS[item.textKey])}
                        >
                          <RotateCcw className="w-3 h-3" /> Reset to default
                        </button>
                      </div>
                      <Textarea
                        value={editingPolicy[item.textKey] || ""}
                        onChange={e => handleChange(item.textKey, e.target.value)}
                        rows={3}
                        className="text-sm bg-white"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Internal Notes (optional)</Label>
            <Textarea
              value={editingPolicy.notes || ""}
              onChange={e => handleChange("notes", e.target.value)}
              rows={2}
              placeholder="e.g. Updated cancellation fee to $75 per new fee schedule"
              className="text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {isSaving ? "Saving..." : "Save Policy"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activePolicy = policies.find(p => p.is_active);
  const inactivePolicies = policies.filter(p => !p.is_active);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Clinic Policies & Consent Forms
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Create versioned policies. The active policy is shown to clients during onboarding. Each client record stores which policy version they signed.
            </p>
          </div>
          <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> New Policy Version
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {policies.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No policies yet. Create your first consent policy to get started.</p>
            <Button onClick={handleNew} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" /> Create First Policy
            </Button>
          </div>
        )}

        {activePolicy && (
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Active Policy
            </p>
            <PolicyCard
              policy={activePolicy}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onSetActive={handleSetActive}
              isActive
            />
          </div>
        )}

        {inactivePolicies.length > 0 && (
          <div>
            <Separator className="my-4" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Archive className="w-3.5 h-3.5" /> Previous Versions
            </p>
            <div className="space-y-2">
              {inactivePolicies.map(p => (
                <PolicyCard
                  key={p.id}
                  policy={p}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onSetActive={handleSetActive}
                  isActive={false}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PolicyCard({ policy, onEdit, onDuplicate, onDelete, onSetActive, isActive }) {
  const enabledItems = CONSENT_ITEMS.filter(i => policy[i.key]);

  return (
    <div className={`border rounded-lg p-4 ${isActive ? 'border-green-300 bg-green-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{policy.policy_name}</span>
            <Badge className={isActive ? 'bg-green-100 text-green-800 text-xs' : 'bg-slate-100 text-slate-600 text-xs'}>
              {policy.version_label}
            </Badge>
            {isActive && <Badge className="bg-green-500 text-white text-xs">Active</Badge>}
          </div>
          {policy.effective_date && (
            <p className="text-xs text-slate-500 mt-0.5">
              Effective: {format(new Date(policy.effective_date), "dd MMM yyyy")}
              {policy.notes && <span className="ml-2 text-slate-400">— {policy.notes}</span>}
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {enabledItems.map(i => (
              <span key={i.key} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                {i.label.replace(" Consent", "").replace(" Agreement", "").replace(" Policy", "")}
              </span>
            ))}
            {enabledItems.length === 0 && (
              <span className="text-xs text-slate-400 italic">No consent items enabled</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isActive && (
            <Button size="sm" variant="outline" onClick={() => onSetActive(policy)} className="text-xs text-green-700 border-green-300 hover:bg-green-50">
              <Star className="w-3 h-3 mr-1" /> Set Active
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEdit(policy)} className="text-xs">
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDuplicate(policy)} className="text-xs">
            <Copy className="w-3 h-3" />
          </Button>
          {!isActive && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(policy)} className="text-xs text-red-500 hover:text-red-700">
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}