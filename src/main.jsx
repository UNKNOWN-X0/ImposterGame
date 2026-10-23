import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import { LanguageProvider, detectLanguage } from './i18n/index.jsx';
import { loadStrings } from './i18n/strings/index.js';
import { ThemeProvider } from './ui/theme/index.jsx';
import { Backdrop } from './ui/icons/index.jsx';
import { ErrorBoundary, describe, watchTheWindow } from './features/errors/index.js';
import { VERSION } from './content/history/changelog.js';
import './ui/styles/index.css';

// Anything that goes wrong from here on has something to say about itself.
// The language is read here rather than left to the provider's effect: a
// crash during the very first render happens before any effect has run, and
// that is exactly the crash somebody will send a report about. The provider
// keeps it up to date afterwards, when a reader changes it.
const startIn = detectLanguage();
describe({ version: VERSION, lang: startIn });
watchTheWindow();

// The reader's own language, fetched before anything is drawn.
//
// Only Thai and German are a fetch at all — English is bundled, because it is
// the fallback. Waiting costs an English reader nothing (the promise is
// already resolved) and saves everyone else a first paint in a language they
// did not choose. If the fetch fails, `loadStrings` resolves anyway and the
// screen comes up in English: a worse evening than it should be, but still a
// playable game.
//
// A `.then` rather than a top-level await, because the build targets es2020
// and top-level await is es2022 — this is the one place where that would
// have been a build failure rather than a syntax preference.
loadStrings(startIn).then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ThemeProvider>
        <LanguageProvider>
          <Backdrop />
          {/* Inside the providers, so the apology is in the reader's own
              language and the reader's own colours. */}
          <ErrorBoundary onRestart={() => window.location.assign(window.location.pathname)}>
            <App />
          </ErrorBoundary>
        </LanguageProvider>
      </ThemeProvider>
    </StrictMode>,
  );
});
