import React, { createContext, useState, useContext, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { mergeCapabilityOverrides, readCapabilities } from '@/lib/aiCapabilities';

const AuthContext = createContext();

// Hoisted so both checkAppState() and the capability-only refreshPublicSettings()
// share one request shape. Behaviour must stay byte-identical to the inline
// call this replaced.
async function fetchPublicSettings() {
  const appClient = createAxiosClient({
    baseURL: `${appParams.serverUrl}/api/apps/public`,
    headers: {
      'X-App-Id': appParams.appId
    },
    token: appParams.token, // Include token if available
    interceptResponses: true
  });
  return appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }
  const [capabilityOverrides, setCapabilityOverrides] = useState({});
  const [publicSettingsFetchedAt, setPublicSettingsFetchedAt] = useState(null);
  const lastRefreshAttemptRef = useRef(0);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      try {
        const publicSettings = await fetchPublicSettings();
        setAppPublicSettings(publicSettings);
        setPublicSettingsFetchedAt(Date.now());
        setCapabilityOverrides({});

        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  // Capability re-check ONLY. It must never touch isLoadingPublicSettings —
  // src/App.jsx:48 gates the entire SPA on that flag, so reusing
  // checkAppState() here would blank the app to a loading screen and re-run
  // auth mid-consult. It must never clear appPublicSettings on failure: a
  // transport blip is not a capability withdrawal.
  const refreshPublicSettings = async ({ force = false } = {}) => {
    if (!force && Date.now() - lastRefreshAttemptRef.current < 60_000) return;
    lastRefreshAttemptRef.current = Date.now();
    try {
      const publicSettings = await fetchPublicSettings();
      setAppPublicSettings(publicSettings);
      setCapabilityOverrides({});
      setPublicSettingsFetchedAt(Date.now());
    } catch {
      // Keep last known state; never surface a settings-refresh error to a clinician.
    }
  };

  // Records a runtime capability withdrawal learned from a 503 mid-session,
  // then forces an immediate re-check so the published state catches up.
  const noteCapabilityWithdrawn = (key, reason) => {
    setCapabilityOverrides((prev) => ({ ...prev, [key]: reason }));
    refreshPublicSettings({ force: true });
  };

  // The bound on staleness is already (a) next focus/tab re-show or (b)
  // exactly one failed click, whichever comes first — no polling timer and
  // no setTimeout are needed and neither would add a useful guarantee here.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === undefined || document.visibilityState === 'visible') {
        refreshPublicSettings();
      }
    };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, []);

  const capabilities = useMemo(
    () => mergeCapabilityOverrides(readCapabilities(appPublicSettings), capabilityOverrides),
    [appPublicSettings, capabilityOverrides],
  );

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      capabilities,
      publicSettingsFetchedAt,
      logout,
      navigateToLogin,
      checkAppState,
      refreshPublicSettings,
      noteCapabilityWithdrawn
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};