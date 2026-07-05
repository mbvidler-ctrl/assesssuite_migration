import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, X, Book, Activity, Heart, Brain, Users, Baby,
  Clock, Stethoscope, ChevronRight, Play, Plus, Moon,
  Zap, Wind, Check, CheckCheck
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AssessmentModal from "./AssessmentModal";

const CATEGORIES = [
  { value: "all",               label: "All",               icon: Book },
  { value: "musculoskeletal",   label: "Musculoskeletal",   icon: Activity },
  { value: "neurological",      label: "Neurological",      icon: Brain },
  { value: "cardio_pulmonary",  label: "Cardio",            icon: Heart },
  { value: "cardiovascular",    label: "Cardiovascular",    icon: Heart },
  { value: "cardiorespiratory", label: "Cardiorespiratory", icon: Wind },
  { value: "metabolic",         label: "Metabolic",         icon: Stethoscope },
  { value: "mental_health",     label: "Mental Health",     icon: Users },
  { value: "chronic_pain",      label: "Chronic Pain",      icon: Zap },
  { value: "pediatric",         label: "Pediatric",         icon: Baby },
  { value: "geriatric",         label: "Geriatric",         icon: Clock },
  { value: "gait",              label: "Gait",              icon: Activity },
  { value: "balance",           label: "Balance",           icon: Activity },
  { value: "general",           label: "General",           icon: Book },
  { value: "sleep",             label: "Sleep",             icon: Moon },
  { value: "urology",           label: "Urology",           icon: Stethoscope },
  { value: "quality_of_life",   label: "Quality of Life",   icon: Users },
];

const CAT_COLORS = {
  musculoskeletal:   "bg-blue-100 text-blue-800",
  neurological:      "bg-purple-100 text-purple-800",
  cardio_pulmonary:  "bg-red-100 text-red-800",
  cardiovascular:    "bg-red-100 text-red-800",
  cardiorespiratory: "bg-red-100 text-red-800",
  metabolic:         "bg-green-100 text-green-800",
  mental_health:     "bg-yellow-100 text-yellow-800",
  chronic_pain:      "bg-orange-100 text-orange-800",
  pediatric:         "bg-pink-100 text-pink-800",
  geriatric:         "bg-orange-100 text-orange-800",
  gait:              "bg-teal-100 text-teal-800",
  balance:           "bg-cyan-100 text-cyan-800",
  general:           "bg-gray-100 text-gray-800",
  sleep:             "bg-indigo-100 text-indigo-800",
  urology:           "bg-sky-100 text-sky-800",
  quality_of_life:   "bg-emerald-100 text-emerald-800",
};

