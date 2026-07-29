import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import RootErrorBoundary from '@/components/system/RootErrorBoundary.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
  // </React.StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}


