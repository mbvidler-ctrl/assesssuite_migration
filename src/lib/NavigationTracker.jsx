import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { base44 } from '@/api/base44Client';
import { pagesConfig } from '@/pages.config';

const APP_OPEN_SESSION_KEY = 'assesssuite:usage:app-open:v1';
let appOpenClaimedInDocument = false;

function claimAppOpenForBrowserSession() {
    if (appOpenClaimedInDocument) return false;

    try {
        if (window.sessionStorage.getItem(APP_OPEN_SESSION_KEY) === '1') {
            appOpenClaimedInDocument = true;
            return false;
        }
        // Claim before starting the request so remounts and auth transitions
        // cannot produce duplicate AppOpen records in the same tab session.
        window.sessionStorage.setItem(APP_OPEN_SESSION_KEY, '1');
    } catch {
        // A storage policy must not break the app. The document-local claim
        // still guarantees at most one attempt until this hard load ends.
    }

    appOpenClaimedInDocument = true;
    return true;
}

export default function NavigationTracker() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const { Pages, mainPage } = pagesConfig;
    const mainPageKey = mainPage ?? Object.keys(Pages)[0];

    // Post navigation changes to parent window
    useEffect(() => {
        window.parent?.postMessage({
            type: "app_changed_url",
            url: window.location.href
        }, '*');
    }, [location]);

    // Record one authenticated application-open sentinel per browser tab
    // session. This intentionally reuses the existing appLogs contract so no
    // identity, URL, referrer, browser or client-record payload is introduced.
    useEffect(() => {
        if (!isAuthenticated || !claimAppOpenForBrowserSession()) return;

        try {
            base44.appLogs.logUserInApp('AppOpen').catch(() => {
                // Silently fail - usage logging must never break the app.
            });
        } catch {
            // Isolate synchronous SDK failures as well as rejected requests.
        }
    }, [isAuthenticated]);

    // Log user activity when navigating to a page
    useEffect(() => {
        // Extract page name from pathname
        const pathname = location.pathname;
        let pageName;
        
        if (pathname === '/' || pathname === '') {
            pageName = mainPageKey;
        } else {
            // Remove leading slash and get the first segment
            const pathSegment = pathname.replace(/^\//, '').split('/')[0];
            
            // Try case-insensitive lookup in Pages config
            const pageKeys = Object.keys(Pages);
            const matchedKey = pageKeys.find(
                key => key.toLowerCase() === pathSegment.toLowerCase()
            );
            
            pageName = matchedKey || null;
        }

        if (isAuthenticated && pageName) {
            base44.appLogs.logUserInApp(pageName).catch(() => {
                // Silently fail - logging shouldn't break the app
            });
        }
    }, [location, isAuthenticated, Pages, mainPageKey]);

    return null;
}
