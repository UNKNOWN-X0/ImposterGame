/**
 * All seven ways a game can end, played to the end in a real browser.
 *
 * Run it with:  npm run build && npm run endings
 *
 * The game-over screen is the one every game arrives at and almost no test
 * ever reaches, which is how a missing import sat in the trophy icon until
 * somebody won a real game on a real phone. But "the game-over screen" is
 * seven different screens: each ending draws its own icon, its own headline
 * and its own sentence, and finding one of them working says nothing about
 * the other six.
 *
 * So this plays a whole game seven times, one per ending, and checks two
 * things each time: that the browser never threw, and that the screen names
 * the ending it was steered towards. The second half matters — a harness
 * that quietly reached "time" every round would report seven passes and have
 * tested one thing.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..', '..');

const dist = path.join(root, 'dist', 'index.html');
if (!existsSync(dist)) {
  console.error('Build it first:  npm run build');
  process.exit(2); // 2 = cannot run, which npm run verify reads as a skip
}

const newest = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((latest, entry) => {
    if (entry.name === 'browser') return latest;
    const full = path.join(dir, entry.name);
    return Math.max(latest, entry.isDirectory() ? newest(full) : statSync(full).mtimeMs);
  }, 0);

if (newest(path.join(root, 'src')) > statSync(dist).mtimeMs) {
  console.error('The build is older than the code it came from. Run:  npm run build');
  process.exit(2); // 2 = cannot run, which npm run verify reads as a skip
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'This one needs a real browser, which is not part of the game:\n' +
      '  npm install --no-save playwright && npx playwright install chromium\n' +
      'then run it again. `npm test` does not need any of this.',
  );
  process.exit(2); // 2 = cannot run, which npm run verify reads as a skip
}

const { createServer } = await import(path.join(root, 'server', 'server.js'));

const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ['--no-sandbox'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ROSTER = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus'];

let bad = 0;
const fail = (m) => {
  console.log('   FAIL:', m);
  bad += 1;
  process.exitCode = 1;
};

/* ---------------------------------------------------------------- *
 * Driving the game the way a table does
 * ---------------------------------------------------------------- */

async function openGame(seats, settings = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('imposter.seenRules', '1');
    localStorage.setItem('imposter.lang', 'en');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /is not defined|is not a function/.test(m.text())) {
      errors.push(m.text());
    }
  });
  await page.goto(BASE);
  await wait(600);
  await page.locator('.mode').first().click();
  await wait(250);
  for (const name of ROSTER.slice(0, seats)) {
    await page.locator('input').first().fill(name);
    await page.locator('.row button').first().click();
  }
  // Detailed controls are progressively disclosed to keep first-time setup
  // short; ending sweeps open them before choosing specialized rule settings.
  await page.locator('details.setting-more > summary').click();
  if (settings.rounds) {
    await page
      .locator('.setting', { hasText: 'Rounds' })
      .getByRole('button', { name: String(settings.rounds), exact: true })
      .click();
    await wait(150);
  }
  for (const role of settings.roles ?? []) {
    // A setting that silently does not take is a harness that silently tests
    // the default, so each one is read back after it is clicked.
    const button = page.locator('.setting button.pack', { hasText: role }).first();
    await button.click();
    await wait(200);
    if ((await button.getAttribute('aria-pressed')) !== 'true') {
      throw new Error(`could not switch on the ${role} role`);
    }
  }
  if (settings.imposters) {
    const one = page
      .locator('.setting', { hasText: 'Imposters' })
      .getByRole('button', { name: String(settings.imposters), exact: true });
    await one.click();
    await wait(200);
    if ((await one.getAttribute('aria-pressed')) !== 'true') {
      throw new Error('could not set the number of imposters');
    }
  }
  return { ctx, page, errors };
}

/**
 * Deal, and look at every card — remembering who got what.
 *
 * The reveal order is shuffled, so a position in this loop means nothing
 * later: everything is remembered by name.
 */
