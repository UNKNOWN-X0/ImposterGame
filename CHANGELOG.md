# Changelog

All notable changes to this project are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [1.29.0] — 2026-10-21

- Simplified the default lobby view while keeping detailed rules one tap away.
- Made role descriptions visible when choosing roles.
- Added a manual reconnect action to room play and a reusable playtest guide.

## [1.28.0] — 2026-10-20

A defect pass before tagging anything larger: three reviews run independently
over the code, the built app in a browser, and the documentation. Seven of
what they found could change the result of a game or end one, so this is a
release of its own rather than a line under the next feature.

It is 1.28.0 and not 2.0.0 on purpose. Nothing here breaks for anybody: room
codes are unchanged, settings, roster and scores are re-validated through the
reducer as they always were, and the pack shelf migrates itself. A major
number should mean somebody has to do something, and nobody does.

### Fixed

- **The broadcast carried the seed, so any player could work out the word and
  the imposters.** `publicState` nulls the word, the decoy, the hint, the role
  map and the imposter list — and then passed `seed` through untouched, inside
  the rest of the state. Every other input to the deal is public by design
  (the roster in its dealt order, the config, the pack ids) and the word lists
  ship inside every client's own bundle, so a phone holding the seed could
  replay `pickWord` and `pickImposters` and read the answer off its own
  screen, before anybody had said a word. Confirmed end to end: derived word
  and derived imposter list both matched exactly.

  This is the one secret that cannot be nulled late, because it goes out at
  the deal. The test for it is the attack rather than a field check — it
  replays the deal from nothing but the broadcast state and asserts it comes
  out wrong — and the behaviour fingerprint hashes the wire format, so a
  return would fail the suite.

- **A legal lobby could deal a game the crew had already lost.**
  `maxImpostersFor` capped the number of *imposters*, but `resolveOutcome`
  ends the game when the imposters' *side* draws level with the crew, and the
  sidekick is on that side. So turning the sidekick on and setting the count
  to the number the settings panel itself offered dealt a round that was over
  before the first clue: one vote, and every possible result — including a tie
  where nobody was voted out — read `imposters/outnumbered`.

  It was not an edge case. It held at every table size from five up, and at
  four players it needed no unusual settings at all. **16 of the 400 scripted
  games in the behaviour fingerprint were ending that way**; the fingerprint
  had been recording it since the sidekick shipped and nobody had read those
  lines as a bug. Now none of them do. An ally costs a seat in the cap, and
  `dealRoles` will not hand out a role that would make the sides level — at a
  small table the sidekick is simply not dealt, because the role is a bonus
  and not a promise.

- **The host leaving bricked the room for everybody.** `hostId` was assigned
  once, when the room was empty, and never again; there was no leave endpoint,
  and `REMOVE_PLAYER` refused to remove the host. A host who tapped Leave,
  cleared their browser or ran out of battery left a room where all nine
  host-only actions — `CONTINUE` and `FORCE_VOTE` among them — were refused
  forever. Rejoining did not help, because a rejoin mints a new id. The only
  way out was a new room and a new code read out to everybody.

  Leaving is now something a phone says rather than something the server has
  to guess from a dropped socket, and the crown moves to somebody who is still
  there — preferring a phone with an open stream. In the lobby the player
  leaves the roster; mid-game they do not, because the cards are dealt and the
  rules have no way to un-deal one.

- **A kicked player kept their token and their stream.** The engine cleans
  everything it keys by a player, but a token and an SSE listener are not game
  state and it has never heard of them. So a kicked phone went on receiving
  every frame of the game it had been thrown out of — including, until the fix
  above, the seed — and the moment the round started its own screen asked for
  a private view the server had stopped building and threw on `null`, taking
  the whole screen down behind the error boundary. Both halves are closed: the
  server forgets the phone, and the reveal screen says so plainly instead of
  crashing if it ever happens again.

- **Any guest could wipe or replace the room's word packs.**
  `SET_CUSTOM_PACKS` was missing from the host-only list. The reducer's own
  comment said it was "sent by whoever is hosting, from their own phone", and
  the screen only sent it when `isHost` — but an assumption on a client is not
  a rule, and the endpoint is open. A guest could POST one and destroy the
  pack a table had spent an evening writing, or quietly substitute five words
  of their own.

- **The shutdown handler destroyed the games it existed to save.** Rooms are
  read from disk lazily, on the first call that needs one, so a process that
  only ever served static files — a restart loop, or a rolling deploy replaced
  before traffic arrived — had an empty map and had never read the file.
  `SIGTERM` then flushed that empty map over a file holding live rooms. Every
  persisted game, gone, by the handler written to protect them. Nothing owed
  now means nothing written.

- **Editing a word pack did nothing until the page was reloaded.** The pool
  cache was keyed on `id:pairs.length` — which is not what is in a pack, it is
  how much. The editor keeps a pack's id, and rewriting its words keeps the
  count, so a table that replaced all five of their words went on being dealt
  the five they had deleted, and the new ones could never come up at all.
  Adding or removing one entry masked it, because then the count moved and the
  cache turned over, which is why it survived every casual try. The same
  mistake in the other mode compared id and count against the room — where the
  words live on the server, so a reload did not help either. The cache now
  stamps the contents, and the host notices its own edits.

- **An empty final guess could win the game.** `CALL_WORD` guarded empty text;
  `STEAL_GUESS` did not, and the button being disabled is not a rule when the
  endpoint is open. Worse underneath it: three rules compared `normalise(a) ===
  normalise(b)`, and `normalise` keeps only letters, digits and marks — so
  `???`, `!!!` and `🎉` all come back as the empty string and all compared
  equal to each other and to nothing at all. A custom pack of punctuation
  passed validation, and typing nothing "matched" the word. Guessing now asks
  whether two things are the same *word*, nothing is never a word, and a pack
  entry with no letter or digit in it is no longer a word a pack can hold.

- **Two different emoji were treated as the same clue.** Same root cause from
  the other side: 🎉 and 🔥 both normalise to nothing, so the second player to
  send one was told somebody had already said theirs. Where there is nothing
  to normalise, clues are compared as typed — so two emoji are two clues, and
  the same one twice is still a repeat.

- **The room top bar ran off the screen, taking the controls with it.** Once a
  game started the bar gained the room-code chip, and from 430px down it
  overran the viewport — and because the page clips horizontal overflow rather
  than scrolling it, the display and language pickers were not merely awkward
  to reach, they were gone for the rest of the game. German was worst: at
  320px both sat entirely off-screen. The bar wraps now, so whatever does not
  fit moves to a second row where it can still be tapped.

- **The display menu hung off the left edge of small phones.** Anchored to its
  own button and 288px wide at 320px of viewport, it started about 36px off
  the screen: "APPEARANCE" read "EARANCE", and three of the five theme chips
  lost their colour swatch. It is anchored to the bar instead below 440px, and
  the theme names no longer slice the last letter off "Mitternacht".

- **A German or Thai table opening a room got English words.** One-phone mode
  has always taken the word language from the interface language; a room did
  not, so a German table played a German game whose cards read "Civil
  servant". The host's own language now seeds the room, validated in the
  engine like any other setting.

- **The steal hand-off screen never said to tap it.** Passing a note to the
  hand-over card replaced the "tap when you are holding it" line rather than
  joining it, so the one screen that needed the instruction most was the one
  without it — the only other thing on screen is a link that ends the game. It
  says both now. The same card also stopped centring itself when a name had no
  space in it to break.

- **The lock-on ring on the verdict card was sliced flat** by the card's own
  overflow for the half second it played.

- **Smaller things.** Placeholders truncated mid-word at 320px now end in an
  ellipsis. The selected pill no longer pokes out of a segmented control that
  has wrapped onto two rows. The ten info dots in the settings keep their
  24px look and get a 44px touch target.

### Changed

- **The saved rooms file carries the version that wrote it.** Everything else
  the project saves already asked this — a resumed local round is dropped when
  the version moves, the pack shelf migrates between its own — but the room
  file did not, so a deploy that changed the shape of the state fed the old
  one straight into the new reducer for up to an hour. That is exactly the
  moment it matters, and it was the one place not checking.

- **`createServer()` loads the word packs itself.** It used to be done only
  when the server was started as the main module, so anything that imported
  it got a server that served the site perfectly and then failed every deal
  with "no word packs" — which is what both browser sweeps do, and part of why
  no room screen has ever been swept.

- **Rate limits reset between tests.** They are module state, so a suite that
  opens a room per test shares one allowance: the sixteenth test got a 429 and
  failed somewhere else entirely, looking like a bug in whatever it was
  actually checking.

### Added

- **Tests for every one of the above**, each one checked by putting the bug
  back and watching it fail: the seed replay attack, the parity scan across
  every table size, host hand-over in the lobby and mid-game, the kicked
  phone's stream and token, pack authorisation, the versioned store, the
  stale pack cache, the empty guess, the emoji clues, and a room's word
  language.

- **A test for `hintLine`**, which had none: it is reached through a `.jsx`
  barrel, so nothing `node --test` could load had ever imported it, and the
  coverage ratchet counted it as a file no test loads rather than as a gap.
  It is plain JavaScript and always was.

### Documentation

- **The README said rooms were memory-only, in two separate places,** while
  the server had been writing them to disk and reading them back since
  1.23.0. The feature worked; the documentation denied it existed. Neither
  `ROOM_STORE` nor `ROOM_RESTORE_MS` appeared anywhere, so an operator
  deploying this was never told that a file holding the word currently in
  play gets written next to their code. It is `0600` and git-ignored, and now
  it is also written down.

- **Five files the README told you to edit do not exist** — including both
  "add a language" and "add a theme", the two sections somebody would
  actually follow. Every path in the file now resolves.

- **A stale duplicate "Deploying the old way" section** removed, and the room
  code is described as four *characters*, which it is: the alphabet has digits
  in it and the length is configurable up to twelve.

- **This file now follows the format it claims to.** 1.27.0 was three
  releases stapled together under one heading — three `### Added`, three
  `### Changed`, two `### Fixed`. All 37 releases were checked; it was the
  only one.

## [1.27.0] — 2026-10-20


### Added

