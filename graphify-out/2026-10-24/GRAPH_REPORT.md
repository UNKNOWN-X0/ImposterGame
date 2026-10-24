# Graph Report - ImposterGame  (2026-10-24)

## Corpus Check
- 180 files · ~225,756 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: .css 12, (none) 1, .bat 1)

## Summary
- 931 nodes · 2939 edges · 46 communities (31 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b8b1e40a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Lobby and Round UI
- Room Server and Tests
- Release Changelog
- Word Language Packs
- Browser Storage
- Application Shell
- Error Handling
- ref_node_url
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
- compare.test.js
- Engine Tests
- Hosting Configuration
- step
- Project instructions
- Room Persistence
- Style Checks
- Project Guide
- CLAUDE.md
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

## Communities (46 total, 15 thin omitted)

### Community 0 - "Lobby and Round UI"
Cohesion: 0.07
Nodes (84): react, MIN_PLAYERS, playerById(), IconBoard(), ICONS, AddPlayerForm(), LobbyHint(), hintLine() (+76 more)

### Community 1 - "Room Server and Tests"
Cohesion: 0.07
Nodes (52): aRoom(), same(), callerOf(), Limit, LIMITS, _resetLimits(), sweepLimits(), withServer() (+44 more)

### Community 2 - "Release Changelog"
Cohesion: 0.08
Nodes (32): hasNews(), noteKey(), RELEASES, since(), pkg, VERSION, Changelog(), FILTERS (+24 more)

### Community 3 - "Word Language Packs"
Cohesion: 0.07
Nodes (38): BUILTIN_LANGUAGES, _forgetWords(), inFlight, loadAllWords(), loaded, LOADERS, loadWords(), wordsReady() (+30 more)

### Community 4 - "Browser Storage"
Cohesion: 0.07
Nodes (65): buildPack(), clean(), CODE_VERSION, decodePack(), encodePack(), fromBase64(), hasAWord(), isCustomPackId() (+57 more)

### Community 5 - "Application Shell"
Cohesion: 0.09
Nodes (33): App(), IconBoard, LIB_LANG_KEY, read(), readHash(), StringBoard, write(), Crash() (+25 more)

### Community 6 - "Error Handling"
Cohesion: 0.14
Nodes (24): ErrorBoundary, ErrorScreen(), FailureNotice(), breadcrumbs, currentSecrets(), described(), facts, failures (+16 more)

### Community 7 - "ref_node_url"
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
Cohesion: 0.14
Nodes (23): dealRoles(), decoyFor(), EMPTY_HISTORY, hintFor(), makePlayerId(), nextHistory(), pickImposters(), pickWord() (+15 more)

### Community 12 - "Game Settings"
Cohesion: 0.26
Nodes (18): presetFor(), same(), Roles(), Scoring(), HowMany(), WhatTheySee(), WhetherTheyKnow(), Calling() (+10 more)

### Community 13 - "Core Rules Engine"
Cohesion: 0.12
Nodes (21): createGame(), reduce(), clueRound(), voteOut(), normaliseConfig(), deepFreeze(), guard(), isStrict() (+13 more)

### Community 14 - "Theme Management"
Cohesion: 0.14
Nodes (18): read(), systemMode(), ThemeContext, ThemeProvider(), useTheme(), ALL, contrast(), css (+10 more)

### Community 15 - "Node Platform APIs"
Cohesion: 0.10
Nodes (10): here, here, ICONS, PUBLIC, canBuild, failed, mark, results (+2 more)

### Community 16 - "PWA Icons"
Cohesion: 0.13
Nodes (18): inPublic(), linkedFiles(), manifestIcons(), missing(), PNG_MAGIC, pngSize(), answers(), isBuiltAtRuntime() (+10 more)

### Community 17 - "Imposter Configuration"
Cohesion: 0.28
Nodes (13): autoImposterCount(), DECOY, DEFAULT_CONFIG, IMPOSTERS_AUTO, IMPOSTERS_RANDOM, MAX_PLAYERS, maxImpostersFor(), PLAIN_CREW_FLOOR (+5 more)

### Community 18 - "Coverage Reporting"
Cohesion: 0.12
Nodes (14): all, floorsFile, isHarness(), isTest(), measured, MODULES, order, out (+6 more)

### Community 19 - "Voting and Fuzz Tests"
Cohesion: 0.17
Nodes (14): fail(), GameError, chaosAction(), FIRST, NAMES, PHASES, ROLE_IDS, RUNS (+6 more)

### Community 20 - "Game Ending Checks"
Cohesion: 0.17
Nodes (13): dealAndReveal(), declare(), dist, here, newest(), openGame(), PLANS, root (+5 more)

### Community 21 - "Special Roles"
Cohesion: 0.24
Nodes (4): BY_ID, ROLE, ROLES, SPECIAL_ROLES

### Community 22 - "Screen Flow Checks"
Cohesion: 0.16
Nodes (11): dealAndReveal(), dist, here, moved, newest(), openPage(), root, seen (+3 more)

### Community 23 - "compare.test.js"
Cohesion: 0.50
Nodes (5): compareAll(), compareKey(), placeholdersIn(), placeholderTrouble(), readsAsUntranslated()

### Community 24 - "Engine Tests"
Cohesion: 0.23
Nodes (12): applyAll(), deals(), FIVE, one(), OURS, revealAll(), roleIds(), SEVEN (+4 more)

### Community 25 - "Hosting Configuration"
Cohesion: 0.17
Nodes (11): key, value, services, buildCommand, envVars, healthCheckPath, name, plan (+3 more)

### Community 26 - "step"
Cohesion: 0.23
Nodes (21): advanceAfterVerdict(), finish(), resolveOutcome(), resolveVote(), step(), tally(), endingFor(), roleSpec() (+13 more)

### Community 28 - "Room Persistence"
Cohesion: 0.25
Nodes (8): flush(), fromRecord(), here, load(), save(), saveNow(), STORE_PATH, toRecord()

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
- **22 isolated node(s):** `Central scoring table`, `Data-described optional roles`, `Separate interface and word languages`, `Server-Sent Events for room updates`, `Shared deterministic rules engine` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 273 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Lobby and Round UI` to `Release Changelog`, `Browser Storage`, `Application Shell`, `Error Handling`, `Build Dependencies`, `Game Settings`, `Theme Management`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `Central scoring table`, `Data-described optional roles`, `Separate interface and word languages` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Lobby and Round UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06707988980716253 - nodes in this community are weakly interconnected._
- **Why does `useT()` connect `Lobby and Round UI` to `Release Changelog`, `Browser Storage`, `Application Shell`, `Error Handling`, `Game Settings`, `Theme Management`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `Room Server and Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.06892010535557506 - nodes in this community are weakly interconnected._
- **Should `Release Changelog` be split into smaller, more focused modules?**
  _Cohesion score 0.08235294117647059 - nodes in this community are weakly interconnected._
- **Should `Word Language Packs` be split into smaller, more focused modules?**
  _Cohesion score 0.06623376623376623 - nodes in this community are weakly interconnected._