async function dealAndReveal(page, seats) {
  await page.getByRole('button', { name: 'Deal the cards' }).click();
  await wait(350);
  const who = { word: null, imposters: [], roles: {} };
  for (let i = 0; i < seats; i += 1) {
    const before = await page.locator('.shell').innerText();
    const name = ROSTER.find((n) => new RegExp(`\\b${n}\\b`).test(before));
    await page.locator('.reveal.shield').click();
    const box = await page.locator('.reveal.shield').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await wait(620);
    // Not a list of tones: the jester's card is `wild`, and a list is how a
    // harness quietly stops covering a role somebody added later.
    const card = page.locator('.reveal:not(.shield)');
    await card.waitFor();
    const face = await card.innerText();
    if ((await page.locator('.reveal.imposter').count()) > 0) who.imposters.push(name);
    else if (!who.word) who.word = (await card.locator('.big-word').textContent()).trim();
    for (const role of ['Detective', 'Jester', 'Sidekick']) {
      // The label on a card is styled uppercase, and innerText gives back
      // what is on the screen rather than what is in the string table.
      if (new RegExp(`You are the ${role}`, 'i').test(face)) who.roles[role] = name;
    }
    await page.mouse.up();
    await wait(120);
    await page.getByRole('button', { name: /Got it|start the round/i }).first().click();
    await wait(120);
  }
  return who;
}

/** Skip the talking and go straight to a vote. */
async function toTheVote(page) {
  const button = page.getByRole('button', { name: /Everyone has spoken/ });
  if (await button.count()) {
    await button.click();
    await wait(250);
  }
}

/**
 * Declare somebody out — or nobody — read the verdict, and answer the last
 * guess if one is offered.
 *
 * Voting out an imposter does not end a game while the steal is on: they get
 * the phone and one chance to name the word. Leaving that out is what made
 * three endings here report that the game "never ended".
 *
 * @param guess what the imposter says if asked: the word, or anything else
 */
async function declare(page, name, guess = 'not the word at all') {
  await toTheVote(page);
  if (name === null) {
    await page.getByRole('button', { name: /Could not agree/ }).click();
  } else {
    await page.locator('.vote-grid button', { hasText: name }).first().click();
  }
  await wait(450);

  for (let step = 0; step < 4; step += 1) {
    // Handing the phone over is one big button with the whole invitation
    // written on it, not a small one labelled "tap".
    const gate = page.locator('button', { hasText: /Pass the phone to/i }).first();
    if (await gate.count()) {
      await gate.click();
      await wait(350);
      continue;
    }
    const field = page.getByPlaceholder(/The word was/i);
    if (await field.count()) {
      await field.fill(guess);
      await page.getByRole('button', { name: 'Guess', exact: true }).click();
      await wait(500);
      continue;
    }
    const next = page.getByRole('button', { name: /Continue|Got it/i }).first();
    if (!(await next.count())) break;
    await next.click();
    await wait(400);
  }
}

/** Which ending the final screen says it was, or null if it is not over. */
async function endingShown(page) {
  const text = await page.locator('.shell').innerText();
  const sentences = {
    caught: 'could not name the word',
    cleanSweep: 'not one of you lost',
    steal: 'named the word anyway',
    called: 'called it mid-round',
    outnumbered: 'Too many of the crew are gone',
    time: 'ran out of rounds',
    jester: 'the one person who wanted it',
  };
  for (const [reason, sentence] of Object.entries(sentences)) {
    if (text.includes(sentence)) return reason;
  }
  return null;
}

/* ---------------------------------------------------------------- *
 * One route to each ending
 * ---------------------------------------------------------------- */

