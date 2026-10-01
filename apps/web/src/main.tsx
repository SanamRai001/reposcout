import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ContributionExplorer } from './ContributionExplorer';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('RepoScout root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    {/^\/contribute\/?$/.test(window.location.pathname)
      ? <ContributionExplorer />
      : <App />}
  </StrictMode>,
);
