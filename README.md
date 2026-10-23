# Imposter

A word-imposter party game for the web. Everyone gets the same secret word except
one player, who gets a similar-but-wrong word — or nothing at all. Give one-word
clues, argue, vote.

Plays in **English, Thai and German**.

Made by Thanate Amornjiraporn (Focus).

Two ways to play, one set of rules:

- **One phone** — pass it around the table. Each player taps to see their card, a
  gate screen covers it in between. Runs entirely in the browser, no server.
- **Everyone's phone** — one person starts a room on their laptop, everyone else
  joins over the same wifi with a four-character code.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5174 — one-phone mode, hot reload
```

For phone-to-phone play you need the little party server too:

```bash
npm run party      # builds the site, then serves it on your wifi
```

It prints two addresses. The second one — something like
`http://192.168.1.42:5173` — is the one everyone else types into their phone.
Same wifi, then the room code.

```
  🕵️  Imposter is running

  On this computer:  http://localhost:5173
  On everyone else's phone:  http://192.168.1.42:5173
```

If you are working on the UI *and* want rooms, run both: `npm run serve` in one
terminal and `npm run dev` in another. Vite proxies `/api` through to the server,
so everything behaves the same as in production.

## Tests

```bash
npm run verify
```

One command for everything that can be checked: the unit tests, the coverage
floors, the build, and both browser sweeps. Anything it cannot run — no dev
dependencies, no browser installed — it skips out loud and says so in the
summary, rather than printing green for a smaller check than you think you
ran. Nothing here is required to *play* the game, which needs only React.

```bash
npm test          # the rules and the server, in seconds, with no browser
npm run coverage  # the same tests, per module, against a floor each
npm run verify    # all of it, including the browser sweeps
```

`npm test` covers the rules engine (including a thousand randomised games that
all have to terminate with a winner) and the server end-to-end: four simulated
phones join a room, play a full game, and the suite checks that a player can
only ever act as themselves and that the secret word never reaches the
imposter's device.

### What a phone remembers

The roster, the scores, the settings, the recent words — and, since 1.23.0,
the round itself. `src/modes/local/storage.js` writes the game down after
every action and offers it back on the next load rather than restoring it
silently: somebody who reloaded by accident wants it, somebody setting up a
new table next week does not. It is cleared when the game ends, and a round
dealt by a different version is dropped rather than resumed, since the rules
may have moved underneath it.

The keys live in `storage.js` rather than in the screen that uses them, which
is what makes the whole layer loadable by `node --test` — a `.jsx` file is not.

### The fingerprint

`npm test` also takes a fingerprint: 400 games played by a fixed script across
every language, every decoy mode and every combination of roles, plus every
word in every pack and every string in every language, hashed into one line
(`src/testing/fingerprint.js`). The hash of a good run is committed beside it.

A refactor that changes that hash is not a refactor. After an intended change
to the rules or the words, read the difference before recording it:

```bash
node tools/fingerprint.mjs --dump before.txt   # on the old code
node tools/fingerprint.mjs --dump after.txt    # on the new
diff before.txt after.txt                      # is this what you meant?
npm run fingerprint -- --write                 # yes: bless the new hash
```

### Coverage floors

`npm run coverage` reports line coverage per module against a floor in
`src/testing/coverage.floors.json`, and fails under it. Two things it does
that a plain coverage run does not: a file no test ever loads counts as zero
rather than disappearing from its own module's score, and `.jsx` is left out
of the percentage instead of being scored as zero, because `node --test` has
no JSX transform — those files are checked by the browser sweeps below. The
floors are a ratchet: `npm run coverage -- --bless` raises them after you add
tests, and nothing lowers them on its own.

Every push runs the tests, the floors and both browser sweeps through
`.github/workflows/ci.yml`.

---

## How it is put together

Six folders, and the rule is that each only knows about the ones above it.

