/**
 * The icon set.
 *
 * Every icon is drawn on the same grid with the same stroke (see ./Icon.jsx),
 * which is what makes thirty of them look like one set rather than thirty
 * drawings. They are grouped by what they are for; everything is re-exported
 * here so a screen imports from './icons' and does not have to know which
 * group an icon fell into.
 */

export * from './Icon.jsx';
export * from './brand.jsx';
export * from './roles.jsx';
export * from './actions.jsx';
export * from './motion.jsx';
