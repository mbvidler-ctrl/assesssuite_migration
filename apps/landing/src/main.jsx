import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import LandingApp from './MarketingApp.jsx';
import { sanitiseAnalyticsEvent } from './analytics.js';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <LandingApp />
    <Analytics beforeSend={sanitiseAnalyticsEvent} />
  </>,
);