- **Three ways to play, as one row above the settings.** Quick, Careful or
  Chaos: one tap sets eight of the ten sections, and changing any of them
  afterwards simply puts the row back on "Yours". Nothing is stored and
  nothing is hidden — it is one `SET_CONFIG` with several keys in it, so a
  preset that stops matching a changed default stops being *selected* rather
  than being wrong. The word language and the packs are left alone, because
  those belong to the table rather than to how hard the round is.

  `chaos` failed its own test when first written: blind mode switches calling
  off, so the config that came back was not the config that went in and the
  row read "Yours" the moment you tapped it. The preset agrees with the
  engine now, and a test deals all three to make sure they still recognise
  themselves.
- **Tests for the settings** — 13 of them, against the arithmetic the panel
  stands for rather than the panel itself: that the imposter cap never
  reaches parity at any table size, that what the panel offers is what the
  engine accepts, that `random` stays inside the cap however the dice fall,
  that blind mode deals nobody a role, and that every single-key change the
  panel can send still deals a real game.
- **Layout baselines for every screen** (`src/testing/browser/layout.mjs`).
  `npm run screens` already visited every screen; now it also records where
  every laid-out element ended up and compares that with a committed
  baseline, so a cascade change that moves a card is reported in words —
  *"the language picker moved from x=252 to x=220"*.

  The plan asked for PNG baselines and that is not what this does, for a
  reason worth writing down: a PNG is not a picture of the layout, it is a
  picture of the layout *as rendered by one machine's fonts*. Committed, it
  would fail for everybody except whoever generated it, and a check that
  cries wolf gets deleted. So a PNG is still written every run for a person
  to look at (gitignored, 636 kB) and what is actually compared is text
  (28 kB, diffs line by line). A baseline records the browser and viewport it
  was taken with and skips rather than fails when those differ.
- **A sweep for rules that style nothing** (`checks/stylesheet-use.js`). The
  stylesheet grew by appending for twenty versions. It is deliberately
  generous — a class counts as rendered if the word appears anywhere in any
  source file, or if any template could build it — because the cost of a
  false "dead" is somebody deleting a rule a screen needed. Also checks that
  every animation named exists and every keyframes block is named by
  something.
- **A report of keys nothing asks for** (`src/i18n/dead.test.js`). The suite
  has always checked the other direction — a screen asking for a key nobody
  wrote, which shows a raw key on a card. This is the quiet one: a string that
  stays in all three tables after the screen that used it was rewritten.
  Nothing breaks, the tables just grow, and a translator sees more of the job
  than there is.

  The difficulty is that plenty of keys are never written down anywhere —
  they are built from a role id, an error code, a release number. Those are
  enumerated from the data that builds them, which has the useful side effect
  of failing when a family grows a member nobody wrote a string for.

  It found **seven dead keys**, 21 strings across the three languages. Four
  were `tip.roles`, `tip.scoring`, `tip.sees` and `tip.knows`, superseded by
  `tip.*Lead` variants and never removed; the others were `packs.mine`,
  `packs.none` and `settings.rolesHint`. All removed.
- **A translator's board at `#strings`** (`src/features/dev/StringBoard.jsx`).
  Every key, all three languages side by side, with filters for missing,
  still-English and placeholder trouble, and a search. The suite can tell you
  a key is missing; it cannot tell you whether the German is any good, and a
  translator cannot answer that from a failing test.

  Lazy-loaded, because it pulls in every language and putting it in the first
  download would undo the splitting from 1.25.0. It is a workbench reached by
  typing the hash on the end of the address, like `#icons`.

### Changed

- **The two workbenches are fetched only if somebody asks for them.** The
  icon sheet and the translator's board are reached by typing a hash on the
  end of the address and nothing links to either.

  The plan was to lazy-load five screens — the rules, the pack shelf and the
  changelog as well. Measured, that moved **2.1 kB** gzipped off the first
  load and turned 6 requests into 11, and five more round-trips on a cold
  connection cost more than two kilobytes save. They are thin screens over
  components the lobby already needs, so there was very little of them to
  move. Lazy-loading only the two boards is better on both counts:
  **117.9 kB in 6 requests → 113.8 kB in 5**.
- `.langpicker { gap: 5px }` in `motion.css` was being overridden by
  `screens.css` four imports later and had never had any effect. Removed,
  which also leaves the stylesheet with no selector setting the same property
  in two places across that boundary.
- The three comparison helpers moved from `testing/checks/strings.js` to
  `src/i18n/compare.js`, so the board can ask the same questions as the suite
  without importing a file that reads the filesystem. The checks re-export
  them, so they read unchanged.

### Fixed

- **Reduced motion now actually means reduced motion.** It was three
  hand-written lists of selectors with `animation: none !important` on them,
  and lists drift: of the 41 things that animated, **27 were in none of
  them** — including every icon animation added after the lists were written.
  Somebody who had asked their phone for stillness got it from fourteen of
  them and movement from the rest.

  Every animation is now inside one `@media (prefers-reduced-motion:
  no-preference)` block, so an animation that is not written in there does
  not exist and one that is cannot reach a reader who asked it not to. The
  lists are gone; what survives in the `reduce` blocks is only the handful of
  rules that put something *back* — see below.
- **Two icons were left half-drawn under reduced motion.** `.draw-on` and
  `.icon.anim .crack` are hidden at rest and drawn on by their animation, so
  gating the motion would have left a tick with no tick in it and a crack
  with no crack. They are finished rather than held at the start now, and
  confetti is explicitly absent rather than parked off-screen. A check in
  `styles.test.js` catches this whole class of thing: anything hidden at rest
  and animated into view has to have something putting it back.
- **One dead rule removed** (`.fade-in`, plus the keyframes only it used).
- **The checks were reading the project's own build output.** `sourceFiles`
  walked everything under the project root, which includes `dist` — every
  file in `src`, bundled into one line. For the name check that was merely
  slow and strange; for the string checks it was fatal to the point of the
  exercise, because the bundle contains every string table, so a key nothing
  asks for still appeared to be asked for. The dead-key report came back
  empty however much was dead. `dist`, `node_modules`, `coverage` and `.vite`
  are now excluded, which took the scan from 224 files to 141.
- **The comparison no longer reports Thai as missing its singulars.** Thai
  does not count its nouns, so `_one` does not exist in it — and `resolveKey`
  already knows, falling back to that language's own `_other` long before it
  reaches English. The first version of the board flagged ten keys for it,
  which would have sent a translator looking for something there is no way to
  write.

## [1.26.0] — 2026-10-19

### Fixed

- **A word typed without its accent now counts.** `normalise` folded the four
  German characters by hand and left every other accent alone, so a player who
  typed "Cafe", "Crepe" or "Pokemon" — which is what a plain keyboard gives
  you — was told they were wrong. In a round where calling the word can lose
  it, that is not a small thing. Accents now come off Latin letters generally.

  **Only Latin letters**, which is the whole difficulty: Thai vowels and tone
  marks are combining marks too, and stripping those would make ข้าวกล้อง
  (brown rice) the same string as ข้าวกล่อง (a lunchbox) and ถังขยะ (a bin)
  the same as ถุงขยะ (a bin bag) — the exact bug the old comment in that
  function warns about. Both are tested. Found while writing the linter
  below, which made the same mistake first and reported two perfectly good
  Thai pairs as broken.

### Added

- **Custom packs carry a version** (`PACK_VERSION`), and so does the shelf
  they are stored on. A pack written tonight is opened in six months on a
  build that has moved on, and until now nothing on it said which shape it
  was in — so the shape could not change without either guessing or quietly
  dropping somebody's work. A pack with no version is read as version 1 (the
  shape is identical), and the old bare-array shelf is still read, because
  that is what is on phones today.

  A pack from a *newer* build is read with the fields this one knows rather
  than refused: the name and the pairs have been there since the beginning,
  and throwing away somebody's words because they opened an older build is a
  worse answer than ignoring a field we have not heard of.
- **A linter for whether a pair is any good** (`src/content/words/lint.js`).
  The suite already checked that packs were the right *shape*; nothing
  checked whether a pair works at a table. It finds four things: a near miss
  that is the word (`Pizza / pizza`, `Café / Cafe`), a near miss that is the
  same word with an ending on it (`Horse / Horses`), a near miss that is
  somebody else's answer in the same pack, and a pack name that gives a word
  away in hint mode.

  It deliberately leaves close-but-different pairs alone — `Hotel / Hostel`,
  `Cocktail / Mocktail`, `Chiang Mai / Chiang Rai`, แพะ/แกะ — because being
  close is the entire point of a near miss. Run over all 3,000 shipped pairs
  it finds nothing, which is the right answer and a suspicious one, so most
  of its tests are deliberately bad packs and one holds the real ones to zero.
  The pack editor now shows the warnings next to the line they came from,
  which is where it actually earns its keep.

## [1.25.0] — 2026-10-19

### Changed

- **Each language is fetched instead of bundled.** Every phone used to
  download the word packs and interface strings for all three languages — more
  than half the JavaScript on the wire was for two languages nobody at the
  table was reading. The packs are now a chunk per language, and so are the
  Thai and German strings.

  Measured by building the same code both ways, everything else held equal:
  an English table goes from **179 kB to 125 kB** gzipped (−30%), a German one
  to 136 kB (−24%), a Thai one to 142 kB (−21%). Thai saves least because
  Thai is the biggest language and a Thai table still needs it.

  English stays bundled on purpose, because it is the fallback. If the
  fallback itself had to be fetched, every key in the app would resolve to its
  own raw name until it landed, and a cold start would paint a screen of
  `home.headline` and `lobby.deal`. The reader's own language is fetched
  before the first paint, so nobody sees a language they did not choose.

  The rules stay synchronous: the reducer deals the word and must not wait on
  a download, so loading is a registry the lobby fills *before* a deal rather
  than an async `packsFor`. The deal button says "Fetching the word packs…"
  for the moment that takes, which on a normal connection is shorter than
  typing in the last player's name.

### Fixed

- **A pool asked for too early poisoned the one asked for later.** `poolFor`
  caches the flattened word pool, which was free of consequences while the
  packs were static — the answer could not change while the app was running.
  Now it can, and the settings screen asks for a word count on every render,
  including the renders that happen while a language is still in the air. The
  first of those cached an **empty** pool under the key the deal would later
  use, so the words arrived, the button went green, and the deal failed with
  "no packs". The cache is cleared when a language lands, and an empty pool is
  never cached. Found by the browser sweep: every unit test had all three
  languages loaded before it started, so none of them could have seen it.
