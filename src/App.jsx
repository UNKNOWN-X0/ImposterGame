import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Crash } from './features/dev/Crash.jsx';
import LocalGame from './modes/local/LocalGame.jsx';
import OnlineGame from './modes/online/OnlineGame.jsx';
import { loadSession } from './modes/online/useRoom.js';
import { hasSavedGame } from './modes/local/storage.js';
import { Shell } from './ui/primitives/index.js';
import { BrandMark, PhoneIcon, WifiIcon } from './ui/icons/index.jsx';
import { VERSION, hasNews } from './content/history/changelog.js';
import { useT } from './i18n/index.jsx';
import { FirstRun } from './features/rules/FirstRun.jsx';
import { Credit } from './features/rules/Credit.jsx';

import { Rules } from './features/rules/Rules.jsx';
import { Library } from './features/packs/Library.jsx';
import Changelog from './features/changelog/Changelog.jsx';

/**
 * The two workbenches, fetched only if somebody asks for them.
 *
 * These are the only screens here that a player never opens: both are
 * reached by typing a hash on the end of the address and nothing links to
 * either. The translator's board also pulls in every language, which would
 * undo the splitting that stops a phone fetching languages nobody reads.
 *
 * The rules, the pack shelf and the list of what changed are NOT lazy, and
 * that is a measurement rather than an oversight. Making all five lazy moved
 * 2.1 kB gzipped off the first load and turned 6 requests into 11 — and five
 * more round-trips on a cold connection cost more than two kilobytes save.
 * They are thin screens over components the lobby already needs, so there
 * was very little of them to move.
 */
const IconBoard = lazy(() => import('./features/dev/IconBoard.jsx'));
const StringBoard = lazy(() => import('./features/dev/StringBoard.jsx'));

const SEEN_KEY = 'imposter.seenRules';
const VERSION_KEY = 'imposter.seenVersion';
export const LIB_LANG_KEY = 'imposter.libraryLang';

export const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private browsing: nothing is remembered, and that is fine
  }
};

export const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private browsing */
  }
};

/** Reads `#join=ABCD` so a room can be shared as a link, not just a code. */
function readHash() {
  const match = /(?:^|[#&])join=([A-Za-z0-9]{4,12})/.exec(window.location.hash || '');
  return match ? match[1].toUpperCase() : '';
}

export default function App() {
  const [screen, setScreen] = useState(() => {
    // `#icons` opens the icon sheet. Nothing links to it; it is for whoever
    // is drawing the icons, not for anyone playing.
    if (/(?:^|[#&])icons\b/.test(window.location.hash || '')) return 'icons';
    // `#strings` opens the translator's board, for the same kind of reader.
    if (/(?:^|[#&])strings\b/.test(window.location.hash || '')) return 'strings';
    // `#crash` breaks on purpose, to see the error screen without waiting
    // for a bug. Nothing links to it.
    if (/(?:^|[#&])crash\b/.test(window.location.hash || '')) return 'crash';
    if (readHash()) return 'online';
    if (loadSession()) return 'online';
    // A game this phone was in the middle of. The room comes first — that one
    // is live and other people are in it — but otherwise a reload during a
    // round should land back in the round, where it can be offered back,
    // rather than on a home screen that has forgotten the whole evening.
    if (hasSavedGame()) return 'local';
    return 'home';
  });
  const [joinCode] = useState(readHash);
  const { t } = useT();
  // Somebody arriving on a join link is being waved into a game that is
  // already happening; the rules can wait until they are in it.
  const [showRules, setShowRules] = useState(() => !read(SEEN_KEY) && !readHash());
  // What they had last time, kept for the whole visit so the What's new
  // screen can still mark which releases are new to them — and, separately,
  // whether the badge is lit, which opening the screen puts out.
  const [seenVersion, setSeenVersion] = useState(() => read(VERSION_KEY));
  const [news, setNews] = useState(() => hasNews(read(VERSION_KEY)));

  const closeRules = useCallback(() => {
    setShowRules(false);
    write(SEEN_KEY, '1');
  }, []);

  // A first visit has not missed anything, so this version is what they have
  // seen. Without this stamp the badge would never appear for them again.
  useEffect(() => {
    if (!read(VERSION_KEY)) {
      write(VERSION_KEY, VERSION);
      setSeenVersion(VERSION);
    }
  }, []);

  const openNews = () => {
    // Opening it is reading it. The badge has to go out now rather than on
    // the next reload, or it looks like the tap did not land.
    write(VERSION_KEY, VERSION);
    setNews(false);
    open('changelog');
  };

  // Keep the browser's back button meaningful instead of leaving the site.
  useEffect(() => {
    const onPop = () => setScreen('home');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = (next) => {
    window.history.pushState({ screen: next }, '');
    setScreen(next);
  };

  const home = () => {
    setScreen('home');
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  };

  // One shell for every screen that has to be fetched first. The wait is a
  // few milliseconds on a phone that is already here; the fallback exists
  // for the one that is not.
  const fetched = (child) => (
    <Suspense fallback={<Shell onBack={home} />}>{child}</Suspense>
  );

  if (screen === 'crash') return <Crash />;
  if (screen === 'local') return <LocalGame onExit={home} />;
  if (screen === 'online') return <OnlineGame onExit={home} initialCode={joinCode} />;
  if (screen === 'icons') return fetched(<IconBoard />);
  if (screen === 'strings') return fetched(<StringBoard />);
  if (screen === 'rules') return <Rules onExit={home} />;
  if (screen === 'packs') return <Library onExit={home} />;
  if (screen === 'changelog') return <Changelog onExit={home} seen={seenVersion} />;

  return (
    <Shell>
      {showRules && <FirstRun onClose={closeRules} />}

      <div className="hero stack tight">
        <BrandMark size={84} />
        <h1 className="title headline">{t('home.headline')}</h1>
        <p className="subtitle">{t('home.sub')}</p>
      </div>

      <div className="stack modes">
        <button className="mode" onClick={() => open('local')}>
          <span className="mode-icon">
            <PhoneIcon size={22} />
          </span>
          <span className="mode-body">
            <span className="mode-title">{t('home.local.title')}</span>
            <span className="mode-desc">{t('home.local.desc')}</span>
          </span>
        </button>

        <button className="mode" onClick={() => open('online')}>
          <span className="mode-icon">
            <WifiIcon size={22} anim />
          </span>
          <span className="mode-body">
            <span className="mode-title">{t('home.online.title')}</span>
            <span className="mode-desc">{t('home.online.desc')}</span>
          </span>
        </button>
      </div>

      <div className="home-links">
        <button className="btn-link" onClick={() => open('rules')}>
          {t('home.rules')}
        </button>
        <button className="btn-link" onClick={() => open('packs')}>
          {t('home.packs')}
        </button>
        <button className="btn-link" onClick={openNews}>
          {t('home.whatsNew', { version: VERSION })}
          {news && <span className="dot" aria-hidden="true" />}
        </button>
      </div>

      <Credit />
    </Shell>
  );
}
