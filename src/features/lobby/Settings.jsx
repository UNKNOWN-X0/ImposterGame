/**
 * Every choice the table makes before the cards go out.
 *
 * This file works out what the settings need to know — how many seats, what a
 * blind game rules out, which packs exist in the chosen language — and hands
 * that to the sections in ./settings, which are the settings themselves. They
 * render in the order they are listed below, and that order is the screen.
 *
 * Adding a setting is a section in ./settings and a line here.
 */

import { MIN_PLAYERS, maxImpostersFor } from '../../core/engine.js';
import { packsFor, pairCount } from '../../content/words/index.js';
import { useT } from '../../i18n/index.jsx';
import { Presets } from './settings/Presets.jsx';
import { Packs, WordLanguage } from './settings/Words.jsx';
import { HowMany, WhatTheySee, WhetherTheyKnow } from './settings/Imposters.jsx';
import { Calling, Rounds, Stealing } from './settings/Play.jsx';
import { Roles, Scoring } from './settings/Extras.jsx';

export { hintLine } from './hintLine.js';

export function Settings({
  config,
  playerCount,
  onChange,
  disabled,
  customPacks = [],
  onEditPack,
  onBrowsePacks,
}) {
  const { t } = useT();
  const seats = Math.max(playerCount, MIN_PLAYERS);
  const blind = config.imposterKnows === false;
  const wordLang = config.wordLang;
  const packs = packsFor(wordLang, customPacks);
  // Only the packs this table wrote can be edited, and only the ones written
  // in the language being played are on screen at all.
  const myPacks = customPacks.filter((pack) => pack.lang === wordLang);
  const packIds = config.packIds ?? [];
  const allPacks = packIds.length === 0;
  const roles = config.roles ?? [];
  // The cap moves with the roles: a sidekick is a seat on the imposters'
  // side, so the panel must stop offering a number that would deal a game
  // the crew has already lost. Blind mode turns the roles off, and the cap
  // goes back up with them.
  const cap = maxImpostersFor(seats, blind ? [] : roles);

  const togglePack = (id) => {
    const next = new Set(allPacks ? packs.map((p) => p.id) : packIds);
    next.has(id) ? next.delete(id) : next.add(id);
    const list = [...next];
    // Selecting everything is the same as selecting nothing — keep it as []
    // so a newly added pack is picked up automatically.
    onChange({ packIds: list.length === packs.length ? [] : list });
  };

  const words = pairCount(wordLang, packIds, customPacks);

  // One bundle, because every section wants some of it and none of them
  // should be reaching back into this file for the rest.
  const ctx = {
    t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks,
    packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks,
  };

  return (
    <div className="card">
      <Presets {...ctx} />
      <WordLanguage {...ctx} />
      <Packs {...ctx} />
      <details className="setting-more">
        <summary>{t('settings.customize')}</summary>
        <div className="setting-more-body">
          <HowMany {...ctx} />
          <WhatTheySee {...ctx} />
          <WhetherTheyKnow {...ctx} />
          <Calling {...ctx} />
          <Stealing {...ctx} />
          <Rounds {...ctx} />
          <Roles {...ctx} />
          <Scoring {...ctx} />
        </div>
      </details>
    </div>
  );
}
