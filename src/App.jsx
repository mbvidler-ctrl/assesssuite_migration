import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LandingLive from '@/pages/LandingLive';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ProtectedRoute from '@/components/ProtectedRoute';
// Paywall.jsx (simulated checkout for the demo) is retired for launch — the
// route redirects to the real PaymentRequired flow; the file stays on disk.
import CreateAccount from '@/pages/CreateAccount';
import AccountSetup from '@/pages/AccountSetup';
import SignIn from '@/pages/SignIn';
import PaymentRequired from './pages/PaymentRequired';
import TestingBypass from '@/pages/TestingBypass';
import LegalDocument from '@/pages/LegalDocument';
import LegalNotices from '@/pages/LegalNotices';
import AccountDeactivated from '@/pages/AccountDeactivated';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const location = useLocation();
  const isRootPath = location.pathname === '/';

  // Always show landing page at root without any auth checks
  if (isRootPath) {
    return <LandingLive />;
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
    <Routes>
      <Route path="/" element={<LandingLive />} />
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
      <Route path="/Paywall" element={<Navigate to="/PaymentRequired" replace />} />
      <Route path="/PaymentRequired" element={<PaymentRequired />} />
      <Route path="/legal/:slug" element={<LegalDocument />} />
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
    </Routes>
  );
};




function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <Routes>
            {/* Signup.jsx is an incomplete duplicate of the OTP-based Register.jsx
                flow (no OTP, dead legal-link stubs) — retired as a live entry
                point, not deleted. See docs/qa/ session note. */}
            <Route path="/signup" element={<Navigate to="/register" replace />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App