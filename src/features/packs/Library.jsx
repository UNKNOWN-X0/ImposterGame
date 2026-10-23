/**
 * The pack library, opened from the home screen rather than from a game.
 *
 * Inside a game the packs belong to that game's state, because a host has to
 * be able to push them to a room. Out here there is no game, so the shelf is
 * simply what is on the device: read it, write it, and whatever game starts
 * next picks it up.
 */

import { useState } from 'react';
import PackEditor from './PackEditor.jsx';
import PackLibrary from './PackLibrary.jsx';
import { loadPacks, savePacks } from './store.js';
import { PACK_LIMITS } from '../../content/words/custom.js';
import { DEFAULT_WORD_LANG } from '../../content/words/index.js';
import { Banner, Shell } from '../../ui/primitives/index.js';
import { useErrorText } from '../../i18n/index.jsx';
import { LIB_LANG_KEY, read, write} from '../../App.jsx';

/**
 * The pack library, opened from the home screen rather than from a game.
 *
 * Inside a game the packs belong to that game's state, because the host has
 * to be able to push them to a room. Out here there is no game, so the shelf
 * is what is on the device: read it, write it, and whatever game starts next
 * picks it up.
 */
export function Library({ onExit }) {
  const [packs, setPacks] = useState(loadPacks);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState(() => read(LIB_LANG_KEY) || DEFAULT_WORD_LANG);
  const errorText = useErrorText();

  const keep = (next) => {
    setPacks(next);
    savePacks(next);
  };

  const savePack = (pack) => {
    const others = packs.filter((p) => p.id !== pack.id);
    if (others.length >= PACK_LIMITS.packs) {
      setError({ code: 'packTooMany', params: { max: PACK_LIMITS.packs } });
      return;
    }
    keep([...others, pack]);
    setEditing(false);
  };

  const deletePack = (id) => {
    keep(packs.filter((p) => p.id !== id));
    setEditing(false);
  };

  if (editing !== false) {
    return (
      <Shell onBack={() => setEditing(false)}>
        {error && <Banner kind="error">{errorText(error)}</Banner>}
        <PackEditor
          pack={packs.find((p) => p.id === editing) ?? null}
          lang={lang}
          onSave={savePack}
          onDelete={deletePack}
          onClose={() => setEditing(false)}
        />
      </Shell>
    );
  }

  return (
    <Shell onBack={onExit}>
      <PackLibrary
        lang={lang}
        customPacks={packs}
        onLang={(next) => {
          setLang(next);
          write(LIB_LANG_KEY, next);
        }}
        onEdit={setEditing}
        onClose={onExit}
      />
    </Shell>
  );
}
