/**
 * What there is to choose from.
 *
 * Plain JavaScript, apart from the React that uses it, so the tests can read
 * it — and because the list of themes is data, not behaviour.
 *
 * The palettes themselves live in styles.css, generated and contrast-checked
 * rather than picked by eye. What is here is the menu: which themes exist,
 * and the two colours each one shows on its chip in the picker.
 */

/** What the reader can choose. `system` resolves to one of the other two. */
export const MODES = ['system', 'light', 'dark'];

/** `dark` and `light` are [page, accent] — the theme said in two colours. */
export const THEMES = [
  { id: 'midnight', dark: ['#201c28', '#f5bc42'], light: ['#ffffff', '#b07c00'] },
  { id: 'ember', dark: ['#251c19', '#f26a4b'], light: ['#ffffff', '#c03a12'] },
  { id: 'forest', dark: ['#1a241f', '#a5d45e'], light: ['#ffffff', '#4d7016'] },
  { id: 'ocean', dark: ['#1a2330', '#3fc6e8'], light: ['#ffffff', '#0a6d86'] },
  { id: 'mono', dark: ['#1f1f22', '#6f86e8'], light: ['#ffffff', '#3d51c4'] },
];

export const DEFAULT_THEME = 'midnight';
export const DEFAULT_MODE = 'system';