- **An unfetched language no longer falls back to English words.** `packsFor`
  fell back to English for any language with no packs, which was right when
  that meant "we do not ship it" and badly wrong when it could also mean "it
  has not arrived yet" — a Thai table would have been dealt English words with
  nothing on screen looking wrong until somebody read their card. Only a
  language the game has never heard of falls back now; one that is still
  loading is empty, and an empty pool is a refusal somebody can read.

### Added

- `src/testing/ready.js` — one import that waits for every language, so a test
  file starts with the whole set in memory. Twenty-one test files use it. The
  fingerprint refuses to run without it, since a fingerprint of a game with no
  words in it is a valid-looking hash of nothing.

### Changed (tooling)

- **Coverage counts anything that needs React as the browser sweeps' job**,
  not just `.jsx`. A hook is React too and often has no JSX in it —
  `useWords.js` and `useRoom.js` are both plain `.js`. Node can import them,
  so they were being counted and scored at zero; what Node cannot do is run an
  effect. Counting them meant a module got a worse score for growing a hook,
  which teaches the wrong lesson. `modes` reads 95% rather than 84% under the
  corrected rule — the same code, measured honestly.

## [1.24.0] — 2026-10-19

### Added

- **Rooms survive a restart** (`server/store.js`). Rooms lived in memory, so a
  deploy, a crash or a laptop lid took every game in progress with it, and the
  table found out when the next tap said the room did not exist. Every change
  is now written to one small JSON file and read back on boot. Verified the
  only way that counts: a real server killed with SIGTERM mid-round, a second
  process started on the same port, and the same room still there — same
  phase, same card, same players, with the phones' tokens still naming who
  they were, and a clue accepted straight afterwards.

  Only rooms touched in the last hour come back, since a file from yesterday
  would resurrect codes into a world that has moved on. Writes are coalesced
  and atomic (temp file plus rename), because a half-written file is worse
  than none — it is what makes the *next* start fail too. Listeners are not
  saved and cannot be; the phones reconnect by themselves, which is what
  EventSource already does. The file holds the word in play, so it is written
  owner-only and is in `.gitignore`. `ROOM_STORE=off` keeps nothing.
- **Rate limits** (`server/limits.js`). `POST /api/rooms` is an open endpoint
  that mints a room and holds it for hours, and the same build runs on a
  public URL as well as on a wifi. A sliding window now caps room creation and
  joins per caller and actions per token — per *token*, because everybody at a
  table shares one wifi and would otherwise share one allowance. Refusals are
  429 with `Retry-After` and a `tooMany` code the phone renders in its own
  language. A test plays three whole games with eight phones and double taps
  throughout to prove nobody is ever told to slow down for playing.

### Fixed

- **A phone with no token was told it was the host.** `isHost` was
  `playerId === room.hostId`, and on the one-shot reconnect endpoint both are
  `null` for a stranger — so anyone opening a room URL without a token was
  shown the host's controls. They could not use them, since every action is
  checked against the token on the way in, but being shown the controls for a
  game you are not in is its own kind of wrong. Found by writing the test that
  compares the two payload builders.
- **The first write to a new listener was unguarded.** Every other write to a
  socket was wrapped; this one threw out of the request handler instead of
  dropping the listener, if a phone died between being accepted and being
  written to.

### Changed

- **The broadcast builds the shared half once per room** instead of once per
  phone (`server/rooms.js`). Of what goes to a phone, 891 bytes are identical
  for everybody and about 134 are its own, and the shared part was being
  serialised once per listener on every action. It is now serialised once and
  spliced in as text — **1.8× faster at four phones, 2.4× at eight**, and the
  gain grows with the room. Every varying value still goes through
  `JSON.stringify`; only the braces are written by hand, and a test parses the
  result back and compares it with the object version, including names chosen
  to break naive escaping.

## [1.23.1] — 2026-10-17

### Fixed

- **A player who leaves the lobby no longer leaves their points behind.**
  Found by the new fuzzer on its first real run. `REMOVE_PLAYER` dropped the
  player and kept their entry in `scores`, and since ids are minted per
  player, adding the same person back gives them a new one — so the old score
  could never be reached again, only broadcast to every phone in the room and
  carried around for the rest of the evening. The fairness history
  (`lastImposters`, `imposterCounts`) and `lastWinners` had the same leak and
  are cleaned up with it.

### Added

- **Strict mode** (`src/core/strict.js`). The engine's first claim about
  itself is that it is pure; nothing enforced it. In development every state
  it hands out is now deep-frozen, so code that changes one in place throws on
  the line that did it rather than handing React a state it is certain has not
  changed — the kind of bug that surfaces three screens later in a component
  that did nothing wrong. On under `node --test` and `vite dev`, off in a
  build and on the server, and `IMPOSTER_STRICT=1` forces it either way. The
  whole suite passed the moment it was switched on, which is the answer to
  whether the engine was keeping its promise.
- **A fuzzer** (`src/core/fuzz.test.js`). Random action sequences checked
  against invariants rather than expected output: a refusal is always a
  `GameError` with a code and never a `TypeError`, every id in a state belongs
  to somebody at the table, nobody is eliminated twice or dealt two roles, a
  voted-out player cannot vote in a live tally, points never fall, a finished
  game stays finished, and a refused action leaves the state untouched.

  Its first version was useless and said so loudly: picking uniformly from
  every action, 300 runs reached **two phases and zero endings** and passed
  every assertion by never going anywhere. It now plays sensibly three times
  out of four and sends nonsense the rest of the time, which reaches all seven
  phases and six of the seven endings. A third test holds it to that, so it
  cannot quietly rot back.

### Changed

- **`publicState` is computed once per state** instead of once per phone
  (`src/core/select.js`). The server built a payload for every connected phone
  on every action, and each one scrubbed the same state again to produce the
  same 891 bytes. Keyed on the state object in a `WeakMap`, which is sound
  precisely because the engine never changes a state it has handed out — the
  promise strict mode now enforces. The scrub is **~70× faster** in a room of
  eight (0.70 → 0.01 µs per phone-action) and the whole broadcast path about
  **24% faster**; `JSON.stringify` still runs once per phone and dominates.
  The shared payload is frozen, since one copy now goes to everybody.

  The behaviour fingerprint across 400 games is byte-identical, which is how
  a change like this is allowed to be boring.

## [1.23.0] — 2026-10-17

### Fixed

- **A reload no longer ends the game.** The roster, the scores, the settings
  and the recent words all survived a reload; the round did not. A phone that
  slept too long during the clue phase, or a thumb that pulled to refresh,
  dropped the table back on the home screen with the cards gone — and at a
  table the only way out of that is to deal again and pretend the last ten
  minutes did not happen. The round is now written down after every action
  and offered back on the next load: *"You were in the middle of a game —
  carry on, or start again?"* Offered rather than restored, because somebody
  opening the game a week later to set up a new table does not want to be
  dropped into a stale round with last week's players in it. It is cleared
  when the game ends, and a round dealt by a different version of the game is
  dropped rather than resumed, since the rules may have moved underneath it.
  The home screen now looks for that round too — saving it was only half the
  fix, because a reload does not land on the screen that does the offering.

### Added

- **Tests for `modes/`**, which had 1,490 lines and none. The storage layer
  and the room client now have 43 between them, including a fake EventSource
  that opens, drops, reconnects and drops again, a stale token, a room that
  has been swept away, a malformed frame, and a private window that refuses
  to remember anything. Coverage of the module went from **0% to 85%**.

### Changed

- **One phase-to-screen map, shared by both modes** (`src/modes/screens.js`).
  Each mode used to keep its own `switch` over the phases, so a new phase was
  two edits and a fair chance of making only one: the game would work on one
  phone and fall through to a blank screen on everybody else's. A test now
  fails if either mode cannot draw every screen.
- **The room client is separate from the hook that uses it**
  (`src/modes/online/room.js`). Every door to the outside — fetch,
  EventSource, localStorage — takes the real thing by default and a fake on
  request, which is what made the tests above possible without a renderer.
- **The storage keys moved** out of `LocalGame.jsx` into `storage.js`. While
  they lived in a `.jsx` file, importing the storage layer meant importing a
  React component, and `node --test` cannot read one — which is most of why
  this module had no tests.

### Added (tooling)

- **One command that checks everything.** `npm run verify` runs the unit
  tests, the coverage floors, the build and both browser sweeps. Anything it
  cannot run — no dev dependencies, no browser installed — it skips out loud
  and says so in the summary, instead of printing green for a smaller check
  than you think you ran. The two browser harnesses now exit `2` rather than
  `1` when they cannot run at all, so a missing browser reads as a skip and a
  real failure still reads as a failure.
- **The behaviour fingerprint, in the repo.** 400 games played by a fixed
  script across every language, decoy mode and combination of roles, plus
  every word in every pack and every string in every language, hashed into
  one line (`src/testing/fingerprint.js`). The hash of a good run is committed
  beside it and checked by `npm test`. It proved the six-folder restructure
  changed nothing and then lived in a scratch folder ever since; the next
  refactor now has something to prove itself against. `npm run fingerprint
  -- --dump FILE` writes the lines out to diff, `-- --write` blesses a new
  hash after an intended change.
- **Coverage floors, per module.** `npm run coverage` reports line coverage
  per module against `src/testing/coverage.floors.json` and fails under it.
  A file no test ever loads counts as zero rather than disappearing from its
  own module's score, which is the whole point: `modes/` reads **0%** across
  1,490 lines, and the suite was green that entire time. `.jsx` is left out of
  the percentage rather than scored as zero, since `node --test` has no JSX
  transform — those are the browser sweeps' job — and the table says how many
  such lines each module has.
- **CI.** `.github/workflows/ci.yml` runs the tests on Node 20 and 22, the
  coverage floors once, and both browser sweeps against a real Chromium, on
  every push.

## [1.22.0] — 2026-10-07

### Added

- **An icon, for a phone.** Saved to a home screen the game showed a blank
  square with a letter in it. There was one SVG favicon, which iOS ignores
  completely — it reads `apple-touch-icon` and nothing else, not the SVG and
  not the manifest. There is now a 180px PNG for iOS, 192 and 512 for
  everything reading the manifest, a separate maskable drawing for Android,
  and a 32px PNG behind the SVG for browsers that will not take one.