```
src/core/            the rules. No DOM, no network, no clock, no React.
     engine.js         the reducer, and how a round ends
     rules.js          the limits, the modes, and what a table may set
     select.js         questions about a game: whose turn, who may see what
     deal.js           starting one: the word, the imposters, the roles
     roles/            one file per optional role — see "Add a role"
     scoring/          every way to win, and what each pays
src/content/         the words and the history, as data
     words/builtin/    ten packs of a hundred, per language
     words/custom.js   packs a table writes, and the codes that share them
     words/sources.js  where packs come from — see "Add a source of words"
     history/          what changed, written for players
src/i18n/            one file per language, and the reader that picks a string
src/ui/              pieces that know nothing about the game
     primitives/       Shell, Banner, Segmented, Info, Avatar, HoldCard…
     icons/            one grid, one stroke, thirty icons
     theme/            light/dark and the five colour families
     styles/           the stylesheet, in layers, in cascade order
src/features/        pieces that do know: lobby, round, packs, rules, changelog
     errors/           what a player sees when something breaks, and the report
                       they can send — which never carries the word
src/modes/           local (one phone) and online (a room), which wire the rest
src/testing/         the checks that are about the project, not about the game
server/              static files + room API, zero dependencies
```

Nothing in `core` imports React. Nothing in `ui` imports the engine. Both modes
render the same `features`, and differ only in who is holding the phone.

Four decisions worth knowing about, because they are the reason the rest of the
code looks the way it does.

**The rules live in one folder, and name nothing they could look up.** Both
modes call the same `reduce(state, action)`, so fixing the voting logic fixes it
in both places at once and the rules can be tested without a browser or a socket
in sight. Inside that folder the engine does not know the word "jester" or what
a clean sweep pays: it asks `core/roles` and `core/scoring`. There is a test
that fails if a role's name reappears in the rules.

**The server never sends a player something they should not see.** It keeps the
authoritative state and sends each phone a scrubbed copy plus that player's own
card. Opening dev tools shows you nothing — the word is not there to find. Votes
are held back until the last one is in, so nobody can follow the leader. The
server also rewrites the actor on every action, so a doctored request cannot vote
on someone else's behalf.

**Live updates use Server-Sent Events, not WebSockets.** Updates only ever flow
server → client, which is all a card game needs. The browser reconnects a dropped
EventSource by itself, which matters when a phone locks mid-round, and it needs
no packages, which is why `npm install` pulls in nothing but React and Vite.

**Interface language and word language are separate.** Which language you read
the buttons in is a per-device choice, saved in that browser. Which language the
secret words come from belongs to the game and is set by the host, because
everyone at one table has to be guessing the same word. This is why rule
violations travel as codes like `clueTaken` rather than as English sentences —
each phone renders the reason in its own language.

## Making it yours

**Add words.** `src/content/words/builtin/en.js`, `th.js` and `de.js` each hold ten packs
of a hundred `{ word, decoy }` pairs — 3,000 in total. Each pack also carries a
`hint`, the category line shown in hint mode; an individual pair can override
it with its own `hint` if a particular word deserves something sharper.

`npm test` validates the packs: ten of a hundred per language, no word dealt
twice within a language, no word equal to its own decoy, and a hint line on
every pair. Add words freely and let the suite catch the collisions. A good decoy is close enough that the
imposter's clue sounds reasonable but far enough that a sharp crew can catch it —
`Pizza`/`Lasagna`, not `Pizza`/`Helicopter`. New packs appear in the settings
automatically.

Note that the three files are not translations of each other, and should not
become them. A pack is written for the people who speak that language: the Thai
packs reference ส้มตำ and ลอยกระทง, the German ones Spätzle and Schützenfest. A
translated word list produces a game where half the words mean nothing to the
table.

**Add a language.** Add a table in `src/i18n/strings/` shaped like `en.js` and a
word pack file in `src/content/words/builtin/` shaped the same way, then register
both in the `index.js` beside them. Missing strings fall back to English, so
a half-finished translation still gives a playable game.

**Change how it deals.** `pickWord` and `pickImposters` in the engine decide
what comes up. They read `state.history`, which remembers recent words and who
has been imposter how often, so the same person is never the imposter twice
running and words do not come back for a long while. That history holds the
word in play, so `publicState` strips it entirely rather than nulling fields.

