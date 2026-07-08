import React, { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Users, FileText, BarChart3, Stethoscope, ClipboardList,
  User as UserIcon, ExternalLink, Loader2, Calendar as CalendarIcon,
  Utensils, ShieldCheck
} from "lucide-react";
import LegalAcceptanceModal from "@/components/legal/LegalAcceptanceModal";
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

const BYPASS_PATHS = ["/ProfileSetup", "/PendingApproval", "/Signup", "/Home", "/PaymentRequired"];

function isBypassPath(pathname) {
  return BYPASS_PATHS.some(p => pathname.toLowerCase() === p.toLowerCase());
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLegalModal, setShowLegalModal] = useState(false);

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

        if (!user.clinician_name) {
          navigate("/ProfileSetup");
          return;
        }

        if (user.account_status === "suspended") {
          navigate("/PendingApproval");
          return;
        }

        if (freshUser.role === "admin") {
          setIsLoading(false);
          return;
        }

        // Hard approval gate: any non-admin account that is not approved
        // (pending, rejected, invited, or missing status) is held at the
        // approval page. Approval is granted by an administrator via
        // AdminApprovals; the server refuses self-service status changes.
        if (freshUser.account_status !== "active") {
          navigate("/PendingApproval");
          return;
        }

        if (!freshUser.subscription_status || freshUser.subscription_status !== "active") {
           navigate("/PaymentRequired");
           return;
         }

        let acceptances = [];
        try {
          acceptances = await base44.entities.LegalAcceptance.filter({
            user_email: user.email,
            document_set_version: "2.0.0"
          });
          if (!acceptances) acceptances = [];
        } catch (e) {
          acceptances = [];
        }

        const hasAccepted = acceptances.length > 0 && acceptances[0].accepted;
        if (!hasAccepted) {
          setShowLegalModal(true);
          setIsLoading(false);
          return;
        }

        setIsLoading(false);

      } catch (error) {
        console.error("Auth check error:", error);
        setIsLoading(false);
      }
    };
    checkProfile();
  }, [location.pathname, navigate]);

  const isClientView = searchParams.get("client") === "true";

  if (isBypassPath(location.pathname)) return <>{children}</>;
  if (isClientView) return <>{children}</>;

  const handleLegalAccept = () => {
    setShowLegalModal(false);
    if (!currentUser?.clinician_name) navigate("/ProfileSetup");
  };

  if (showLegalModal && currentUser) {
    return (
      <>
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-600">Loading legal documents...</p>
          </div>
        </div>
        <LegalAcceptanceModal isOpen={showLegalModal} onAccept={handleLegalAccept} user={currentUser} />
      </>
    );
  }

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
              <h1 className="text-xl font-bold text-slate-900">Allied Assess</h1>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}