- **It opens as an app.** A web app manifest with `display: standalone`, so
  the icon opens the game filling the screen rather than inside a browser
  with a URL bar across the top. The colour behind the splash is the game's
  own midnight, so it does not open on white and settle into the dark.
- **The icon is the game's own mark**, not a second drawing of it: the same
  spectacles under a hat brim as the top of every screen, with the colours
  written out and the blinking taken off — a home-screen icon that animates
  is a home-screen icon that costs battery. `npm run icons` redraws the PNGs
  from `public/icon.svg`, in a browser, so they look exactly as the mark
  looks in the game.
- **A separate drawing for Android**, which crops an icon to whatever shape
  the phone prefers and guarantees only the middle 80% survives. The mark is
  pulled in to sit inside that circle, rather than the plain icon being
  padded and hoped for.

### Fixed

- **The server served the manifest as `application/octet-stream`**, which a
  phone may decline to read at all. It is `application/manifest+json` now,
  which matters because the game is its own server when it is played over
  wifi.
- **The theme colour fell back to `#12101b`**, a colour from an older palette
  that nothing else in the game uses. It is the real background now.

### Notes

Five checks went in with it, because a missing icon is invisible from every
screen a developer looks at — the game had none for weeks and nothing said
so. They check that the iOS tag exists and points at a real square PNG of at
least 180px, that every file `index.html` names is actually shipped, that the
manifest has what a phone needs and opens standalone, that every icon it
promises is really a PNG of the size it claims, and that something is marked
maskable. Taking the tag out again fails the first; shipping a 32px file as
`icon-512.png` fails the fourth, by name and by size.

## [1.21.3] — 2026-09-29

### Added

- **`npm run endings`: all seven ways a game can end, played to the end.**
  The last crash was on the game-over screen, and "the game-over screen" is
  really seven screens — each ending draws its own icon, headline and
  sentence, and finding one of them working says nothing about the other six.

  Each route is steered to one ending and then checks the screen names that
  ending, so a harness that quietly reached "time" every round cannot report
  seven passes for one thing. There is an eighth route with no ending of its
  own: calling the word and being **wrong**, which puts the caller out and
  can hand the crew the win. That is the exact sequence from the crash report
  — `CALL_WORD → CONTINUE` — and it reaches the winners' screen by a road
  none of the other routes take.

  Putting the trophy bug back makes exactly two of the eight fail, which is
  the useful part: the trophy is only drawn on a crew win, so five of the
  endings never touch it. A sweep that had stopped at the first game-over
  screen it found would have passed.

### Notes

Four bugs in the harness had to be fixed before it could find anything, and
each was the harness quietly testing nothing:

- The reveal order is shuffled, so remembering who is who by position in a
  loop meant voting out the wrong player.
- A table of six is dealt two imposters, so catching "the imposter" ended
  nothing and the game played on to the clock.
- Voting out an imposter does not end a game while the steal is on — they get
  the phone and one last guess — so three endings reported that the game
  never ended.
- A role that is switched on without the switch taking means the whole run
  tests the default, so every setting is now read back after it is set. The
  jester also needed the card's label read case-insensitively, because the
  card is styled uppercase and the browser reports what is on the screen
  rather than what is in the string table.

## [1.21.2] — 2026-09-29

### Fixed

- **The game stopped at the moment somebody won.** `TrophyIcon` gives its
  clip path an id of its own with `useId`, and the import for it was left
  behind in another file when the icon set was split into groups in 1.20.0.
  The trophy is only ever drawn on the game-over screen, so the game played
  perfectly until the instant it was won.

### Changed

- **The check missed it, and now does not.** `cup-${useId()}` is a file
  calling a hook, and the scanner blanked the whole template literal,
  contents and all. It now keeps every `${…}` and blanks only the text
  around it — the same lesson as JSX prose, learnt again. A second, smaller
  hole went with it: `$` is a legal identifier character, so the scan read
  the `$` of `${useId()}` as a name and swallowed the boundary in front of
  the real one.

### Added

- **`npm run screens`: every screen in the game, drawn for real.** It deals a
  game, looks at every card, calls the word, votes somebody out, plays
  through to the end, and visits the icon sheet, the rules, the library and
  what's new — in all three languages — and fails if the browser throws once.

  Both crashes this week were a missing import, and both were invisible to
  every static check until it had been taught what to look for. The check in
  `src/testing/checks` needed five separate lessons about what is code and
  what only looks like it, and each lesson came from something it had already
  let through. This needs none: a missing import cannot hide from a screen
  that actually gets drawn. Reverting either fix makes it fail, by name.

  It is not part of `npm test` because it needs a browser and the game needs
  nothing but React. It refuses to run against a build older than the code,
  which caught its own author out within a minute of being written.

## [1.21.1] — 2026-09-29

### Fixed

- **The game stopped the moment anybody was voted out.** `Verdict.jsx` used
  `SPECIAL_ROLES` without importing it, so the verdict card threw a
  `ReferenceError` the first time a vote resolved. It was introduced when the
  components file was split in 1.20.0 and reached a real phone.

  It was found by the error screen added the day before, which is the first
  thing this release has to say for itself: the report named the file, the
  phase, and the nine actions leading up to it.

### Changed

- **The check that was supposed to catch that, now does.** It looked at what
  a file *called* and what it *rendered*, and `SPECIAL_ROLES.includes(role)`
  is neither — it is a property access on a name nobody handed the file. It
  now reports any name a file reaches for as a value and never receives.

  Widening it meant teaching it to tell code from everything that only looks
  like code, and each lesson came from a false report it made on the way:
  `[A-Za-z]` is not a file asking for `Za`; `\p{M}` is not asking for `M`;
  `{ LOBBY: 'lobby' }` is not asking for `LOBBY`; a barrel's
  `export { Shell } from …` is passing a name on, not reaching for one; and
  `<b>Thanate Amornjiraporn</b>` is a credit rather than two missing
  components. Strings, comments, template literals and regexes are now
  removed by one left-to-right scanner, because running replacements in
  sequence cannot lex JavaScript — strip strings first and a regex containing
  a quote falls apart, strip regexes first and a string containing a slash
  does.

  The last of those lessons is the reason prose between tags is not stripped
  at all. Every cheap way of finding the end of a tag swallowed real code,
  since `=>` ends in `>`. A name is judged by how it is used instead: a value
  is followed by something that does something to it, and the last word of a
  sentence is followed by another word.

### Added

- **Two tests of the check itself**, so narrowing it again fails here rather
  than at somebody's table: one file that uses a constant it never imported,
  and one that is nothing but the things which only look like missing names.

## [1.21.0] — 2026-09-29

### Added

- **A screen instead of a blank phone.** If a render throws, the game used to
  become white in the middle of a round and the evening was over. Now it says
  the game stopped, says it was not the player's fault, and offers to start
  again — in their language, in their colours.
- **A quiet line for the failures nobody sees.** An error boundary only
  catches what breaks while drawing; a rejected promise or a handler that
  throws on a tap leaves the screen looking fine and quietly not working.
  Those now get one dismissible line at the bottom, because a vote that never
  arrives is worse when the table has to guess why.
- **A report that can be handed over.** Version, mode, phase, how many were
  playing, the error, and the last dozen actions by name. One button copies
  it; another shows it for anyone without a clipboard.
- **`#crash`**, a route that breaks on purpose, so the error screen can be
  looked at on a real phone without waiting for a bug. Nothing links to it,
  like `#icons`.

### Notes

**A report never carries the word.** A crash mid-round is exactly when
somebody pastes a report into the group chat the other players are reading,
and a stack trace can quite reasonably contain the thing that was being drawn
when it broke. So whatever the game is currently keeping quiet — the word, the
near miss, and on a room's phone that player's own card — is taken out of
every part of a report: the message, the stack, and the description of where
it happened. Matching is case-insensitive and tolerant of whitespace, longest
secret first so one word inside another cannot leave half of itself behind,
with a floor of two characters because Thai words are short. Names are never
in a report at all, and the trail of what happened is action names only —
`SUBMIT_CLUE`, never the clue.

There is a test that deals a real game and asserts its real word cannot be
found anywhere in a report, and a browser test that fails a promise mid-round
with the word in the error and reads the report the player would send.

### Changed

- **What the app says about itself is merged, not replaced.** Startup knows
  the version, the language picker knows the language, a running game knows
  the phase, and none of them knows the others — so a single slot meant
  whoever spoke last erased the rest. A game that ends now also stops being
  described, so a report from the home screen no longer claims to be from
  round three.
- **The language in a report is read at startup**, not from the DOM. An error
  during the very first render happens before any effect has run, which is
  exactly the crash somebody sends a report about.
- **`where` and `mode` are separate lines.** A failed promise reported
  "promise" and never said whether it was one phone or a room.

## [1.20.1] — 2026-09-28

### Fixed

- **A stray `}` in the stylesheet stopped the build.** It closed nothing and
  had been sitting in the middle of `styles.css` for several versions.
  Browsers skip a closing brace that closes nothing, and so does esbuild, so
  the game looked right everywhere it was tried; Vite's CSS parser is stricter
  and refused. Splitting the stylesheet in 1.20.0 did not cause this — it
  moved the brace into a small file where the parser could name it.
- **`src/core/rules.js` no longer re-exports what belongs to `roles` and
  `scoring`.** Left over from the move, it gave four names two paths out of
  `core/engine.js`. Harmless in ESM, where an explicit export wins over a
  star, but ambiguous is ambiguous.

### Added

- **The stylesheet is now checked as a structure**, not only as a palette:
  every part balances its own braces, no part closes a block it did not open,
  every comment is closed, `index.css` lists exactly the files on disk, and
  nothing points at an asset a build cannot reach. Any one of these would have
  caught the stray brace on the day it was written.

## [1.20.0] — 2026-09-28

Nothing a player can see changed. This release is the shape of the code, which
had reached the point where every change meant scrolling through the same four
files: `components.jsx` was 1,967 lines, `engine.js` 1,097, `strings.js` 1,455
and `styles.css` 3,604.

### Changed

