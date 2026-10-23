/**
 * A screen that breaks on purpose, at `#crash`.
 *
 * The error screen is the one screen that cannot be checked by using the game
 * normally, because reaching it means something has gone wrong. So there is a
 * way to reach it deliberately: open `#crash` on a real phone and see what a
 * player would see — in their language, in their colours, with the copy
 * button doing what it claims.
 *
 * Nothing links here. It is for whoever is working on the game, like `#icons`.
 */

export function Crash() {
  throw new Error('Deliberate crash from #crash, to see what a player would see.');
}