**Change the rules.** Everything lives in `reduce()`. The win conditions are in
`resolveOutcome` — that is where "imposters win when they equal the crew in
numbers" is decided, and where you would add, say, a detective role.
`advanceAfterVerdict` just above it decides who is owed a final guess.

Each optional rule is a flag on the config, so adding another follows the same
shape: `decoyMode` picks what the imposter is shown, `imposterKnows` decides
whether anyone is told their role at all, `allowCall` and `allowSteal` switch
the two ways an imposter can win by naming the word, and `imposterCount` takes
`'auto'`, `'random'` or a number, and `maxRounds` takes a number or
`'unlimited'`.

Settings that cannot both be true are settled in one place, `normaliseConfig`:
blind mode rules out a blank card and rules out calling the word, and it does
so in the lobby so the table sees the settings it will actually play rather
than having them overridden at the deal. Note that a `'random'`
count is resolved at deal time and never written back into the config — the
config is sent to every player, so writing it there would hand them the answer.

**Packs people write themselves.** `src/content/words/custom.js` is the whole
format: it parses a pasted list, validates a pack from anywhere, and turns one
into a shareable code and back. It is plain JavaScript with no imports from
the app, because it is the one part of the game that accepts arbitrary text
from a player and a word list from a stranger's phone.

A custom pack lives on the device that wrote it (`src/features/packs/store.js`), joins
the built-in packs for the language it was written in, and — in a room — is
sent to the server by the host so the deal can use it. Two things are worth
knowing if you touch this:

- **A word list is a list of candidate answers**, so `publicState` sends every
  phone the pack's name, icon and size and strips the words. The engine test
  `the words in a custom pack never reach the other phones` checks the whole
  broadcast for them.
- **Everything is re-validated on the way in** — from localStorage, from a
  code, from the network — by `validatePack`. What was stored by an older
  version, or typed by somebody with the developer tools open, is not
  trustworthy input.

An entry written without a near miss borrows another word from its own pack
when one is needed, which is handled in `decoyFor`.

**The rules live in one folder.** `src/core/` is a pure reducer and its parts — no
DOM, no network, no clock — and every rule is in it, including the optional
roles and the scoring. Both play modes run the same engine, so a rule cannot
behave one way on a shared phone and another way in a room.

**Add a role.** Each optional role is a file in `src/core/roles/` that
describes how it differs from plain crew, and the engine reads those fields
rather than naming the role:

```js
// src/core/roles/understudy.js
export default {
  id: 'understudy',
  side: 'imposters',      // 'crew', 'imposters' or 'nobody'
  reveals: 'imposters',   // what their card shows beyond the word
  deal({ plainCrew, rng }) {   // optional: anything extra to deal them
    return {};
  },
  endsGameWhenVotedOut: null,  // or { winner: 'jester', reason: 'jester' }
};
```

Register it in `src/core/roles/index.js`, give it a face in `ROLE_FACE`
(`src/ui/primitives/RoleGlyph.jsx`) and a name and explanation in each of the
three language files. That is the whole job: `dealRoles` will hand it out while
`PLAIN_CREW_FLOOR` ordinary crew would still be left, `viewFor` will show what
it says it reveals, `publicState` scrubs the role map until the game is over —
a player reading the network tab must not learn who the jester is — and
`resolveOutcome` already knows how to count a side it has never heard of.

**Add a way to win.** `src/core/scoring/index.js` is one table: who won, what
it pays, and whether being voted out costs you your share. A test fails if the
engine hard-codes an award anywhere else.

**The icon on a phone's home screen** is `public/icon.svg` — the game's own
mark with its colours written out — plus a separate `icon-maskable.svg` for
Android, which crops an icon to the phone's own shape and keeps only the
middle 80%. The PNGs beside them are rendered from those two by
`npm run icons` and checked in; `npm test` checks they are the sizes the
manifest promises, because a stale icon is invisible until somebody saves the
game to a home screen.