- **Six folders, each only knowing about the ones above it.** `core` is the
  rules and imports no React; `content` is the words and the history as data;
  `ui` is pieces that know nothing about the game; `features` are the pieces
  that do; `modes` wire them together for one phone or for a room; `server`
  is unchanged. 34 files became 109, and the largest hand-written one is now
  under 500 lines.
- **The rules no longer name a role.** The engine used to check for
  `ROLE.JESTER` and `ROLE.DETECTIVE` by name. Each optional role is now a file
  in `core/roles` saying which side it wins with, what its card shows beyond
  the word, anything extra it is dealt, and whether voting it out ends the
  game — and the engine reads those fields. There is a test that fails if a
  role's name reappears in the rules.
- **Every way of winning is one table.** `core/scoring` says who won, what it
  pays, and whether being voted out costs you your share. A test fails if an
  award is hard-coded anywhere else.
- **Where packs come from is a list.** `content/words/sources.js` holds the
  built-in packs and the ones a table writes; a third kind is a file and a
  line, and has to answer one question.
- **One file per language** for the interface strings, and the stylesheet is
  eleven layered parts imported in cascade order.

### Notes

A refactor is only worth doing if it can be shown to have changed nothing. Three
things stood in for that, and all three had to come back clean after every step:

- **The rules**: 400 games played end to end against fixed seeds across every
  combination of settings, plus every word, every string and every plural —
  23,413 lines, hashed. Byte-identical before and after.
- **The screens**: every element rendered on the home screen, the lobby with
  every setting switched on, and a dealt card, in all three languages — 1,769
  lines of DOM. Identical apart from the name on the first card, which is
  shuffled and differs between two runs of the same build.
- **The stylesheet**: every rule, in the same order, compared with comments and
  whitespace removed. Identical.

Two real bugs were found by the checks rather than by a player. A helper in the
pack search expected its caller to have lowercased the query, so a future call
with raw input would have quietly found nothing; each helper now normalises its
own. And the tool used to split the files read a full stop at the end of a
sentence in a comment as property access, which dropped two `useEffect`
imports — found by a pass over every file for names it uses but never gets.

## [1.19.0] — 2026-09-28

### Added

- **Every pack opens now.** A pack used to be a name on a chip: you turned
  ✈️ Travel & Transport on without ever seeing that it holds
  "Aeroplane → Helicopter". The library lists every pack for a word language
  and opens one at a time, with a search that runs across all of them at once
  and marks what it matched. Your own packs sit at the top with a pencil.
- **Copy a pack as a list.** The same format the editor takes, so ours is a
  starting point for yours: copy 🍜 Food & Drink, paste it into a new pack,
  cut the half nobody at your table would say, add the rest.
- **The library is reachable from where the question comes up** — the home
  screen, and the word-packs setting, where somebody is choosing what to deal
  from. In a room it is the host's shelf, because that is what the room deals
  from; a guest is not shown their own packs there as though they counted.
- **What's new, in the game.** A line or three per release about what is
  different at the table, in all three languages, newest first and the rest
  one tap away. The home screen carries a dot when there is something there
  that was not there last time, and the dot goes out on opening it.

### Notes

The player-facing history lives in `src/data/changelog.js` as versions and
note keys, with the sentences in `src/i18n/strings.js` beside every other
string in the app. This file stays as it is: it is written for whoever works
on the game and says which token was renamed, which is not what somebody
holding a phone wants to read. A test keeps the two in step — the top version
here has to be the one in `package.json`, and a note with no English sentence
fails the build.

The library does not select packs. Choosing what to deal from stays in the
settings next to the count of how many words that leaves, because those two
numbers only mean anything together.

## [1.18.0] — 2026-09-28

### Added

- **Write your own word packs.** The best words at any table are the ones
  nobody else could have written — the road they live on, the bar they argue
  about, the thing their friend says too often. Paste a list, one per line,
  name it, pick an icon, save it. It sits in the settings beside the built-in
  packs, with **Only mine** to play nothing but your own, because twelve taps
  to switch the others off is a chore rather than a setting.
- **A near miss is optional.** Write `Sushi, Sashimi` if you want the
  imposter to get a particular near miss; write `Sushi` and they get another
  word from your pack instead — same subject, same handwriting, still not the
  answer. Commas, semicolons, pipes, tabs and dashes all separate, because
  people paste out of notes apps and spreadsheets and each one has its own
  idea. Blank lines and anything after a `#` are ignored.
- **The editor shows what it understood** as you type: how many words, how
  many have a near miss, and every line it skipped with the line number and
  the reason — already in the pack, too long for a card, past the limit.
- **Share a pack as a code.** One string to paste into a message; whoever
  gets it pastes it into Add a pack and has your words. A six-word pack is
  about 130 characters. A code that arrives with line breaks in it, as they
  do out of chat apps, still loads.
- **Rooms deal from the host's packs.** Whoever opens the room sets the
  words, the same as every other setting.

### Notes

A word list is a list of candidate answers, so the words never leave the
device that wrote them except to the server that deals from them: every phone
is sent the pack's name, icon and size, and nothing else. There is a test that
plays a room from a custom pack and checks everything each guest's phone was
sent for the words in it.

Everything is re-validated on the way in — from storage, from a code, from the
network — because a pack that was written by an older version of the app, or
by somebody with the developer tools open, is not trustworthy input. A bad
pack costs you a pack, not the evening.

## [1.17.0] — 2026-09-27

### Added

- **The rules greet a first visit.** The same four steps the rules screen
  has, shown once over the home screen and then never again — because the
  people who need them are the ones who have just been handed a phone and
  told "your turn", and a party game explained by whoever brought it is a
  party game explained badly. Dismissing it remembers; the link on the home
  screen opens the rules again. Somebody arriving on a join link does not get
  it: they are being waved into a game that is already happening.

### Changed

- **The language picker is ours now.** It was a native `<select>`, which on a
  phone throws up the operating system's own wheel — a different shape, a
  different typeface and a different set of colours from everything around
  it, in the middle of a game. It is the same sheet the display menu uses, so
  the header behaves like one thing.
- **Tooltips are laid out rather than run together.** A setting with options
  now lists them — each option's name against what it does — instead of
  describing four of them in one paragraph you have to read twice to find the
  one you wanted. The option descriptions come from the strings the settings
  row already shows, so there is one copy of each. The two longest tips lost
  their walls of text: roles list the three roles, and scoring points at the
  table in the lobby rather than restating it.
- **A tooltip near the bottom opens upwards.** The last settings on a long
  lobby are close to the bottom of the screen, and a bubble that opens off
  the edge is worse than no bubble at all.

### Notes

The play-test and the interface sweep both know about the first-run dialog
now — the sweep looks at it as a screen like any other before dismissing it.

## [1.16.0] — 2026-09-27

### Changed

- **A win is paid by the road it took.** Running the rounds out is not the
  same as calling the word out loud in front of everybody, and it no longer
  pays the same:

  | How it was won | Points |
  |---|---|
  | Called the word mid-round | 3 |
  | Jester, voted out | 3 |
  | Caught them without losing anyone | 2 |
  | Took the table over | 2 |
  | Named it after being voted out | 2 |
  | Caught them | 1 |
  | Ran the rounds out | 1 |

  Which gives an imposter a reason to call rather than sit quiet, and a crew
  a reason to be careful rather than merely decisive. The numbers are one
  table in `src/game/engine.js`; change them there and the lobby, the
  scoreboard and the end of the game all follow.

### Added

- **A clean sweep is its own way of winning** — every imposter found without
  losing a single crew member — with its own ending and twice the points.
  Losing a sidekick along the way does not spoil it: the sidekick was never
  the crew's to lose.
- **The lobby lists what each win is worth** while scoring is on, because a
  rule that changes how people play has to be visible before they play. An
  imposter deciding whether to call needs to know it pays three.
- The mark on the scoreboard shows what was actually paid — +3 rather than a
  flat +1.

### Notes

The payout table has a test of its own that plays every road to victory and
checks each one pays what the table says, so changing a number tells you
which paths moved. The fuzz's ceiling now comes from the table rather than
being hard-coded at one.

## [1.15.0] — 2026-09-27

### Added

- **Three optional roles**, dealt on top of crew and imposter and chosen in
  the settings like any other rule:
  - **Detective** — crew, and told one player who is definitely not an
    imposter. The name they are handed is always ordinary crew: a sidekick is
    technically not an imposter, and clearing them would be true and useless.
  - **Sidekick** — holds the real word and sounds like crew, knows who the
    imposter is, and wins with them. They count towards the imposters taking
    the table over, which is one vote sooner than without them, but catching
    every imposter still wins it for the crew — a sidekick left over has
    nobody to win with.
  - **Jester** — holds the word and wins outright by getting voted out, which
    means the crew has to be *right* rather than merely decisive. A jester
    voted out ends the game there and is not offered a final guess.

  A role is only dealt while enough ordinary crew would be left, so a table of
  five takes two and a table of seven takes all three; too small and it is
  skipped silently, because announcing "no jester tonight" is itself a tell.
  Blind mode deals none of them: every one is something you are told about
  yourself, and that is the mode where nobody is told anything.
- **Keeping score**, off by default. A point to every crew member still in
  when the imposters are caught, a point to each imposter when they take it
  (whether or not they survived — they won), and a point to the jester alone
  when the jester wins. It carries across games for the night, shows in the
  lobby and at the end with a mark against whoever just scored, and is cleared
  by hand. In a room only the host can clear it.
- The verdict names a special role rather than calling it crew, the final
  table shows who was quietly what, and the jester gets their own ending —
  with confetti, because winning by losing is still winning.
- Icons for the three roles and for the scoreboard, each with its own
  movement, on the sheet at `#icons`.

### Changed

- **Pass-and-play now remembers the settings**, not just the roster and the
  recent words. Handing back the word packs, rules, roles and scoring because
  somebody pulled to refresh is its own small betrayal — and it took the
  scoreboard with it, since the board only shows when scoring is on. Saved
  settings go back through the reducer, which validates every value, so a
  stale entry cannot deal a broken game.

### Fixed

- **Who was dealt what was being broadcast to every phone.** The role map and
  the detective's cleared name went out with the rest of the room state, so a
  curious player could read where the jester was sitting. Both are scrubbed
  until the game is over, like the word and the imposters before them.
- A translated string that wrapped a value in bold twice printed the markup
  as text. The markup helper now collapses the nesting and strips any tag it
  does not understand — a player should never read a bold tag.