function formatCat(cat) {
  if (!cat) return "General";
  return cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export default function AssessmentLibraryModal({ onClose, onSelectAssessment, clientId, client }) {
  const [assessments, setAssessments]               = useState([]);
  const [filtered, setFiltered]                     = useState([]);
  const [searchTerm, setSearchTerm]                 = useState("");
  const [selectedCategory, setSelectedCategory]     = useState("all");
  const [isLoading, setIsLoading]                   = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [added, setAdded]                           = useState(new Set());

  useEffect(() => { loadAssessments(); }, []);
  useEffect(() => { applyFilter(); }, [assessments, searchTerm, selectedCategory]);

  const loadAssessments = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.Assessment.list();
      const active = data.filter(a => !a.is_deleted && !a.name?.toLowerCase().includes('ymca'));
      const map = new Map();
      active.forEach(a => {
        const key = a.name?.toLowerCase().trim();
        if (!key) return;
        if (!map.has(key)) { map.set(key, a); return; }
        const score = r => [r.instructions, r.normative_data, r.references, r.description].filter(Boolean).length;
        if (score(a) > score(map.get(key))) map.set(key, a);
      });
      const deduped = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      setAssessments(deduped);
    } catch (e) {
      console.error("Error loading assessments:", e);
    }
    setIsLoading(false);
  };

  const applyFilter = () => {
    let list = [...assessments];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q) ||
        a.search_tags?.some?.(t => t.toLowerCase().includes(q))
      );
    }
    if (selectedCategory !== "all") {
      list = list.filter(a => a.category === selectedCategory);
    }
    setFiltered(list);
  };

  const handleAdd = (assessment) => {
    if (added.has(assessment.id)) return;
    setAdded(prev => new Set([...prev, assessment.id]));
    onSelectAssessment(assessment);
  };

  const counts = CATEGORIES.reduce((acc, c) => {
    acc[c.value] = c.value === "all"
      ? assessments.length
      : assessments.filter(a => a.category === c.value).length;
    return acc;
  }, {});

  const visibleCategories = CATEGORIES.filter(c => c.value === "all" || counts[c.value] > 0);

  return (
    <>
      {/* Library modal */}
      <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
        <div className="relative w-full max-w-6xl h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Assessment Library</h2>
              {client && (
                <p className="text-sm text-slate-500 mt-0.5">
                  Adding assessments to <span className="font-medium text-slate-700">{client.full_name}</span>
                  {added.size > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-semibold">
                      <Check className="w-3.5 h-3.5" /> {added.size} added
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {added.size > 0 && (
                <Button onClick={onClose} className="bg-green-600 hover:bg-green-700 text-white gap-2 h-9" size="sm">
                  <CheckCheck className="w-4 h-4" /> Done ({added.size} added)
                </Button>
              )}
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">

            {/* Sidebar */}
            <aside className="w-52 shrink-0 border-r border-slate-100 bg-slate-50 overflow-y-auto py-3">
              {visibleCategories.map(cat => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left
                      ${active
                        ? "bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600"
                        : "text-slate-600 hover:bg-white hover:text-slate-900"}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{cat.label}</span>
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium
                      ${active ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}>
                      {counts[cat.value]}
                    </span>
                  </button>
                );
              })}
            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col min-w-0">

              {/* Search */}
              <div className="px-5 py-3 border-b border-slate-100 bg-white shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, description, category…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                    autoFocus
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {isLoading ? "Loading…" : `${filtered.length} assessment${filtered.length !== 1 ? "s" : ""}`}
                </p>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {isLoading ? (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Book className="w-10 h-10 mb-3" />
                    <p className="font-medium">No assessments found</p>
                    <p className="text-sm mt-1">
                      {searchTerm ? `No results for "${searchTerm}"` : "No assessments in this category"}
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map(assessment => (
                      <AssessmentListCard
                        key={assessment.id}
                        assessment={assessment}
                        isAdded={added.has(assessment.id)}
                        onView={() => setSelectedAssessment(assessment)}
                        onAdd={() => handleAdd(assessment)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AssessmentModal rendered via portal so it's never clipped by the library modal's stacking context */}
      {selectedAssessment && createPortal(
        <AssessmentModal
          assessment={selectedAssessment}
          onClose={() => setSelectedAssessment(null)}
          onAddToClient={(a) => { handleAdd(a); setSelectedAssessment(null); }}
          clientId={clientId}
        />,
        document.body
      )}
    </>
  );
}

function AssessmentListCard({ assessment, isAdded, onView, onAdd }) {
  const catColor = CAT_COLORS[assessment.category] || CAT_COLORS.general;

  return (
    <div className={`border rounded-xl p-4 bg-white transition-all group flex flex-col gap-2
      ${isAdded
        ? "border-green-300 bg-green-50/40"
        : "border-slate-200 hover:border-blue-300 hover:shadow-md"}`}
    >
      <div>
        <h3 className={`font-semibold text-sm leading-snug line-clamp-2 transition-colors
          ${isAdded ? "text-green-700" : "text-slate-900 group-hover:text-blue-700"}`}>
          {assessment.name}
        </h3>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
            {formatCat(assessment.category)}
          </span>
          {assessment.unit_of_measure && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {assessment.unit_of_measure}
            </span>
          )}
        </div>
      </div>

      {assessment.description && (
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {assessment.description}
        </p>
      )}

      <div className="flex gap-1 flex-wrap">
        {assessment.has_test_runner && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium flex items-center gap-1">
            <Play className="w-2.5 h-2.5" /> Runner
          </span>
        )}
        {assessment.has_normatives && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
            Normatives
          </span>
        )}
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={onView}>
          <ChevronRight className="w-3 h-3 mr-1" /> View Details
        </Button>
        {isAdded ? (
          <Button size="sm" className="flex-1 text-xs h-8 bg-green-500 hover:bg-green-500 text-white cursor-default" disabled>
            <Check className="w-3 h-3 mr-1" /> Added
          </Button>
        ) : (
          <Button size="sm" className="flex-1 text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={onAdd}>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        )}
      </div>
    </div>
  );
}