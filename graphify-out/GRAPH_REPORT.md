# Graph Report - ImposterGame  (2026-10-26)

## Corpus Check
- 169 files · ~160,015 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .css 12, (none) 2, .bat 1)

## Summary
- 929 nodes · 2938 edges · 45 communities (30 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92e9bb7e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Lobby and Round UI
- Room Server and Tests
- Release Changelog
- words/index.js
- LocalGame.jsx
- Application Shell
- Error Handling
- Browser Layout Screenshot Checks
- Build Dependencies
- Continuous Integration
- Test Helpers
- Round Engine
- presets.test.js
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
- ref_node_test
- scoring.test.js
- Hosting Configuration
- fingerprint.mjs
- Project instructions
- FakeEventSource
- Style Checks
- Project Guide
- Imposter Icon
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
- `playerForToken()` --calls--> `playerById()`  [EXTRACTED]
  server/rooms.js → src/core/select.js
- `leaveRoom()` --calls--> `reduce()`  [EXTRACTED]
  server/rooms.js → src/core/engine.js
- `leaveRoom()` --calls--> `playerById()`  [EXTRACTED]
  server/rooms.js → src/core/select.js

## Import Cycles
- None detected.

## Communities (45 total, 15 thin omitted)

### Community 0 - "Lobby and Round UI"
Cohesion: 0.07
Nodes (81): react, MAX_PLAYERS, MIN_PLAYERS, alivePlayers(), playerById(), viewFor(), ICONS, AddPlayerForm() (+73 more)

### Community 1 - "Room Server and Tests"
Cohesion: 0.07
Nodes (52): aRoom(), same(), callerOf(), Limit, LIMITS, _resetLimits(), sweepLimits(), withServer() (+44 more)

### Community 2 - "Release Changelog"
Cohesion: 0.06
Nodes (45): flush(), fromRecord(), here, load(), save(), saveNow(), STORE_PATH, toRecord() (+37 more)

### Community 3 - "words/index.js"
Cohesion: 0.08
Nodes (47): BUILTIN_LANGUAGES, _forgetWords(), inFlight, loadAllWords(), loaded, LOADERS, loadWords(), DEFAULT_WORD_LANG (+39 more)

### Community 4 - "LocalGame.jsx"
Cohesion: 0.14
Nodes (29): PHASE, EndGameButton(), LocalGame(), Resume(), clearGame(), CONFIG_KEY, GAME_KEY, isResumable() (+21 more)

### Community 5 - "Application Shell"
Cohesion: 0.09
Nodes (43): App(), IconBoard, LIB_LANG_KEY, read(), readHash(), StringBoard, write(), Crash() (+35 more)

### Community 6 - "Error Handling"
Cohesion: 0.14
Nodes (24): ErrorBoundary, ErrorScreen(), FailureNotice(), breadcrumbs, currentSecrets(), described(), facts, failures (+16 more)

### Community 7 - "Browser Layout Screenshot Checks"
Cohesion: 0.32
Nodes (6): here, LAYOUTS, measure(), SHOTS, slug(), snapshot()

### Community 8 - "Build Dependencies"
Cohesion: 0.07
Nodes (31): author, dependencies, react@^19.2.0, react-dom@^19.2.0, description, devDependencies, vite@^6.0.7, @vitejs/plugin-react@^4.3.4 (+23 more)

### Community 9 - "Continuous Integration"
Cohesion: 0.09
Nodes (25): name, runs-on, steps, jobs, browser, tests, node, name (+17 more)

### Community 10 - "Test Helpers"
Cohesion: 0.19
Nodes (16): builtAtRuntime(), errorCodesInSource(), root, AMBIENT, bindings(), NOT_SOURCE, sourceFiles(), stripNonCode() (+8 more)

### Community 11 - "Round Engine"
Cohesion: 0.18
Nodes (26): dealRoles(), decoyFor(), hintFor(), makePlayerId(), nextHistory(), pickImposters(), pickWord(), recentWordWindow() (+18 more)

### Community 12 - "presets.test.js"
Cohesion: 0.46
Nodes (5): PRESET_KEYS, presetFor(), PRESETS, same(), TABLE

### Community 13 - "Core Rules Engine"
Cohesion: 0.09
Nodes (32): wordsReady(), createGame(), applyAll(), reduce(), deals(), revealAll(), started(), voteOut() (+24 more)

### Community 14 - "Theme Management"
Cohesion: 0.14
Nodes (18): read(), systemMode(), ThemeContext, ThemeProvider(), useTheme(), ALL, contrast(), css (+10 more)

### Community 15 - "Node Platform APIs"
Cohesion: 0.12
Nodes (10): here, here, ICONS, PUBLIC, canBuild, failed, mark, results (+2 more)

### Community 16 - "PWA Icons"
Cohesion: 0.13
Nodes (18): inPublic(), linkedFiles(), manifestIcons(), missing(), PNG_MAGIC, pngSize(), answers(), isBuiltAtRuntime() (+10 more)

### Community 17 - "Imposter Configuration"
Cohesion: 0.19
Nodes (20): EMPTY_HISTORY, FIVE, one(), OURS, roleIds(), SEVEN, autoImposterCount(), DECOY (+12 more)

### Community 18 - "Coverage Reporting"
Cohesion: 0.11
Nodes (14): all, floorsFile, isHarness(), isTest(), measured, MODULES, order, out (+6 more)

### Community 19 - "Voting and Fuzz Tests"
Cohesion: 0.15
Nodes (18): clueRound(), chaosAction(), FIRST, NAMES, PHASES, ROLE_IDS, RUNS, sensibleAction() (+10 more)

### Community 20 - "Game Ending Checks"
Cohesion: 0.17
Nodes (13): dealAndReveal(), declare(), dist, here, newest(), openGame(), PLANS, root (+5 more)

### Community 21 - "Special Roles"
Cohesion: 0.26
Nodes (7): BY_ID, endingFor(), ROLE, ROLES, roleSpec(), SPECIAL_ROLES, winsWithImposters()

### Community 22 - "Screen Flow Checks"
Cohesion: 0.16
Nodes (11): dealAndReveal(), dist, here, moved, newest(), openPage(), root, seen (+3 more)

### Community 23 - "ref_node_test"
Cohesion: 0.13
Nodes (27): buildPack(), clean(), CODE_VERSION, decodePack(), encodePack(), fromBase64(), hasAWord(), isCustomPackId() (+19 more)

### Community 24 - "scoring.test.js"
Cohesion: 0.43
Nodes (6): MAX_WIN_POINTS, paysTheEliminated(), pointsFor(), WIN_POINTS, WIN_REASONS, here

### Community 25 - "Hosting Configuration"
Cohesion: 0.17
Nodes (11): key, value, services, buildCommand, envVars, healthCheckPath, name, plan (+3 more)

### Community 26 - "fingerprint.mjs"
Cohesion: 0.29
Nodes (4): args, file, here, { lines, text, hash }

### Community 29 - "Style Checks"
Cohesion: 0.17
Nodes (14): classesRendered(), classesStyled(), classPrefixes(), unusedClasses(), braces(), code(), gateAt, here (+6 more)

### Community 30 - "Project Guide"
Cohesion: 0.11
Nodes (13): Imposter-side parity cap includes sidekick, ImposterGame changelog, Persisted multiplayer rooms, Text-based browser layout baselines, HTML application shell, Playtest guide, Central scoring table, Custom word packs (+5 more)

### Community 32 - "Imposter Icon"
Cohesion: 0.67
Nodes (3): Disguise, Hat, Imposter

## Knowledge Gaps
- **22 isolated node(s):** `Imposter-side parity cap includes sidekick`, `Central scoring table`, `Data-described optional roles`, `Separate interface and word languages`, `Server-Sent Events for room updates` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 271 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Lobby and Round UI` to `Release Changelog`, `words/index.js`, `LocalGame.jsx`, `Application Shell`, `Error Handling`, `Build Dependencies`, `Theme Management`, `ref_node_test`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `Imposter-side parity cap includes sidekick`, `Central scoring table`, `Data-described optional roles` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Lobby and Round UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07110697096724111 - nodes in this community are weakly interconnected._
- **Why does `useT()` connect `Lobby and Round UI` to `Release Changelog`, `words/index.js`, `LocalGame.jsx`, `Application Shell`, `Error Handling`, `Theme Management`, `ref_node_test`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `Room Server and Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.06777493606138107 - nodes in this community are weakly interconnected._
- **Should `Release Changelog` be split into smaller, more focused modules?**
  _Cohesion score 0.058126619770455384 - nodes in this community are weakly interconnected._
- **Should `words/index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08251748251748252 - nodes in this community are weakly interconnected._