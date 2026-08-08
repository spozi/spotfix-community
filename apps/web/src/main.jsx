import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import MonitorPage from './monitor/MonitorPage.jsx';
import 'leaflet/dist/leaflet.css';
import './styles.css';

// Minimal hash routing: '#/monitor' renders the public monitoring dashboard,
// everything else renders the existing portal SPA untouched.
function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (hash.startsWith('#/monitor')) {
    return <MonitorPage />;
  }
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
