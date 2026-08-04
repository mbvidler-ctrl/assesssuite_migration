import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import LandingApp from './MarketingApp.jsx';
import { sanitiseAnalyticsEvent } from './analytics.js';
import './landing-fonts.css';
import '@/index.css';

const LANDING_PAGE_LOAD_ENDPOINT = 'https://app.assesssuite.com/api/usage/page-load';
const PRODUCTION_LANDING_ORIGINS = new Set([
  'https://assesssuite.com',
  'https://www.assesssuite.com',
]);

function reportLandingPageLoad() {
  if (!import.meta.env.PROD || !PRODUCTION_LANDING_ORIGINS.has(window.location.origin)) return;

  try {
    window.fetch(LANDING_PAGE_LOAD_ENDPOINT, {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    }).catch(() => {
      // Usage reporting is best-effort and must never affect the landing page.
    });
  } catch {
    // Isolate synchronous browser or policy failures as well.
  }
}

// Module evaluation occurs exactly once per hard load in the production
// artifact. The origin gate prevents preview, staging and local reporting.
reportLandingPageLoad();

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <LandingApp />
    <Analytics beforeSend={sanitiseAnalyticsEvent} />
  </>,
);