iOS reads `apple-touch-icon` and nothing else — not the SVG, not the
manifest — which is why there is a PNG at all.

**Before releasing, draw every screen.** `npm run build && npm run screens`
plays a whole game in a real browser — deals, looks at every card, calls the
word, votes somebody out, reaches the end — and visits every other screen in
all three languages, failing if anything throws. It needs Playwright, which
the game itself does not, so it is deliberately outside `npm test`:

```
npm install --no-save playwright && npx playwright install chromium
npm run build && npm run screens && npm run endings
```

`screens` draws every screen there is; `endings` plays a whole game seven
times, once per way of winning, and checks each one arrives at its own
final screen — the last crash was on a screen only a winner ever sees.

Two crashes reached a real phone in one week, both a missing import, and both
invisible to every check that reads the code — the reader in
`src/testing/checks` needed five separate lessons about what is code and what
only looks like it, each one taught by something it had already let through.
A missing import cannot hide from a screen that is actually drawn.

**When something goes wrong.** Rule violations are not failures: those travel
as codes from `core/errors.js`, become sentences in `src/i18n`, and show as a
banner. `features/errors` is for the things nobody planned for. A render that
throws gets the error screen; anything else — a rejected promise, a handler
that throws on a tap — gets one quiet line at the bottom, because a game that
carries on looking fine while quietly not working is worse than one that says
so. Both offer the same report.

A report says the version, the mode, the phase, how many were playing, the
error, and the last dozen actions **by name** — `SUBMIT_CLUE`, never the clue.
It never contains the word, the near miss, or who was dealt what: a report
gets pasted into the group chat the other players are reading, and losing a
round to a bug report would be a silly way to lose one. Whoever deals calls
`keepQuiet([...])` with whatever is currently secret, and everything on the
way out is redacted against that list. `src/features/errors/report.test.js`
deals a real game and asserts its real word cannot be found in a report.

Open `#crash` to see the error screen on a real phone without waiting for a bug.

**Add a source of words.** `src/content/words/sources.js` lists where packs
come from — the ones we ship and the ones a table writes. A source answers one
question, `packsFor(lang, context)`, and returns packs in the usual shape, so a
third kind (an expansion, a pack fetched from somewhere) is a file and a line.

**Change the look.** Colour lives in two dials at the top of
`src/ui/styles/tokens.css`: `data-mode` (light or dark) and `data-theme` (which family
of colours). Every theme declares the same tokens for both modes, so nothing
further down the stylesheet ever has to know which is on. Readers pick both
from the display menu in the header; the default is to follow the phone, and
to keep following it — a phone that goes dark at sunset takes the game with it
mid-round.

Two tokens are easy to mix up. `--accent` is a **fill**: it can be bright,
because what sits on it is `--on-accent`, chosen to suit. `--accent-text` is
the same colour darkened until it can be read as text on a plain surface,
which a bright amber on white cannot. Words, icons and hairlines use
`--accent-text`; backgrounds use `--accent`.

**To add a theme**: add an entry to `THEMES` in `src/ui/theme/themes.js` (an id
and the two colours its chip shows in each mode), add `theme.<id>` to the three
tables in `src/i18n/strings/`, and add the two palette blocks to
`src/ui/styles/tokens.css`. Then run the tests — `src/ui/theme/theme.test.js` reads the
stylesheet and will tell you if the new theme is missing a token, if any text
colour fails contrast on any surface it can land on, or if the chip in the
picker is nothing like the theme it claims to show. The palettes that ship
were generated against those rules rather than picked by eye.

`src/ui/icons/` holds the icon set — inline SVG on a 24×24 grid painted with
`currentColor`, plus the brand mark, the hold ring, the confetti and the
backdrop. They are drawn to the usual rules for a stroke set at this size:
everything inside a 20×20 live area with the outer 2 left clear, sized by
keyline rather than by bounding box (a circle may run the full 20, a square
stops near 18, an upright shape is about 16 by 20), one stroke weight of 1.8,
round caps and joins throughout, and no gap between two strokes narrower than
the stroke itself. Icons are decorative and marked `aria-hidden`; the text
beside them carries the meaning.

