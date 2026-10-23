/**
 * Who is at the table.
 */

import { useT } from '../../i18n/index.jsx';
import { Avatar } from '../../ui/primitives/Avatar.jsx';
import { RoleGlyph } from '../../ui/primitives/RoleGlyph.jsx';

export function PlayerList({
  players,
  eliminated = [],
  youId,
  hostId,
  imposterIds = [],
  roles = {},
  onRemove,
}) {
  const { t } = useT();
  const rolesKnown = imposterIds.length > 0;
  return (
    <div className="card flush players stagger">
      {players.map((p) => {
        const out = eliminated.includes(p.id);
        return (
          <div className={`player${out ? ' out' : ''}`} key={p.id}>
            <Avatar name={p.name} dim={out} />
            <span className="player-name">{p.name}</span>
            {p.id === hostId && <span className="tag">{t('tag.host')}</span>}
            {p.id === youId && <span className="tag you">{t('tag.you')}</span>}
            {rolesKnown &&
              (imposterIds.includes(p.id) ? (
                <span className="tag imposter">{t('tag.imposter')}</span>
              ) : roles[p.id] ? (
                // At the end everyone finds out who was quietly what.
                <span className={`tag role-${roles[p.id]}`}>
                  <RoleGlyph role={roles[p.id]} size={13} /> {t(`role.${roles[p.id]}`)}
                </span>
              ) : (
                <span className="tag crew">{t('tag.crew')}</span>
              ))}
            {onRemove && p.id !== hostId && (
              <button className="btn-link" onClick={() => onRemove(p.id)}>
                {t('common.remove')}
              </button>
            )}
          </div>
        );
      })}
      {players.length === 0 && (
        <div className="player">
          <span className="hint">{t('lobby.nobody')}</span>
        </div>
      )}
    </div>
  );
}

