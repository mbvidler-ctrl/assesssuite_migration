import './App.css'
import { useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation, useParams, Navigate, Outlet } from 'react-router-dom';
import { wrapReactRouterRouting } from '@sentry/react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AcceptInvitation from '@/pages/AcceptInvitation';
import ProtectedRoute from '@/components/ProtectedRoute';
// Paywall.jsx (simulated checkout for the demo) is retired for launch — the
// route redirects to the real PaymentRequired flow; the file stays on disk.
import CreateAccount from '@/pages/CreateAccount';
import AccountSetup from '@/pages/AccountSetup';
import SignIn from '@/pages/SignIn';
import PaymentRequired from './pages/PaymentRequired';
import TestingBypass from '@/pages/TestingBypass';
import LegalNotices from '@/pages/LegalNotices';
import AccountDeactivated from '@/pages/AccountDeactivated';
import PhysioPublicLanding from '@/pages/PhysioPublicLanding';
import { buildTimeProfession } from '@/lib/profession';
import { PersistentTranscriptionProvider } from '@/lib/transcription/PersistentTranscriptionContext';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;
const MARKETING_ORIGIN = (import.meta.env.VITE_MARKETING_ORIGIN || 'https://assesssuite.com').replace(/\/$/, '');
const TelemetryRoutes = wrapReactRouterRouting(Routes);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const MarketingLegalRedirect = () => {
  const { slug = '' } = useParams();

  useEffect(() => {
    window.location.replace(`${MARKETING_ORIGIN}/legal/${encodeURIComponent(slug)}`);
  }, [slug]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50" role="status">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      <span className="sr-only">Opening the public legal notice</span>
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const location = useLocation();
  const isRootPath = location.pathname === '/';

  // The public marketing surface is deployed separately. The Fly-hosted
  // platform root now enters the authenticated application only.
  if (isRootPath) {
    if (isLoadingPublicSettings || isLoadingAuth) {
      return (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      );
    }
    if (isAuthenticated) return <Navigate to={`/${mainPageKey}`} replace />;
    if (buildTimeProfession.id === 'physio') return <PhysioPublicLanding />;
    return <Navigate to="/login" replace />;
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app with layout
  return (
    <TelemetryRoutes>
      {/* Landing.jsx carries a pre-suite (24 May 2026) embedded Terms modal that
          contradicts the approved legal suite — retired from the live surface by
          redirect to root, not deleted. The file stays on disk. */}
      <Route path="/Landing" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Login />} />
      {/* Dev-only: hardcodes seeded demo credentials. Excluded from production
          builds; the underlying control is that those accounts do not exist in
          the production database (catalogue-only seed + strong admin secret). */}
      {import.meta.env.DEV && <Route path="/testing-bypass" element={<TestingBypass />} />}
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/Paywall" element={<Navigate to="/PaymentRequired" replace />} />
      <Route path="/PaymentRequired" element={<PaymentRequired />} />
      {/* Preserve billing-portal sessions created before the migrated route
          was corrected from the retired /Settings path. */}
      <Route path="/Settings" element={<Navigate to="/MyProfile" replace />} />
      <Route path="/legal/:slug" element={<MarketingLegalRedirect />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/CreateAccount" element={<CreateAccount />} />
        <Route path="/AccountSetup" element={<AccountSetup />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/LegalNotices" element={<LegalNotices />} />
        <Route path="/AccountDeactivated" element={<AccountDeactivated />} />
        <Route element={<LayoutWrapper currentPageName={mainPageKey}><Outlet /></LayoutWrapper>}>
          {Object.entries(Pages).map(([path, Page]) => (
            <Route key={path} path={`/${path}`} element={<Page />} />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </TelemetryRoutes>
  );
};




function App() {

  return (
    <AuthProvider>
      <PersistentTranscriptionProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <TelemetryRoutes>
            {/* Signup.jsx is an incomplete duplicate of the OTP-based Register.jsx
                flow (no OTP, dead legal-link stubs) — retired as a live entry
                point, not deleted. See docs/qa/ session note. */}
            <Route path="/signup" element={<Navigate to="/register" replace />} />
            <Route path="*" element={<AuthenticatedApp />} />
            </TelemetryRoutes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </PersistentTranscriptionProvider>
    </AuthProvider>
  )
}

export default App
