import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ContributionExplorer } from './ContributionExplorer';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('RepoScout root element was not found.');
}

function RouteSwitch() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const restoreRoute = () => setPath(window.location.pathname);
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, []);

  return /^\/contribute\/?$/.test(path)
    ? <ContributionExplorer />
    : <App />;
}

createRoot(root).render(
  <StrictMode>
    <RouteSwitch />
  </StrictMode>,
);