### Notes

The fuzz now deals roles and keeps score: two thousand games across every
combination, asserting that roles go to distinct people who are not imposters,
that enough ordinary crew is always left, that the role map never reaches the
broadcast, that a jester only wins after being voted out, that a score only
ever goes up and only when a game ends, and that the side that was paid is the
side that won.

## [1.14.0] — 2026-09-27

### Added

- **`render.yaml`**, so a host that can actually run rooms configures itself
  from the repository. Netlify and friends serve files and nothing else,
  which covers passing one phone around but never rooms.
- **`npm start`**, because that is the command hosting platforms run by
  default, and an `engines` field so they pick a Node that works.
- **`ROOM_CODE_LENGTH`**, from 4 to 12. Four characters is right across a
  table: it gets read out loud, and on one wifi nobody else can reach the
  server anyway. A deployment on the open internet has a public address and a
  four-character code is short enough to stumble into, so `render.yaml` asks
  for six. The health endpoint reports the length and the join box takes what
  it is given, rather than both ends assuming four.

## [1.13.1] — 2026-09-27

### Added

- **`Play Imposter.command` and `Play Imposter.bat`** — double-click to play.
  They install what is missing on the first run, build, start the server and
  open the browser, so a party night needs no terminal and no typing. If
  Node.js is not installed they say so and where to get it, rather than
  failing with a message about a command not found.

## [1.13.0] — 2026-09-27

### Added

- **Light, dark, or whatever the phone says.** System is the default and
  means *keep* following the phone: one that turns dark at sunset takes the
  game with it mid-round, without anyone touching anything. The choice lives
  on the device and is remembered there — the host does not get to decide what
  everyone else's screen looks like, any more than they pick everyone's
  interface language.
- **Five sets of colours** — Midnight, Ember, Forest, Ocean and Slate — each
  drawn for both modes, chosen from a menu in the header.
- `src/ui/themes.js` for what is on offer and `src/ui/theme.jsx` for the
  provider that resolves it, saves it, follows the system when asked, and
  keeps the browser's own chrome colour in step with the page.

### Changed

- **The stylesheet no longer contains a colour.** Every literal became a
  token: the washes, hairlines and shadows now belong to the mode — dark lifts
  a surface with white, light settles it with black — and the ten palettes
  belong to the themes. The glows are mixed from the accent rather than
  repeating its hex.
- **`--accent-text` joins `--accent`.** A fill can be bright because the label
  on it is chosen to suit; the same colour as *text* on a plain surface is a
  different problem, and on white a bright amber simply cannot be read. Words,
  icons and hairlines take the readable one.
- The wordmark steps aside under 380px, which is what makes room for both
  header controls on the narrowest phones.

### Fixed

- **The display menu opened behind the page.** Every child of the shell
  carries the screen-in animation, and an element with a filling transform
  animation is its own stacking context painted in document order — so the
  hero below covered anything the header opened. The menu was there, and
  unclickable.

### Notes

The palettes are generated and contrast-checked rather than picked by eye, and
`src/ui/theme.test.js` holds the rules: every palette declares every token,
every text colour clears 4.5:1 on every surface it can land on, every label
clears its fill, light is light and dark is dark. Ten palettes were also
driven through a complete game in the browser — no contrast failures and no
errors on any screen.

## [1.12.1] — 2026-09-26

A check-and-debug pass: an audit of the strings and the word packs, a harder
fuzz of the rules, and a sweep of every screen at 320px in all three
languages. Five real defects, and the tests that would have caught each.

### Fixed

- **Thai read English whenever a count was exactly 1.** "1 vote", "1 more
  player needed", "Waiting for 1 player" — all in English, mid-Thai sentence.
  Thai declares no `_one` plural form, and the lookup asked "does `_one` exist
  here **or in English**?", which is true of every plural key there is. So it
  resolved to a key Thai does not have and fell back to the English sentence.
  English is the last resort now, not a tiebreaker between two forms of the
  same language.
- **Faint text failed contrast at body size** — 3.09:1 on a card where 4.5:1
  is the floor. It carries most of the hints, the round labels and the
  settings descriptions. Lifted to a value that clears 4.5:1 on every surface
  in the set.
- **The verdict card could drag the page sideways.** It lands with a scale,
  which on a 320px phone made it wider than the viewport, and the page
  scrolled horizontally for the length of the animation. The scale is gentler
  and the page clips horizontal overflow.
- **Nonsense settings were accepted.** `maxRounds: "lots"` compares false
  against every number, so it silently turned the round limit off and would
  have printed "Round 1 of lots" on every phone. Settings arrive over the
  network from whichever phone is hosting, so every value is now checked in
  the engine, where the rules live — an unrecognised one falls back to the
  default rather than travelling on into the deal.
- The information dot was 22px square, under the 24px a control has to be.

### Added

- `src/i18n/translate.js` — the lookup lifted out of the React module so it
  can be tested, with nine tests over it: key parity across the three
  languages, placeholders that must survive translation, and a count of one
  answered in the reader's own language.
- A second fuzz test: two thousand games across every combination of settings
  — blind, hint, way off, calling, final guesses, unlimited rounds, a hidden
  count, one pack or ten, three languages — asserting the invariants rather
  than only that it finishes. No imposter is ever shown the word, the word
  never reaches the broadcast, nobody is eliminated twice, no round runs past
  the limit, and every card names the same pack. It also checks each branch
  actually ran, so the test cannot quietly weaken.
- Tests that a refused action leaves the game untouched, and that the same
  seed and actions always give the same game.
- A server test for malformed requests: bad JSON, an oversized body, missing
  tokens, unknown actions, junk settings. The server refuses each one, stays
  up, and keeps the room.

### Removed

- Three strings nothing rendered, in all three languages.

## [1.12.0] — 2026-09-26

### Added

- **Every card names the pack its word came from**, under the word: a chip
  reading "🗺️ Places" or "🍜 Food & Drink", in the language the words are in.
  It is also in the round header while the clues go round, since by then the
  cards are face down and the category is the thing everybody is trying to
  hold on to.
- The end-of-game reveal names the pack beside the word too.

### Notes

The pack is the same on every card, an imposter's included, and it is always
the pack the **real** word came from. A "way off" decoy is pulled from a
different pack on purpose, so naming the decoy's pack would put a different
category on one phone and quietly break the game. Knowing the category is
what makes a one-word clue mean anything; the word is the secret, not the
frame around it. Nothing new is exposed by this — `packId` was already in the
state broadcast to every phone; it simply was not shown to anyone.

## [1.11.0] — 2026-09-26

The icon set gone through one at a time, against the usual rules for a 24px
stroke set: everything inside a 20×20 live area with the outer 2 clear, sized
by keyline rather than bounding box, one stroke weight, one cap, and no gap
between strokes narrower than the stroke.

### Changed

- **The hand has four fingers and a thumb.** It had three, which is the kind
  of thing that looks wrong before you can say why.
- **A hint is a bulb.** It was a card with two lines on it — the card-back
  icon with one line fewer, so the two read as the same object.
- **A wrong call is a cracked shield.** The crack stopped short at both ends
  and was drawn at bolt width, which made it a lightning bolt: the sign for
  power, not for damage. It now runs the full height.
- **Nine icons were off their marks** and have been redrawn: the hand sat
  1.4 left of centre, the bell 1 high, the trophy's shine was not clipped to
  the cup, the eye and the wifi ran past the live area, the tick was small
  enough to look like a different set, and the hourglass was the narrowest
  thing in the set by a wide margin.
- The trophy's clip now gets an id of its own per instance.
- The eye's lash line is hidden in the markup rather than only by the
  stylesheet, so a missing stylesheet cannot draw a line through the open eye.

### Added

- **Motion for each icon, and it is what that object does.** The bell swings
  from its crown with the clapper lagging behind, the hand waves from the
  wrist, the die rolls a quarter turn and lands, the scales rock and settle
  level, the hourglass gets turned over and then waits, a shine crosses the
  trophy, the globe's meridian flattens as it turns, the top sheet lifts off
  the copy icon, the wifi arcs go out from the dot in turn, the bulb comes on,
  the rings close on the target, the crack opens down the shield. Nothing is
  a spinner, and nothing is a generic pulse.
- **`anim`, an opt-in flag on every icon.** Motion is off by default and each
  place that uses an icon decides, so the same drawing can sit still in a list
  and move on the card where it is the subject. One-shots land in 150–400ms;
  loops are mostly rest with a short event every few seconds, so none of them
  read as progress indicators. All of it stops under `prefers-reduced-motion`,
  with anything invisible at rest made visible instead of simply frozen.
- **An icon sheet at `#icons`** — every icon at 64, 30, 20 and 16px with its
  motion running, what it is for, and what the motion is. Nothing links to it.
  Motion cannot be reviewed in a screenshot, and a set drifts unless one page
  shows the whole of it.

## [1.10.1] — 2026-09-26

### Fixed

- **The raised hand was a tangle.** Each finger was drawn as its own column
  over a palm outline that redrew one of them somewhere else, so two fingers
  crossed. It is now two paths: one long one running from the little finger
  around the palm and the thumb and back up the index finger, plus the middle
  finger — fingers side by side, no stroke drawn twice.

### Removed

- Two icons nothing used: the hush face (all but identical to the shrug) and
  the clock.

## [1.10.0] — 2026-09-26

Motion during a game, where before it was mostly at the edges.

### Added

- **Blinking.** The imposter's mask has a pair of eyes behind it now, and they
  blink — a blink every few seconds on a long, uneven cycle, sometimes a
  double. The eye on the card you are holding open blinks too, shutting on a
  lash line rather than fading out, and so do the two round faces (the hush
  and the shrug). Faces on screen together are deliberately out of step: a
  room of things blinking in unison reads as a loading state, not as life.
- **The crew tick draws itself on** when the card turns over, instead of
  arriving already ticked — the card says "you're clear" as a small event.
- **The role badge swings in and the word lands after it**, so the card turns,
  then reads, in that order.
- **Whose turn it is pulses.** The speaking-order chip for the current player
  carries a slow pip, which says "you" without another label.
- **The clock looks like it is running** — the colon blinks on the second
  while the timer is going, and stops dead when it is paused.
