import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Users, FileText, BarChart3, Stethoscope, ClipboardList,
  User as UserIcon, ExternalLink, Loader2, Calendar as CalendarIcon,
  Utensils, ShieldCheck, TicketPercent, HeartPulse
} from "lucide-react";
import { SUITE_VERSION } from "@/lib/legal/documentRegistry";
import { resolveLegalConsentAudience } from "@/lib/legal/consentAudience";
import { selectedOrganizationLegalAcceptanceStatus } from "@/lib/legal/acceptanceGate";
import { loadLegalContent } from "@/lib/legal/loadContent";
import { useAuth } from "@/lib/AuthContext";
import { isInitialClinicalReleaseEligible } from "@/lib/clinicalRelease";
import { buildTimeProfession as activeProfession } from "@/lib/profession";
import { assessSuiteHeaderLogo } from "@/brandAssets";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

const activeReleaseProfessions = new Set(activeProfession.releaseProfessions);
const assessmentAuditAvailable = import.meta.env.VITE_PROFESSION === 'exercise-physiology';

const navigationDefinitions = Object.freeze({
  Dashboard: { title: "Dashboard", icon: BarChart3 },
  Calendar: { title: "Calendar", icon: CalendarIcon },
  Clients: { title: activeProfession.lexicon.clientPluralTitleCase, icon: Users },
  PhysioEpisodes: { title: "Care Episodes", icon: HeartPulse },
  AssessmentLibrary: { title: activeProfession.lexicon.assessmentLibrary, icon: ClipboardList },
  TreatmentProtocols: { title: activeProfession.lexicon.protocolLibrary, icon: Stethoscope },
  Nutrition: { title: "Nutrition", icon: Utensils },
  Reports: { title: "Reports", icon: FileText },
  FundingForms: { title: "Funding Forms", icon: ExternalLink },
  MyProfile: { title: "Settings", icon: UserIcon },
});

const navigationItems = activeProfession.navigation.primaryPages.map((page) => {
  const definition = navigationDefinitions[page];
  if (!definition) throw new TypeError(`No navigation definition is registered for ${page}`);
  return { ...definition, page, url: createPageUrl(page) };
});
const activeAllowedPages = new Set(
  activeProfession.navigation.allowedPages.map((page) => page.toLowerCase()),
);

const usageDashboardViewerEmails = new Set([
  "mb.vidler@gmail.com",
  "brenton@primehealthclinics.com",
]);

function canViewUsageDashboard(user) {
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  return user?.role === "admin" || usageDashboardViewerEmails.has(email);
}

// The practice overview is an authenticated, separately allowlisted owner view,
// not a clinical workspace. Keep it outside clinician onboarding, subscription
// and legal-acceptance gates so an authorised business viewer can see only the
// aggregate summary without being provisioned as a treating practitioner. The
// ProtectedRoute, UsageOverview and server summary endpoint each still enforce
// authentication and the exact viewer allowlist.
const BYPASS_PATHS = ["/ProfileSetup", "/PendingApproval", "/Signup", "/Home", "/PaymentRequired", "/LegalNotices", "/AccountDeactivated", "/UsageOverview"];

function isBypassPath(pathname) {
  return BYPASS_PATHS.some(p => pathname.toLowerCase() === p.toLowerCase());
}

