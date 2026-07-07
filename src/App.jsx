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
import Paywall from '@/pages/Paywall';
import CreateAccount from '@/pages/CreateAccount';
import AccountSetup from '@/pages/AccountSetup';
import SignIn from '@/pages/SignIn';
import Signup from '@/pages/Signup';
import PaymentRequired from './pages/PaymentRequired';
import TestingBypass from '@/pages/TestingBypass';

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
      <Route path="/Landing" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/testing-bypass" element={<TestingBypass />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/Paywall" element={<Paywall />} />
      <Route path="/PaymentRequired" element={<PaymentRequired />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/CreateAccount" element={<CreateAccount />} />
        <Route path="/AccountSetup" element={<AccountSetup />} />
        <Route path="/signin" element={<SignIn />} />
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
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App