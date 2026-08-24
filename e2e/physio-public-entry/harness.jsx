import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@/index.css';
import PhysioPublicLanding from '@/pages/PhysioPublicLanding';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PhysioPublicLanding />
    </BrowserRouter>
  </React.StrictMode>,
);
