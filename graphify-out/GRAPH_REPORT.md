# Graph Report - ImposterGame  (2026-10-24)

## Corpus Check
- 183 files · ~159,927 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: .css 12, (none) 1, .bat 1)

## Summary
- 926 nodes · 2934 edges · 47 communities (33 shown, 14 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.85)
- Token cost: unavailable (agent usage metadata was not exposed)

## Community Hubs (Navigation)
- Lobby and Round UI
- Room Server and Tests
- Release Changelog
- Word Language Packs
- Browser Storage
- Application Shell
- Error Handling
- Local Game Flow
- Build Dependencies
- Continuous Integration
- Test Helpers
- Round Engine
- Game Settings
- Core Rules Engine
- Theme Management
- Node Platform APIs
- PWA Icons
- Imposter Configuration
- Coverage Reporting
- Voting and Fuzz Tests
- Game Ending Checks
- Special Roles
- Screen Flow Checks
- Role Dealing
- Engine Tests
- Hosting Configuration
- Public Game State
- Browser Verification
- Room Persistence
- Style Checks
- Project Guide
- Design Decisions
- Imposter Icon
- Playtest Guide
- App Icon
- Favicon
- Large App Icon
- Brand Mark
- Icon Artwork
- Maskable Artwork
- Crash Layout
- German Layout
- English Layout
- Call Game Over Layout
- Home Layout
- Icon Layout
- Thai Layout

