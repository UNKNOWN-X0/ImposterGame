/**
 * A hint, as one line: what kind of thing it is, and how long.
 *
 * Hint mode gives the imposter a description instead of a word, and the shape
 * of the answer — two words, eleven letters — is as much of the hint as the
 * category is.
 */

export function hintLine(t, hint) {
  if (!hint) return '';
  const shape = t(hint.words > 1 ? 'hint.shapeMany' : 'hint.shapeOne', {
    words: hint.words,
    chars: hint.chars,
  });
  return hint.text ? `${hint.text} · ${shape}` : shape;
}