- **Votes arrive one at a time.** Each tick pops in the moment that phone's
  vote lands and the row lifts with it, so the shared screen shows progress
  without ever showing who anyone voted for. The tally bars then fill from
  nothing, longest first.
- **The verdict lands differently depending on the news.** Catching an
  imposter sends a ring out from the target; losing one of your own knocks the
  card sideways.
- Pressing a vote or a setting dips it, so a tap on a phone feels answered.

### Removed

- Dead CSS for the hold-to-open bar that the ring replaced in 1.8.0.

### Notes

Every loop above is switched off under `prefers-reduced-motion`, including the
blinking, and the tick is simply drawn.

## [1.9.0] — 2026-09-26

### Added

- **The setting pills slide.** Choosing an option moves a single highlight to
  it — across a row, and down to the next line on the rows that wrap — instead
  of one pill blinking off while another blinks on. The block is measured from
  whichever button is pressed, so it follows labels of any length in any of
  the three languages, and it re-measures when the interface language changes
  or the phone is turned. The buttons underneath are unchanged: still plain
  buttons carrying `aria-pressed`, still tabbable, and they paint their own
  highlight until the first measurement lands, so nothing depends on the
  script having run. Pressing one dips it slightly.

### Changed

- **Thai roles renamed.** The imposter is now **สายลับ** and the crew are
  **ชาวบ้าน**, the words Thai players actually use at the table, in place of
  the literal ตัวปลอม and ลูกเรือ. A Thai word pair whose decoy was สายลับ
  became ตำรวจนอกเครื่องแบบ, so no card can read like a role.

### Fixed

- **Ending a game no longer clears the table.** "End this game" dropped every
  player, so the names had to be typed in again — and because each player is
  given a fresh id when added, the fairness history pointed at people who no
  longer existed. The rotation quietly started over: the same person could be
  the imposter twice running, which is the one thing it exists to prevent.
  The lobby now keeps the same people, and only "Remove" takes anyone out.
  Found by the browser play-test, and now covered by a test that deals 200
  games ending each one.

## [1.8.0] — 2026-09-26

A visual pass. Nothing about the rules changed.

### Added

- **Made by Thanate Amornjiraporn (Focus)** — on the home screen and at the
  foot of the rules, translated into all three languages.
- **A drawn icon set.** Every emoji the interface used as furniture is now
  inline SVG on a 24×24 grid, painted with `currentColor` so each icon takes
  the colour of whatever it sits in. Emoji render as a different face, weight
  and sometimes a different meaning on every phone, which is fine in a message
  and wrong in a product. Word-pack labels keep their emoji: those are
  content, not chrome.
- **A brand mark** — a fedora over round spectacles — that blinks on a long,
  uneven cycle and catches a glint across its lenses. Uneven on purpose: a
  steady blink reads as a loading spinner.
- **A hold-to-open ring.** The progress indicator moved from a bar at the foot
  of the card to a ring closing around the icon in the middle. It sits where
  the thumb already is, so you can see how much is left without looking away
  from the card.
- **Confetti on a crew win** — twelve pieces on fixed paths rather than a
  physics loop, so it plays once and cannot still be running behind the next
  screen.
- **A drifting backdrop**: two large, heavily blurred shapes moving slowly
  behind everything, so a long dark page does not feel flat.
- Motion on the small things: the pass icon nudges, the call bell rings, the
  hourglass breathes, mode cards catch a sheen, and each screen arrives rather
  than appearing.

### Changed

- The home screen leads with the mark and gives each mode an icon tile.
- Cards carry depth, and a revealed card glows faintly in its own colour —
  green for crew, red for an imposter.
- The face-down card has a woven texture so it reads as a card back.
- A revealed card now shows its role as an icon as well as a label.

### Fixed

- The old progress bar was still drawing underneath the new ring. Two answers
  to the same question; the bar is gone.

### Notes

- Every bit of the new motion is decoration on a layout that already worked,
  so the `prefers-reduced-motion` block switches all of it off — the drift,
  the blink, the confetti, the screen transitions — without anything losing
  its meaning.

## [1.7.0] — 2026-09-26

Dealing is no longer a fresh coin toss every game. The table now remembers
what it has already had.

### Changed

- **The same person is never the imposter twice running.** With five players
  a uniform draw makes that happen one game in five — measured over 500 deals
  it happened 96 times — and it reads as a bug rather than as luck. Anyone who
  was an imposter last game is not eligible this game.
- **The role is shared out.** Among the eligible, a player who has been
  imposter less often is weighted higher. Over 500 games the gap between the
  player who got the most turns and the least fell from 29 to 9.

  The weighting is deliberately soft rather than a strict "whoever is furthest
  behind is next". Strict fairness is predictable, and in a hidden-role game a
  player who can work out their own role from the selection rule has been
  handed the answer. A test asserts the player who is furthest behind is
  favoured but never a certainty.
- **The same word is never dealt twice running, and does not come back for a
  long while.** The table remembers the last 40 words, or half the pool if the
  selection is smaller. Playing a single 100-word pack, the closest a word
  came back to itself went from 1 game to 41.
- **Recent words survive a reload** in one-phone mode, so closing the tab and
  coming back does not hand you the word you just played. Only the words are
  stored: the fairness counts are keyed by player id, and ids are minted fresh
  on each load, so storing them would be storing nonsense.
- History travels with the players through "Play again" and through ending a
  game, since it is the same table either way.

### Security

- The deal history is **stripped** from the broadcast state rather than
  nulled, because the word currently in play sits at the front of it. Nulling
  named fields one at a time is how a secret eventually escapes; removing the
  whole object cannot miss one. There are tests on both sides asserting the
  word in play appears nowhere in a client payload.

### Notes

- One thing this leaks, by design and as requested: last round's imposter
  knows they are not it this round. That is the unavoidable cost of the
  no-repeat rule. If a group would rather keep the uncertainty, deleting the
  `justWas` exclusion in `pickImposters` restores it while keeping the
  even spread.

## [1.6.0] — 2026-09-25

### Added

- **3,000 word pairs — ten packs of a hundred in every language**, up from
  roughly 120 each. English, Thai and German each get 1,000 pairs across ten
  packs, written natively rather than translated.
- **New packs.** English adds Travel & Transport and Music & Sound; Thai adds
  อาชีพ, การเดินทาง and โรงเรียนกับที่ทำงาน; German adds Berufe, Reisen &
  Verkehr and Musik. Every existing pack grew to 100 pairs.
- **The test suite now validates the word packs**: ten packs of a hundred per
  language, no word dealt twice within a language, no word equal to its own
  decoy, no empty sides, and every pair carrying the hint line its pack
  promises. Adding words is now checked by `npm test` rather than by eye.

### Fixed

- **Thai vowel and tone marks were being stripped when comparing words.**
  `\p{L}` does not cover Unicode category Mn, which is how Thai writes its
  vowels and tone marks, so the game could not tell ข้าวกล้อง (brown rice)
  from ข้าวกล่อง (a lunchbox), or ถังขยะ (a bin) from ถุงขยะ (a bin bag).

  That had two live consequences in Thai: a wrong final guess could win the
  game, and the no-repeated-clues rule rejected perfectly good clues. The
  comparison now keeps marks as well as letters and digits. The regression
  test asserts unconditionally rather than skipping when a word happens to
  have no marks, which is why the old test missed it.

  It surfaced because the pack validator, using a different rule, flagged the
  two Thai words as duplicates when they are nothing alike.

### Changed

- `poolFor` caches by language and pack selection. A full pool is a thousand
  objects and the settings screen asks for the count on every render, so it
  was rebuilding that list constantly for an answer that cannot change.
- Twenty words that appeared in two packs at once were renamed, so each word
  is dealt from exactly one pack — "Mouse" is now the animal, with the
  desk one becoming "Computer mouse".
- The settings rows fit five short options on one line again, so the
  unlimited-rounds ∞ no longer wraps onto a line of its own.

## [1.5.1] — 2026-09-25

A copy pass over the Thai and German, which had been reading like
translations rather than like a game.

### Fixed

- **German, unlimited rounds** said the game runs "bis die Falschspieler
  **dran sind**" — until it is the imposters' *turn*, not until they are
  caught. Now "enttarnt sind".
- **German, the rules screen** opened with "Die Crew sieht alle dasselbe
  geheime Wort", which parses as "the crew sees everyone". *Crew* is singular
  and cannot take a plural *alle* like that. Now "Alle in der Crew sehen
  dasselbe geheime Wort."
- **German verdicts assumed the player was male** — "Er war ein
  Falschspieler". The pronoun is gone entirely: "War ein Falschspieler."
  Same for the crew line and the imposter-knows setting.
- **German singular and plural were identical** where they should not be:
  "Noch 1 Mitspieler nötig" is now "Es fehlt noch einer", and the waiting
  line reads "Warte noch auf einen" rather than "Warte auf 1 Mitspieler".
- **"Hinzu" as a button label** is not something German says. Now
  "Hinzufügen".

### Changed

- **Thai passives removed.** `ถูก`-constructions are stiff in interface copy:
  "รอบนี้จะถูกทิ้ง" became "รอบนี้จะหายไปเลย", and "คะแนนจะถูกซ่อนไว้" became
  "จะยังไม่เห็นคะแนน".
- **Thai calque fixed.** "What they said before is still on the table" had
  been rendered literally as "ยังอยู่บนโต๊ะ", which means an object is
  physically on a table. Now "ของเดิมที่พูดไปแล้วยังนับอยู่".
- Repetition and stiffness throughout the Thai: "นับสามพร้อมกัน ทุกคนชี้พร้อมกัน"
  used the same word twice in one line; "ต้องการอีก {count} คน" was
  transactional where "ยังขาดอีก {count} คน" is how you would say it.
- German phrasing loosened where it was written rather than spoken: "laut
  ausgesprochen" → "laut gesagt", "Von drei runterzählen" → "Bis drei
  zählen", "Deine Stimme, sonst niemandes" → "Deine Stimme — niemand sonst
  sieht sie".

### Notes

- Neither language is written by a native speaker. This pass fixes what is
  demonstrably wrong and what reads as translated; a native read-through
  before a real party is still worth doing, particularly for the Thai word
  packs, where how close a decoy sits to its word decides how the game
  plays.

## [1.5.0] — 2026-09-25

The round is now the unit the game is built on: each round, everyone still in
gives **one more clue** on top of the ones they have already given, and then
the table votes again.