## God Nodes (most connected - your core abstractions)
1. `useT()` - 95 edges
2. `react` - 40 edges
3. `LocalGame()` - 39 edges
4. `reduce()` - 34 edges
5. `step()` - 32 edges
6. `Icon()` - 31 edges
7. `createGame()` - 26 edges
8. `Shell()` - 25 edges
9. `App()` - 23 edges
10. `Room()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `createRoom()` --calls--> `createGame()`  [EXTRACTED]
  server/rooms.js → src/core/deal.js
- `joinRoom()` --calls--> `reduce()`  [EXTRACTED]
  server/rooms.js → src/core/engine.js
- `leaveRoom()` --calls--> `reduce()`  [EXTRACTED]
  server/rooms.js → src/core/engine.js
- `dispatch()` --calls--> `reduce()`  [EXTRACTED]
  server/rooms.js → src/core/engine.js
- `payloadFor()` --calls--> `publicState()`  [EXTRACTED]
  server/rooms.js → src/core/select.js

## Import Cycles
- None detected.

## Communities (47 total, 14 thin omitted)

### Community 0 - "Lobby and Round UI"
Cohesion: 0.07
Nodes (86): react, MIN_PLAYERS, IconBoard(), ICONS, AddPlayerForm(), LobbyHint(), EndGameButton(), hintLine() (+78 more)

### Community 1 - "Room Server and Tests"
Cohesion: 0.06
Nodes (56): aRoom(), same(), callerOf(), Limit, LIMITS, _resetLimits(), sweepLimits(), withServer() (+48 more)

### Community 2 - "Release Changelog"
Cohesion: 0.07
Nodes (37): hasNews(), noteKey(), RELEASES, since(), pkg, VERSION, Changelog(), FILTERS (+29 more)

### Community 3 - "Word Language Packs"
Cohesion: 0.07
Nodes (38): BUILTIN_LANGUAGES, _forgetWords(), inFlight, loadAllWords(), loaded, LOADERS, loadWords(), wordsReady() (+30 more)

### Community 4 - "Browser Storage"
Cohesion: 0.10
Nodes (39): LIB_LANG_KEY, read(), write(), buildPack(), clean(), CODE_VERSION, decodePack(), encodePack() (+31 more)

### Community 5 - "Application Shell"
Cohesion: 0.09
Nodes (30): App(), IconBoard, readHash(), StringBoard, Crash(), Credit(), FirstRun(), Rules() (+22 more)

### Community 6 - "Error Handling"
Cohesion: 0.14
Nodes (24): ErrorBoundary, ErrorScreen(), FailureNotice(), breadcrumbs, currentSecrets(), described(), facts, failures (+16 more)

### Community 7 - "Local Game Flow"
Cohesion: 0.15
Nodes (27): LocalGame(), clearGame(), CONFIG_KEY, GAME_KEY, isResumable(), loadConfig(), loadGame(), loadRecentWords() (+19 more)

### Community 8 - "Build Dependencies"
Cohesion: 0.07
Nodes (31): author, dependencies, react@^19.2.0, react-dom@^19.2.0, description, devDependencies, vite@^6.0.7, @vitejs/plugin-react@^4.3.4 (+23 more)

### Community 9 - "Continuous Integration"
Cohesion: 0.09
Nodes (25): name, runs-on, steps, jobs, browser, tests, node, name (+17 more)

### Community 10 - "Test Helpers"
Cohesion: 0.14
Nodes (22): builtAtRuntime(), errorCodesInSource(), root, AMBIENT, bindings(), NOT_SOURCE, sourceFiles(), stripNonCode() (+14 more)

### Community 11 - "Round Engine"
Cohesion: 0.22
Nodes (21): pickWord(), advanceAfterVerdict(), finish(), normalise(), resolveOutcome(), resolveVote(), sameClue(), sameWord() (+13 more)

### Community 12 - "Game Settings"
Cohesion: 0.32
Nodes (15): Roles(), Scoring(), HowMany(), WhatTheySee(), WhetherTheyKnow(), Calling(), Rounds(), Stealing() (+7 more)

### Community 13 - "Core Rules Engine"
Cohesion: 0.16
Nodes (16): createGame(), reduce(), normaliseConfig(), deepFreeze(), guard(), isStrict(), setStrict(), strict (+8 more)

### Community 14 - "Theme Management"
Cohesion: 0.14
Nodes (17): read(), systemMode(), ThemeContext, ThemeProvider(), useTheme(), ALL, contrast(), css (+9 more)

### Community 15 - "Node Platform APIs"
Cohesion: 0.13
Nodes (10): here, LAYOUTS, measure(), SHOTS, slug(), snapshot(), here, here (+2 more)

### Community 16 - "PWA Icons"
Cohesion: 0.15
Nodes (16): inPublic(), linkedFiles(), manifestIcons(), missing(), PNG_MAGIC, pngSize(), cssFilesIn(), parseStrictly() (+8 more)

### Community 17 - "Imposter Configuration"
Cohesion: 0.21
Nodes (15): autoImposterCount(), DECOY, DEFAULT_CONFIG, IMPOSTERS_AUTO, IMPOSTERS_RANDOM, maxImpostersFor(), resolveImposterCount(), ROUNDS_UNLIMITED (+7 more)

### Community 18 - "Coverage Reporting"
Cohesion: 0.12
Nodes (14): all, floorsFile, isHarness(), isTest(), measured, MODULES, order, out (+6 more)

### Community 19 - "Voting and Fuzz Tests"
Cohesion: 0.19
Nodes (14): voteOut(), chaosAction(), FIRST, NAMES, PHASES, ROLE_IDS, RUNS, sensibleAction() (+6 more)

### Community 20 - "Game Ending Checks"
Cohesion: 0.17
Nodes (13): dealAndReveal(), declare(), dist, here, newest(), openGame(), PLANS, root (+5 more)

### Community 21 - "Special Roles"
Cohesion: 0.26
Nodes (8): BY_ID, endingFor(), ROLE, ROLES, roleSpec(), SPECIAL_ROLES, winsWithImposters(), TELLTALE_DECOYS

### Community 22 - "Screen Flow Checks"
Cohesion: 0.16
Nodes (11): dealAndReveal(), dist, here, moved, newest(), openPage(), root, seen (+3 more)

### Community 23 - "Role Dealing"
Cohesion: 0.19
Nodes (11): dealRoles(), decoyFor(), EMPTY_HISTORY, hintFor(), makePlayerId(), nextHistory(), pickImposters(), recentWordWindow() (+3 more)

### Community 24 - "Engine Tests"
Cohesion: 0.23
Nodes (12): applyAll(), deals(), FIVE, one(), OURS, revealAll(), roleIds(), SEVEN (+4 more)

### Community 25 - "Hosting Configuration"
Cohesion: 0.17
Nodes (11): key, value, services, buildCommand, envVars, healthCheckPath, name, plan (+3 more)

### Community 26 - "Public Game State"
Cohesion: 0.26
Nodes (11): tally(), clueRound(), publicImposterCount(), buildPublicState(), canCall(), cluesThisRound(), currentTurn(), isAlive() (+3 more)

### Community 27 - "Browser Verification"
Cohesion: 0.18
Nodes (6): canBuild, failed, mark, results, root, skipped

### Community 28 - "Room Persistence"
Cohesion: 0.25
Nodes (8): flush(), fromRecord(), here, load(), save(), saveNow(), STORE_PATH, toRecord()

### Community 29 - "Style Checks"
Cohesion: 0.20
Nodes (10): braces(), code(), gateAt, here, index, motion, parts, projectRoot (+2 more)

### Community 30 - "Project Guide"
Cohesion: 0.20
Nodes (8): HTML application shell, Central scoring table, Custom word packs, Data-described optional roles, ImposterGame README, Separate interface and word languages, Server-Sent Events for room updates, Shared deterministic rules engine

### Community 31 - "Design Decisions"
Cohesion: 0.29
Nodes (4): Imposter-side parity cap includes sidekick, ImposterGame changelog, Persisted multiplayer rooms, Text-based browser layout baselines

### Community 32 - "Imposter Icon"
Cohesion: 0.67
Nodes (3): Disguise, Hat, Imposter

## Knowledge Gaps
- **23 isolated node(s):** `Playtest guide`, `HTML application shell`, `Crash screen layout baseline`, `German game-over layout baseline`, `English game-over layout baseline` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 270 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Lobby and Round UI` to `Release Changelog`, `Browser Storage`, `Application Shell`, `Error Handling`, `Local Game Flow`, `Build Dependencies`, `Game Settings`, `Theme Management`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `Playtest guide`, `HTML application shell`, `Crash screen layout baseline` to the rest of the system?**
  _23 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Lobby and Round UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06770625083300014 - nodes in this community are weakly interconnected._
- **Why does `useT()` connect `Lobby and Round UI` to `Room Server and Tests`, `Release Changelog`, `Browser Storage`, `Application Shell`, `Error Handling`, `Local Game Flow`, `Game Settings`, `Theme Management`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `Room Server and Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.06342342342342343 - nodes in this community are weakly interconnected._
- **Should `Release Changelog` be split into smaller, more focused modules?**
  _Cohesion score 0.07364114552893045 - nodes in this community are weakly interconnected._
- **Should `Word Language Packs` be split into smaller, more focused modules?**
  _Cohesion score 0.06623376623376623 - nodes in this community are weakly interconnected._