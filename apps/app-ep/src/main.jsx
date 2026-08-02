import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import RootErrorBoundary from '@/components/system/RootErrorBoundary.jsx';
import {
  captureFrontendException,
  initialiseFrontendErrorTelemetry,
} from '@/lib/errorTelemetry.js';
import '@/index.css';

initialiseFrontendErrorTelemetry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary captureError={captureFrontendException}>
    <App />
  </RootErrorBoundary>,
);

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
