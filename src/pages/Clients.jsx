import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toaster, toast } from "sonner";
import {
  Search,
  Plus,
  Users,
  Upload,
  Trash2,
  Clock,
  ChevronRight,
  User,
} from "lucide-react";
import ReferralUploader from "@/components/documents/ReferralUploader";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { differenceInYears } from "date-fns";

const RECENT_KEY = "allied_assess_recent_clients";
const MAX_RECENT = 6;

function getRecentClientIds() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
}

function addRecentClientId(id) {
  try {
    const ids = getRecentClientIds().filter(x => x !== id);
    ids.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {}
}

function getAge(dob) {
  if (!dob) return null;
  return differenceInYears(new Date(), new Date(dob));
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

const AVATAR_COLOURS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];
function avatarColour(name) {
  if (!name) return AVATAR_COLOURS[0];
  return AVATAR_COLOURS[name.charCodeAt(0) % AVATAR_COLOURS.length];
}

function ClientRow({ client, onDelete, onNavigate }) {
  const age = getAge(client.date_of_birth);
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer group transition-colors"
      onClick={() => onNavigate(client)}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColour(client.full_name)}`}>
        {getInitials(client.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{client.full_name}</div>
        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
          {age !== null && <span>{age} yrs</span>}
          {client.email && <span className="truncate">{client.email}</span>}
          {!client.email && client.phone && <span>{client.phone}</span>}
        </div>
      </div>
      <div className="hidden md:block text-sm text-slate-500 w-36 flex-shrink-0 truncate">
        {client.phone || "—"}
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete(client); }}
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
    </div>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [showReferralUploader, setShowReferralUploader] = useState(false);
  const [allAssessments, setAllAssessments] = useState([]);
  const [userOrgId, setUserOrgId] = useState(null);
  const [recentIds, setRecentIds] = useState(getRecentClientIds);

  useEffect(() => { fetchCurrentUserOrg(); }, []);
  useEffect(() => { if (userOrgId) loadClients(); }, [userOrgId]);

  const fetchCurrentUserOrg = async () => {
    try {
      const currentUser = await base44.auth.me();
      const memberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
      if (memberships.length > 0) {
        const primary = memberships.find(m => m.is_primary) || memberships[0];
        setUserOrgId(primary.org_id);
      } else {
        setUserOrgId(null);
        toast.error("No organisation found for your account.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load organisation.");
    }
  };

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      const [data, assessments] = await Promise.all([
        base44.entities.Client.filter({ 
          org_id: userOrgId,
          assigned_clinician_email: currentUser.email 
        }),
        base44.entities.Assessment.list(),
      ]);
      setClients(data || []);
      setAllAssessments(assessments || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load clients.");
    }
    setIsLoading(false);
  };

  const handleNavigate = (client) => {
    addRecentClientId(client.id);
    setRecentIds(getRecentClientIds());
    window.location.href = createPageUrl(`ClientProfile?id=${client.id}`);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      await base44.entities.Client.delete(clientToDelete.id);
      toast.success(`"${clientToDelete.full_name}" deleted.`);
      setClientToDelete(null);
      loadClients();
    } catch (e) {
      toast.error("Failed to delete client.");
    }
  };

  const filteredClients = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    let list = [...clients];
    if (q) {
      list = list.filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      );
    }
    return list.sort((a, b) => a.full_name?.localeCompare(b.full_name));
  }, [clients, searchTerm]);

  const recentlyVisited = useMemo(() => {
    if (searchTerm) return [];
    return recentIds.map(id => clients.find(c => c.id === id)).filter(Boolean).slice(0, 6);
  }, [recentIds, clients, searchTerm]);

  const recentlyOnboarded = useMemo(() => {
    if (searchTerm) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return [...clients]
      .filter(c => c.created_date && new Date(c.created_date) >= cutoff)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 6);
  }, [clients, searchTerm]);

  const grouped = useMemo(() => {
    const map = {};
    filteredClients.forEach(c => {
      const letter = (c.full_name?.[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredClients]);

  return (
    <>
      <Toaster richColors position="top-center" />
      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-bold">{clientToDelete?.full_name}</span> and all associated data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Client Library</h1>
                <p className="text-slate-500 text-sm">{clients.length} clients</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowReferralUploader(!showReferralUploader)}
                className={showReferralUploader ? "bg-blue-50 border-blue-300" : ""}
              >
                <Upload className="w-4 h-4 mr-2" />Upload Referral
              </Button>
              <Link to={createPageUrl("Onboarding")}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />New Client
                </Button>
              </Link>
            </div>
          </div>

          {showReferralUploader && (
            <ReferralUploader
              existingClients={clients}
              allAssessments={allAssessments}
              onClientCreated={(c) => { setShowReferralUploader(false); window.location.href = createPageUrl(`ClientProfile?id=${c.id}`); }}
              onClientUpdated={(c) => { setShowReferralUploader(false); window.location.href = createPageUrl(`ClientProfile?id=${c.id}`); }}
            />
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search by name, email or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white h-11 text-sm shadow-sm"
              autoFocus
            />
            {searchTerm && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                onClick={() => setSearchTerm("")}
              >
                Clear
              </button>
            )}
          </div>

          {!isLoading && (recentlyOnboarded.length > 0 || recentlyVisited.length > 0) && (
            <div className="space-y-4">
              {recentlyOnboarded.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Recently Onboarded</span>
                    <span className="text-xs text-slate-400">— last 30 days</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {recentlyOnboarded.map(client => {
                      const daysAgo = Math.floor((Date.now() - new Date(client.created_date)) / 86400000);
                      return (
                        <button
                          key={client.id}
                          onClick={() => handleNavigate(client)}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-green-100 hover:border-green-300 hover:bg-green-50/40 transition-all text-center shadow-sm group"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${avatarColour(client.full_name)}`}>
                            {getInitials(client.full_name)}
                          </div>
                          <span className="text-xs font-medium text-slate-700 leading-tight group-hover:text-green-700 w-full truncate">
                            {client.full_name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {recentlyVisited.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Recently Visited</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {recentlyVisited.map(client => (
                      <button
                        key={client.id}
                        onClick={() => handleNavigate(client)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all text-center shadow-sm group"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${avatarColour(client.full_name)}`}>
                          {getInitials(client.full_name)}
                        </div>
                        <span className="text-xs font-medium text-slate-700 leading-tight group-hover:text-blue-700 w-full truncate">
                          {client.full_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 bg-slate-50">
              <div className="w-9 flex-shrink-0" />
              <div className="flex-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Client</div>
              <div className="hidden md:block text-xs font-semibold uppercase tracking-widest text-slate-400 w-36 flex-shrink-0">Phone</div>
              <div className="w-10 flex-shrink-0" />
              <div className="w-4 flex-shrink-0" />
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-slate-200 rounded w-40 animate-pulse" />
                      <div className="h-3 bg-slate-100 rounded w-56 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">{searchTerm ? `No clients match "${searchTerm}"` : "No clients yet"}</p>
                {!searchTerm && (
                  <Link to={createPageUrl("Onboarding")}>
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" /> Add First Client
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              grouped.map(([letter, letterClients]) => (
                <div key={letter}>
                  <div className="px-4 py-1 bg-slate-50 border-y border-slate-100 sticky top-0 z-10">
                    <span className="text-xs font-bold text-slate-400 tracking-widest">{letter}</span>
                  </div>
                  {letterClients.map((client, idx) => (
                    <div key={client.id} className={idx < letterClients.length - 1 ? "border-b border-slate-50" : ""}>
                      <ClientRow client={client} onDelete={setClientToDelete} onNavigate={handleNavigate} />
                    </div>
                  ))}
                </div>
              ))
            )}
          </Card>

          {!isLoading && filteredClients.length > 0 && (
            <p className="text-center text-xs text-slate-400">{filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>
    </>
  );
}