### Added

- **A Rounds setting** — 2, 3, 4, 5 or **∞**. Until now this was fixed at four
  and there was no way to change it, so a game could end with "the crew ran
  out of rounds" for no reason anyone at the table chose.
- **Unlimited rounds.** There is no clock at all: the game ends when the
  imposters are caught or when they reach parity with the crew, and nothing
  else. The round counter shows "Round 3" rather than "Round 3 of 4", because
  there is nothing to count down to.
- **A clue grid.** From round two onwards, the clue list becomes a table —
  one row per player, one column per round. What you actually want to compare
  is what somebody said the first time against what they said the second, and
  a flat list of chips buries that. The current round is highlighted and
  eliminated players are struck through but still shown, because what they
  said before they went still counts as evidence.
- The grid appears on the voting screen too, which is where the comparison
  matters most.

### Changed

- Round two onwards opens with a line explaining what is happening: "One more
  clue each. What they said before is still on the table."

### Notes

- Unlimited games end on eliminations, and a table that ties its vote every
  single round never eliminates anyone. There is therefore a hard backstop at
  20 rounds so that "every game terminates" stays a property the tests can
  check. No real game will come close; a test plays a permanently-tied
  unlimited game to prove the backstop works.

## [1.4.0] — 2026-09-25

### Added

- **Hint mode** — a fourth thing the imposter can be shown. Instead of a fake
  word they get a description of the real one: what kind of thing it is, and
  how long it is. *"A job someone does · 9 characters."* No word to be trapped
  by, but no cover either — the hardest part is sounding specific about
  something you cannot name.

  It sits between the existing modes in difficulty: kinder than Blank, because
  you have something to aim at, and fairer than Way off, which actively
  misleads you.

  The category line lives on the word pack, so it is written in the language
  the words are in, while the shape is phrased in whatever language the reader
  is using. A pair can override its pack's line with a sharper one of its own;
  nothing in the packs does yet, and `poolFor` falls back to the pack's line.

- Every pack in all three languages now carries a category line.

### Changed

- Blind mode locks out hint mode as well as blank, for the same reason: a card
  holding a description rather than a word would identify the imposter at a
  glance. The two telltale modes are now named in one place in the engine
  rather than checked for individually.
- The end-of-game recap reports the hint the imposter was working from, the
  same way it already reported their decoy word.

### Notes

- Characters are counted as everything that is not a space, rather than as
  "letters". Thai writes its vowels and tone marks as separate code points, so
  a letters-only count would report a number no Thai player would recognise as
  the length of the word in front of them. There is a test asserting the count
  matches what a player actually sees, in all three languages.

## [1.3.0] — 2026-09-25

### Added

- **Blind mode** (`Imposter knows: Told / Blind`). With it off, nobody is told
  anything. Everyone simply gets a word, most of you have the same one, and
  the imposter gives honest clues about the wrong word without knowing they
  are the odd one out — so they find out at the same time everyone else does.
  This changes the game more than any other setting: there is no hiding,
  only being out of step.

  It also rules out two things that would give it away, and the lobby now
  shows the corrected settings rather than quietly overriding them at the
  deal:

  - A **blank card** would identify the imposter the instant they looked at
    it, so blind mode always deals a decoy.
  - **Calling the word** makes no sense when you do not know whether your own
    word is the odd one, and a button only imposters could see would give
    them away — so calling is switched off.

- **Tooltips on every setting**, explaining the trade-off rather than
  repeating the label. Tap to open (this is a phone game, hover does not
  exist), close on Escape or a tap outside, and tied to their button with
  `aria-describedby` so a screen reader reads the explanation.
- **Animation pass**: the role card turns over instead of fading, lists
  arrive one item at a time, the verdict lands with a stamp, a win gets a
  beat of celebration, and the talking timer starts ticking under ten
  seconds. All of it sits on top of a layout that already works, so
  `prefers-reduced-motion` switches every bit of it off without changing what
  anything means.

### Changed

- The final guess is now offered to whoever was actually voted out rather
  than keyed off their role, which is what makes it work in blind mode: that
  player has only just found out they were the imposter.
- The phase stepper shows the current step's full name instead of truncating
  it to "CAR…".

### Fixed

- Tooltips inside a settings row anchor to the row rather than to the ⓘ
  itself, which sits mid-sentence — they were hanging off the edge of a
  narrow phone. The row is also lifted while its bubble is open, since each
  row makes its own stacking context and later rows painted over it.

## [1.2.0] — 2026-09-25

Four rule changes, all of them optional and all of them off a switch in the
lobby.

### Added

- **Three things the imposter can be shown**, replacing the old on/off decoy:
  **blank** (nothing at all, hardest), **near miss** (the pair's decoy, easy to
  bluff with) and **way off** — a real word pulled from a different pack
  entirely. Way off is the interesting one: the imposter has a word, it just
  points nowhere near the truth, so a confident clue is a confident lie.
- **Calling the word mid-round.** An imposter who is sure declares it out loud
  and names the word. Right, and the imposters win on the spot — the only way
  to win without surviving to the end. Wrong, and that imposter is out and the
  round carries on, so a partner is not punished for someone else's nerve.
- **Auto and hidden-random imposter counts.** `Auto` scales with the table —
  one imposter up to five players, two up to eight, three beyond — and says so
  in the lobby. `?` rolls the number in secret each round and tells nobody, so
  catching one imposter no longer means the game is over. The host can still
  pin a fixed number.

### Changed

- **Any imposter voted out now gets the final guess**, not only the last one
  standing. Getting it right wins the whole game even with a partner still in
  play, which keeps a correct vote from feeling safe. An imposter who called
  the word and missed does not get a second go.
- A wrong final guess no longer ends the game; the round simply carries on
  from where it was.
- The how-to-play screen covers both new win conditions, in all three
  languages.

### Security

- The resolved imposter count is deliberately never written back into the game
  config, because the config is public. On `random` the number exists only in
  the hidden role list, so there is nothing in the payload to count. There is a
  server test that asserts this.
- The final guess is bound to the player who was actually voted out, rather
  than to "any imposter".

## [1.1.0] — 2026-09-25

### Added

- **Three languages: English, Thai and German.** The interface language is a
  per-device choice and the language the secret words come from belongs to the
  game, set by whoever is hosting. At one table a Thai speaker and a German
  speaker can each read the buttons in their own language while guessing the
  same word.
- **Word packs written natively per language**, not translated. The Thai packs
  argue about ผัดไทย and สงกรานต์; the German ones about Spätzle and
  Schützenfest. 118 words in Thai, 118 in German and 134 in English, across seven
  or eight packs each.
- **Rule violations are error codes rather than English sentences**, so each
  player is told why a move was refused in their own language.
- **Repeating a clue is now against the rules** and the game enforces it,
  rather than leaving it to whoever at the table is loudest.
- **Hold-to-reveal.** Opening a card takes a deliberate press-and-hold with a
  progress bar instead of a tap. A stray tap while a phone is being passed
  around used to show someone else's card, which is the one mistake this game
  cannot recover from.
- **A phase stepper** across the top, so anyone picking the phone up mid-round
  can see whether it is cards, clues, voting or the result.
- **Live vote progress** in LAN games: every phone shows who has voted, never
  what they voted for, so the table knows who it is waiting on.
- **A confirmation before ending a game**, since it throws away a round
  everyone is in the middle of.
- **Keyboard and screen-reader support**: visible focus rings, phase changes
  announced politely, and the hold card also opens on Enter or Space.
- **A layout for bigger screens**, since this gets played on a laptop propped
  up on the table, and one for a phone held in landscape.

### Changed

- Thai typography: a Thai-first font stack, looser line height and no
  tightened letter-spacing, so tone marks and vowels above and below the line
  are not clipped.
- Word comparisons (the last-word steal, duplicate clues) now keep letters of
  any script and fold German umlauts, rather than stripping everything that
  was not ASCII. Thai tone marks are deliberately preserved — they are part of
  the word, not decoration.
- Switching the word language resets the pack selection, which otherwise
  pointed at packs from a different language.
- The settings row for the word language sits on its own line, because three
  language names do not fit beside a label on a phone.

### Fixed

- The settings label was collapsing to one character per line in Thai, caused
  by two CSS rules setting a conflicting minimum width.

## [1.0.0] — 2026-09-25

The first working game.

### Added

- **Word-imposter rules as a pure, deterministic engine.** Role dealing,
  rotating clue order, voting, eliminations, win conditions and the
  last-word steal, all as `reduce(state, action)` with no DOM, network or
  clock in sight. The same seed always deals the same game.
- **Pass-and-play on one phone**, with a gate screen between players so nobody
  sees a card that is not theirs. Voting by show of hands, or by passing the
  phone around for a secret ballot.
- **LAN play from everyone's phone.** The host runs `npm run party`, everyone
  else joins over the same wifi with a four-letter room code.
- **A server that never sends a player something they should not see.** It
  holds the authoritative state and sends each phone a scrubbed copy plus that
  player's own card, so the secret word is not in the page for anyone who
  should not have it. Votes stay hidden until the last one is in, and the
  server rewrites the actor on every action so a doctored request cannot vote
  on someone else's behalf.
- **Live updates over Server-Sent Events**, chosen over WebSockets because
  updates only ever flow server → client, the browser reconnects a dropped
  stream by itself when a phone locks, and it needs no dependencies.
- **Settings**: one or two imposters, a decoy word or nothing at all, the
  last-word steal on or off, and per-pack word selection.
- **Tests**: the rules engine including a thousand randomised games that must
  all terminate with a winner, and the server end-to-end with four simulated
  phones playing a full game.

[Unreleased]: https://example.com/compare/v1.8.0...HEAD
[1.8.0]: https://example.com/releases/v1.8.0
[1.7.0]: https://example.com/releases/v1.7.0
[1.6.0]: https://example.com/releases/v1.6.0
[1.5.1]: https://example.com/releases/v1.5.1
[1.5.0]: https://example.com/releases/v1.5.0
[1.4.0]: https://example.com/releases/v1.4.0
[1.3.0]: https://example.com/releases/v1.3.0
[1.2.0]: https://example.com/releases/v1.2.0
[1.1.0]: https://example.com/releases/v1.1.0
[1.0.0]: https://example.com/releases/v1.0.0
