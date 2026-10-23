/**
 * The dot beside a setting, and what it says.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../../i18n/index.jsx';

/**
 * The ⓘ beside a setting.
 *
 * `lines` is for a setting with options: each one gets its name and a line
 * saying what it does, which is far easier to find an answer in than the
 * paragraph they used to be. `text` is the lead above them, or the whole
 * thing for a setting with nothing to compare.
 *
 * The bubble opens downwards unless there is no room, in which case it opens
 * up — the last settings on a long lobby are near the bottom of the screen,
 * and a tooltip that opens off the edge is worse than none.
 */
export function Info({ text, lines, label }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const id = useId();
  const wrap = useRef(null);
  const bubble = useRef(null);

  useEffect(() => {
    if (!open) return;
    const anchor = wrap.current?.closest('.setting') ?? wrap.current;
    const box = anchor?.getBoundingClientRect();
    const height = bubble.current?.offsetHeight ?? 160;
    if (box) setAbove(box.bottom + height + 24 > window.innerHeight && box.top > height + 24);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="info" ref={wrap}>
      <button
        type="button"
        className="info-dot"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-label={label || t('common.whatsThis')}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      {open && (
        <span
          className={`tip pop-in${above ? ' above' : ''}`}
          id={id}
          role="tooltip"
          ref={bubble}
        >
          {text && <span className="tip-lead">{text}</span>}
          {lines?.length > 0 && (
            <span className="tip-lines">
              {lines.map(([term, definition]) => (
                <span className="tip-line" key={term}>
                  <b>{term}</b>
                  <span>{definition}</span>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

