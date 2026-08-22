import { assertRuntimePlatformIdentity } from '../../../packages/profession-config/index.mjs';

const TARGET_ERROR_MESSAGE = 'AssessSuite Physio could not start because its application identity is invalid.';

function renderTargetError() {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = '';
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.style.cssText = 'max-width:42rem;margin:4rem auto;padding:1.5rem;font:600 1rem/1.5 system-ui;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:.75rem';
  message.textContent = TARGET_ERROR_MESSAGE;
  root.append(message);
}

try {
  assertRuntimePlatformIdentity('physio', {
    compiledProfessionId: import.meta.env.VITE_PROFESSION,
    compiledAppId: import.meta.env.VITE_BASE44_APP_ID,
    search: window.location.search,
    storedAppId: window.localStorage.getItem('base44_app_id'),
  });
} catch (error) {
  renderTargetError();
  throw error;
}

async function bootstrap() {
  const [reactDom, appModule, boundaryModule, telemetryModule] = await Promise.all([
    import('react-dom/client'),
    import('@/App.jsx'),
    import('@/components/system/RootErrorBoundary.jsx'),
    import('@/lib/errorTelemetry.js'),
    import('@/index.css'),
  ]);

  const App = appModule.default;
  const RootErrorBoundary = boundaryModule.default;
  const { captureFrontendException, initialiseFrontendErrorTelemetry } = telemetryModule;

  initialiseFrontendErrorTelemetry();
  reactDom.createRoot(document.getElementById('root')).render(
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
}

bootstrap().catch((error) => {
  renderTargetError();
  throw error;
});