function isProfessionRouteDenied(pathname, currentPageName) {
  const pathPage = decodeURIComponent(String(pathname || '').split('/').filter(Boolean)[0] || '');
  // App.jsx mounts one shared Layout around every generated page route and
  // passes the configured main page as currentPageName. The URL segment is
  // therefore the authoritative requested surface; currentPageName is only a
  // root-path fallback. Preferring the latter would admit every direct route
  // whenever Dashboard is allowed.
  const requestedPage = pathPage || (
    typeof currentPageName === 'string' && currentPageName ? currentPageName : 'Home'
  );
  return !activeAllowedPages.has(requestedPage.toLowerCase());
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { appPublicSettings } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const checkProfile = async () => {
      if (isBypassPath(location.pathname)) {
        setIsLoading(false);
        return;
      }
      if (isProfessionRouteDenied(location.pathname, currentPageName)) {
        setIsLoading(false);
        return;
      }

      try {
         const user = await base44.auth.me();
         // Force refresh user data to get latest subscription status
         await base44.auth.updateMe({ _refresh: true }).catch(() => {});
         const freshUser = await base44.auth.me();
         setCurrentUser(freshUser);
        if (user) {
          base44.auth.updateMe({ last_active: new Date().toISOString() }).catch(() => {});
        }

        // Admin bypasses the onboarding/payment gate chain entirely. Checked
        // FIRST: an admin has no clinician_name and must not be routed into
        // ProfileSetup (the previous ordering did exactly that).
        if (freshUser.role === "admin") {
          setIsLoading(false);
          return;
        }

        // Payment-before-profile (Design A, 16 July 2026): resolve account
        // status and subscription BEFORE requiring the full professional
        // profile, so a newly-registered user is sent to checkout first rather
        // than made to complete a long profile-and-consent form before they can
        // pay (the friction that lost a real prospect on 14 July).
        // - deactivated -> the dedicated AccountDeactivated notice.
        // - suspended/rejected -> PendingApproval (per-status messaging;
        //   suspended users can complete payment to reactivate).
        // - any other non-active (pending/invited) -> PaymentRequired: payment
        //   activates the account (checkout auto-approve in stripeWebhook).
        // The server independently refuses clinical access for any non-active
        // status — this routing is UX, not the enforcement point.
        const status = freshUser.account_status;
        if (status === "deactivated") {
          navigate("/AccountDeactivated");
          return;
        }
        if (status === "suspended" || status === "rejected") {
          navigate("/PendingApproval");
          return;
        }
        if (status !== "active") {
          navigate("/PaymentRequired");
          return;
        }
        if (!freshUser.subscription_status || freshUser.subscription_status !== "active") {
          navigate("/PaymentRequired");
          return;
        }

        // Active + subscribed: NOW require the professional profile (first-run
        // setup), then the mandatory legal notices below, before the app proper.
        if (!freshUser.clinician_name) {
          navigate("/ProfileSetup");
          return;
        }
        if (!isInitialClinicalReleaseEligible(freshUser, activeReleaseProfessions)) {
          navigate("/ProfileSetup?reason=clinical-profile");
          return;
        }

        // Mirror the authoritative server gate for the user's default practice.
        // Exact IDs, event types, titles, suite version and current content
        // fingerprints must match. Other memberships are checked independently
        // at the point the user selects them (and again by the server), so a
        // stale secondary membership does not block unrelated app entry.
        let events = [];
        let memberships = [];
        let legalAudience = null;
        try {
          memberships = await base44.entities.OrganizationMember.filter({
            user_email: freshUser.email,
          });
          legalAudience = resolveLegalConsentAudience(memberships);
          if (!legalAudience.orgId) {
            navigate("/ProfileSetup");
            return;
          }
          events = await base44.entities.LegalAcceptanceEvent.filter({
            user_email: freshUser.email,
            suite_version: SUITE_VERSION,
            org_id: legalAudience.orgId,
          });
          if (!events) events = [];
        } catch {
          if (legalAudience?.orgId) {
            navigate(`/LegalNotices?org_id=${encodeURIComponent(legalAudience.orgId)}`);
          } else {
            navigate("/ProfileSetup");
          }
          return;
        }

        const legalStatus = selectedOrganizationLegalAcceptanceStatus({
          events,
          memberships,
          orgId: legalAudience.orgId,
          legalSettings: appPublicSettings?.public_settings?.legal,
          readContent: loadLegalContent,
        });
        if (!legalStatus.accepted) {
          navigate(`/LegalNotices?org_id=${encodeURIComponent(legalAudience.orgId)}`);
          return;
        }

        setIsLoading(false);

      } catch (error) {
        console.error("Auth check error:", error);
        setIsLoading(false);
      }
    };
    checkProfile();
  }, [location.pathname, currentPageName, navigate, appPublicSettings]);

  const isClientView = searchParams.get("client") === "true";

  if (isBypassPath(location.pathname)) return <>{children}</>;
  if (isProfessionRouteDenied(location.pathname, currentPageName)) {
    return <Navigate to={createPageUrl("Dashboard")} replace />;
  }
  if (isClientView) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --primary: 203 89% 53%;
          --primary-foreground: 0 0% 98%;
          --secondary: 210 40% 95%;
          --secondary-foreground: 222.2 84% 4.9%;
          --accent: 210 40% 90%;
          --accent-foreground: 222.2 84% 4.9%;
        }
        .sidebar-scrollable::-webkit-scrollbar { display: none; }
        .sidebar-scrollable { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div className="flex w-full min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
        <Sidebar className="bg-[#E5E5E5] sidebar-scrollable">
          <SidebarHeader className="px-6 py-0">
            <div className="flex items-center justify-center -my-8">
              <img
                src={assessSuiteHeaderLogo}
                alt={`${activeProfession.productName} Logo`}
                className="h-auto w-full max-w-[180px]"
              />
            </div>
          </SidebarHeader>
          <SidebarContent className="p-4 sidebar-scrollable">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-xl py-3 px-4 ${
                          location.pathname === item.url
                            ? "bg-blue-50 text-blue-700 border border-blue-200/50 shadow-sm"
                            : "text-slate-600"
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {canViewUsageDashboard(currentUser) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-xl py-3 px-4 ${location.pathname === createPageUrl("UsageOverview") ? "bg-blue-50 text-blue-700 border border-blue-200/50 shadow-sm" : "text-slate-600"}`}>
                        <Link to={createPageUrl("UsageOverview")} className="flex items-center gap-3">
                          <BarChart3 className="w-5 h-5" />
                          <span className="font-medium">Practice overview</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {currentUser?.role === "admin" && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-xl py-3 px-4 ${location.pathname === createPageUrl("AdminPromotions") ? "bg-purple-50 text-purple-700 border border-purple-200/50 shadow-sm" : "text-slate-600"}`}>
                          <Link to={createPageUrl("AdminPromotions")} className="flex items-center gap-3">
                            <TicketPercent className="w-5 h-5" />
                            <span className="font-medium">Promotion Codes</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-xl py-3 px-4 ${location.pathname === createPageUrl("AdminApprovals") ? "bg-purple-50 text-purple-700 border border-purple-200/50 shadow-sm" : "text-slate-600"}`}>
                          <Link to={createPageUrl("AdminApprovals")} className="flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="font-medium">Admin Settings</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {assessmentAuditAvailable && activeAllowedPages.has("assessmentaudit") && (
                        <SidebarMenuItem>
                          <SidebarMenuButton asChild className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-xl py-3 px-4 ${location.pathname === createPageUrl("AssessmentAudit") ? "bg-purple-50 text-purple-700 border border-purple-200/50 shadow-sm" : "text-slate-600"}`}>
                            <Link to={createPageUrl("AssessmentAudit")} className="flex items-center gap-3">
                              <ClipboardList className="w-5 h-5" />
                              <span className="font-medium">Assessment Audit</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-xl py-3 px-4 ${location.pathname === createPageUrl("AdminAnalytics") ? "bg-purple-50 text-purple-700 border border-purple-200/50 shadow-sm" : "text-slate-600"}`}>
                          <Link to={createPageUrl("AdminAnalytics")} className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5" />
                            <span className="font-medium">Analytics</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/60 backdrop-blur-sm border-b border-slate-200/60 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-slate-900">{activeProfession.shortName}</h1>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
