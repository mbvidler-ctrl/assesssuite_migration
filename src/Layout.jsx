import React, { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Users, FileText, BarChart3, Stethoscope, ClipboardList,
  User as UserIcon, ExternalLink, Loader2, Calendar as CalendarIcon,
  Utensils, ShieldCheck
} from "lucide-react";
import { SUITE_VERSION } from "@/lib/legal/documentRegistry";
import { resolveLegalConsentAudience } from "@/lib/legal/consentAudience";
import { hasCurrentLegalAcceptance } from "@/lib/legal/acceptanceGate";
import { loadLegalContent } from "@/lib/legal/loadContent";
import { useAuth } from "@/lib/AuthContext";
import { isInitialClinicalReleaseEligible } from "@/lib/clinicalRelease";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: BarChart3 },
  { title: "Calendar", url: createPageUrl("Calendar"), icon: CalendarIcon },
  { title: "Clients", url: createPageUrl("Clients"), icon: Users },
  { title: "Assessment Library", url: createPageUrl("AssessmentLibrary"), icon: ClipboardList },
  { title: "Treatment Protocols", url: createPageUrl("TreatmentProtocols"), icon: Stethoscope },
  { title: "Nutrition", url: createPageUrl("Nutrition"), icon: Utensils },
  { title: "Reports", url: createPageUrl("Reports"), icon: FileText },
  { title: "Funding Forms", url: createPageUrl("FundingForms"), icon: ExternalLink },
  { title: "Settings", url: createPageUrl("MyProfile"), icon: UserIcon },
];

const BYPASS_PATHS = ["/ProfileSetup", "/PendingApproval", "/Signup", "/Home", "/PaymentRequired", "/LegalNotices", "/AccountDeactivated"];

function isBypassPath(pathname) {
  return BYPASS_PATHS.some(p => pathname.toLowerCase() === p.toLowerCase());
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
        if (!isInitialClinicalReleaseEligible(freshUser)) {
          navigate("/ProfileSetup?reason=clinical-profile");
          return;
        }

        // Mirror the authoritative server gate exactly: every practitioner
        // needs the three current document-bound notice receipts, while an
        // owner also needs the five current contract-bundle receipts. IDs,
        // event types, titles, suite version and fingerprints must all match
        // the content presented for the live legal settings. Stale, partial
        // or forged-looking rows route to LegalNotices so the server-derived
        // atomic bundle can be recorded again before any clinical request.
        let events = [];
        let legalAudience = null;
        try {
          const memberships = await base44.entities.OrganizationMember.filter({
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

        const hasAllRequiredNotices = hasCurrentLegalAcceptance({
          events,
          orgId: legalAudience.orgId,
          ownerBundle: legalAudience.ownerBundle,
          legalSettings: appPublicSettings?.public_settings?.legal,
          readContent: loadLegalContent,
        });
        if (!hasAllRequiredNotices) {
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
  }, [location.pathname, navigate, appPublicSettings]);

  const isClientView = searchParams.get("client") === "true";

  if (isBypassPath(location.pathname)) return <>{children}</>;
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
                src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/4c24cafdd_Logo-Transparent1.png"
                alt="AssessSuite Clinical Logo"
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
                  {currentUser?.role === "admin" && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-xl py-3 px-4 ${location.pathname === createPageUrl("AdminApprovals") ? "bg-purple-50 text-purple-700 border border-purple-200/50 shadow-sm" : "text-slate-600"}`}>
                          <Link to={createPageUrl("AdminApprovals")} className="flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="font-medium">Admin Settings</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-xl py-3 px-4 ${location.pathname === createPageUrl("AssessmentAudit") ? "bg-purple-50 text-purple-700 border border-purple-200/50 shadow-sm" : "text-slate-600"}`}>
                          <Link to={createPageUrl("AssessmentAudit")} className="flex items-center gap-3">
                            <ClipboardList className="w-5 h-5" />
                            <span className="font-medium">Assessment Audit</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
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
              <h1 className="text-xl font-bold text-slate-900">AssessSuite</h1>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