const ROUTES = {
  /** Vote out the imposter first time: nobody was lost getting there. */
  async cleanSweep(page, who) {
    for (const name of who.imposters) {
      if ((await endingShown(page)) !== null) return;
      await declare(page, name, 'nowhere near it');
    }
  },

  /** Lose one of your own first, then find them. A win that cost something. */
  async caught(page, who) {
    const innocent = ROSTER.find((n) => !who.imposters.includes(n) && n !== who.roles.Jester);
    await declare(page, innocent);
    // Every imposter, not the first one: a table of six is dealt two, and
    // catching one of them ends nothing.
    for (const name of who.imposters) {
      if ((await endingShown(page)) !== null) return;
      await declare(page, name, 'nowhere near it');
    }
  },

  /** Keep voting out the wrong people until the imposter has the numbers. */
  async outnumbered(page, who) {
    const innocents = ROSTER.slice(0, 4).filter((n) => !who.imposters.includes(n));
    for (const name of innocents) {
      if ((await endingShown(page)) !== null) return;
      await declare(page, name);
    }
  },

  /** Agree on nobody, round after round, until the rounds run out. */
  async time(page) {
    for (let round = 0; round < 4; round += 1) {
      if ((await endingShown(page)) !== null) return;
      await declare(page, null);
    }
  },

  /** Caught, and then they name the word anyway. */
  async steal(page, who) {
    await declare(page, who.imposters[0], who.word);
  },

  /** An imposter says it out loud, mid-round, and is right. */
  async called(page, who) {
    await page.getByRole('button', { name: /I know the word/ }).click();
    await wait(300);
    await page.locator('.vote-grid button', { hasText: who.imposters[0] }).first().click();
    await wait(300);
    const gate = page.locator('button', { hasText: /Pass the phone to/i }).first();
    if (await gate.count()) {
      await gate.click();
      await wait(300);
    }
    await page.locator('input').first().fill(who.word);
    await page.getByRole('button', { name: 'Call it' }).last().click();
    await wait(600);
    const next = page.getByRole('button', { name: /Continue|Got it/i }).first();
    if (await next.count()) {
      await next.click();
      await wait(400);
    }
  },

  /**
   * An imposter says it out loud and is wrong.
   *
   * This is the sequence a player actually sent in a crash report:
   * `CALL_WORD → CONTINUE`, and then the game stopped. Calling wrongly puts
   * the caller out, which can hand the crew the win — so it arrives at the
   * winners' screen by a road none of the other routes take.
   */
  async calledWrong(page, who) {
    await page.getByRole('button', { name: /I know the word/ }).click();
    await wait(300);
    await page.locator('.vote-grid button', { hasText: who.imposters[0] }).first().click();
    await wait(300);
    const gate = page.locator('button', { hasText: /Pass the phone to/i }).first();
    if (await gate.count()) {
      await gate.click();
      await wait(300);
    }
    await page.locator('input').first().fill('completely the wrong word');
    await page.getByRole('button', { name: 'Call it' }).last().click();
    await wait(600);
    for (let step = 0; step < 3; step += 1) {
      if ((await endingShown(page)) !== null) return;
      const next = page.getByRole('button', { name: /Continue|Got it/i }).first();
      if (!(await next.count())) break;
      await next.click();
      await wait(400);
    }
  },

  /** Vote out the one person who wanted it. */
  async jester(page, who) {
    if (!who.roles.Jester) throw new Error('no jester was dealt — the table may be too small');
    await declare(page, who.roles.Jester);
  },
};

const PLANS = [
  { ending: 'cleanSweep', seats: 5 },
  { ending: 'caught', seats: 6, settings: { imposters: 1 } },
  { ending: 'outnumbered', seats: 4 },
  { ending: 'time', seats: 5, settings: { rounds: 2 } },
  { ending: 'steal', seats: 5 },
  { ending: 'called', seats: 4 },
  { ending: 'jester', seats: 6, settings: { roles: ['Jester'], imposters: 1 } },
  // One route that is not named after its ending: calling the word and being
  // wrong hands it to the crew, and which crew win it is depends on whether
  // anybody had been voted out first.
  { ending: 'calledWrong', seats: 5, settings: { imposters: 1 }, expect: ['cleanSweep', 'caught'] },
];

for (const { ending, seats, settings, expect } of PLANS) {
  process.stdout.write(`  … ${ending}\r`);
  const { ctx, page, errors } = await openGame(seats, settings);
  const who = await dealAndReveal(page, seats);
  await ROUTES[ending](page, who);
  const reached = await endingShown(page);
  const icons = await page.locator('svg').count();

  if (errors.length) fail(`${ending}: ${errors[0]}`);
  else if (reached === null) {
    // A harness that says "it did not work" and nothing else is a harness
    // somebody has to re-debug from scratch every time.
    const screen = (await page.locator('.shell').innerText()).replace(/\n+/g, ' | ');
    const buttons = (await page.locator('button').allTextContents())
      .map((b) => b.trim())
      .filter(Boolean)
      .join(' / ');
    fail(`${ending}: the game never ended.\n      on screen: ${screen.slice(0, 200)}\n      buttons:   ${buttons.slice(0, 200)}`);
  }
  else if (!(expect ?? [ending]).includes(reached)) {
    fail(`${ending}: ended as "${reached}" instead`);
  } else {
    const how = expect ? ` → ${reached}` : '';
    console.log(`  ✓ ${ending.padEnd(12)} ${seats} players · ${icons} icons drawn${how}`);
  }

  // and the screen after it: playing again from the same table
  if (!errors.length) {
    const again = page.getByRole('button', { name: /Play again|Deal/i }).first();
    if (await again.count()) {
      await again.click();
      await wait(500);
      if (errors.length) fail(`${ending}: playing again threw — ${errors[0]}`);
    }
  }
  await ctx.close();
}

console.log(
  bad
    ? `\n${bad} of ${PLANS.length} routes failed`
    : `\nall ${PLANS.length} routes reached their own ending without throwing ✓`,
);
await browser.close();
server.closeAllConnections?.();
server.close();