Each icon has one movement of its own, and it is what that object does — the
bell swings, the hand waves, the die rolls, the hourglass is turned over. It
is off unless the call site passes `anim`, so the same drawing can sit still
in a list and move on the card where it is the subject:

```jsx
<BellIcon size={30} anim />
```

**Open `#icons`** — say `http://localhost:5173/#icons` — for the icon sheet:
every icon at 64, 30, 20 and 16px with its motion running, what it is for and
what the motion is. Nothing in the app links to it. It reads from the same
components the game uses, so it cannot fall out of date.

All of the motion is decoration on a layout that works without it, which is why
the `prefers-reduced-motion` block at the end of the stylesheet can switch every
bit of it off.

## Playing it without a terminal

**Double-click `Play Imposter.command`** (or `Play Imposter.bat` on Windows).
It installs what is missing the first time, builds, starts the server and
opens the browser. Everyone else joins on the address it prints. Closing the
window stops it.

The first time on a Mac, right-click the file and choose Open rather than
double-clicking: it came out of a zip and has no signature, so Gatekeeper
wants to be asked once. Drag it to the Dock afterwards and it is one click
from then on.

The only way to need nothing at all — no terminal, no launcher, no computer
left running — is to put it on the web; see below.

## Deploying

**Pass-and-play anywhere.** `npm run build`, then drop `dist/` on Netlify,
GitHub Pages, anything. Those hosts serve files and nothing else, so rooms
cannot work there — the app checks for the server and says so on the join
screen rather than failing with a 404.

**Rooms need a host that runs Node** — Render, Railway, Fly, or a machine of
your own. There is a `render.yaml` in the repo, so Render reads the whole
setup from it; elsewhere the three things that matter are:

| | |
|---|---|
| build | `npm install && npm run build` |
| start | `npm start` |
| port | read from `PORT` — already done, do not hard-code it |

Rooms live in the server's memory and are swept after six idle hours. On a
free tier that sleeps when idle, the first visitor waits half a minute while
it wakes.

**Games in progress survive a restart**, which is the one thing memory alone
could not do: a deploy or a crash used to end every round at the table, and a
host that restarts a process whenever it likes is not a rare event. So every
change is also written to a small JSON file, and a fresh process reads it
back. Rooms touched in the last hour come back; anything older is left, since
a stale code could now belong to somebody else.

**That file holds the word currently in play.** It is the same machine that
was holding it in memory a moment ago, so it is not a secret in a new place,
but it is a secret at rest and worth knowing about:

| | |
|---|---|
| where | `.rooms.json` beside the code, or wherever `ROOM_STORE` points |
| turn it off | `ROOM_STORE=off` — rooms then die with the process |
| how long | `ROOM_RESTORE_MS`, default one hour |
| permissions | written `0600`, owner only, and in `.gitignore` — never commit it |

It also carries the version that wrote it. A build whose rules have changed
cannot promise to understand a game dealt by the one before it, so those
rooms are left behind rather than guessed at.

`ROOM_CODE_LENGTH` sets how long a room code is, from 4 to 12. Four is right
across a table, where the code gets read out loud and nobody outside the room
can reach the server anyway. A public address is a different situation, so
`render.yaml` asks for six. The join box takes its length from whatever the
server says.

## Module map

Already extensively modular; keep these boundaries:

- `src/core/`: game engine, rules, roles, scoring, and randomness.
- `src/features/`: lobby, rounds, packs, errors, rules, and changelog UI.
- `src/modes/`: local and online orchestration.
- `src/content/`: vocabulary and history.
- `src/i18n/`: translations.
- `src/ui/`: reusable components, icons, themes, and styles.
- `server/`: multiplayer rooms, storage, and HTTP server.
- `src/testing/`, colocated `*.test.js`: checks and tests.

Use `npm test` and `npm run build` before pushing. Netlify publishes `dist/`, while a separate Node server is needed for online rooms.
