/**
 * The parts a table adds once the plain game is familiar: the optional roles,
 * and keeping score across the night.
 */

import { SPECIAL_ROLES } from '../../../core/engine.js';
import { Info } from '../../../ui/primitives/Info.jsx';
import { RoleGlyph } from '../../../ui/primitives/RoleGlyph.jsx';
import { OnOff } from '../../../ui/primitives/Segmented.jsx';

export function Roles({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting block">
      <div className="label">
        <b>
          {t('settings.roles')}{' '}
          <Info
            text={t('tip.rolesLead')}
            lines={SPECIAL_ROLES.map((role) => [t(`role.${role}`), t(`role.${role}Tip`)])}
          />
        </b>
        <span>
          {blind
            ? t('settings.lockedByBlind')
            : roles.length === 0
              ? t('settings.rolesNone')
              : t('settings.rolesSome', { count: roles.length })}
        </span>
      </div>
      <div className="pack-grid role-grid" style={{ marginTop: 10 }}>
        {SPECIAL_ROLES.map((role) => (
          <button
            key={role}
            className="pack"
            aria-pressed={roles.includes(role)}
            // Every one of these is something you are told about yourself,
            // and blind mode is the mode where nobody is told anything.
            disabled={disabled || blind}
            title={blind ? t('settings.lockedByBlind') : undefined}
            onClick={() =>
              onChange({
                roles: roles.includes(role)
                  ? roles.filter((r) => r !== role)
                  : [...roles, role],
              })
            }
          >
            <span className="role-choice-title"><RoleGlyph role={role} /> {t(`role.${role}`)}</span>
            <span className="role-choice-description">{t(`role.${role}Tip`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Scoring({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting">
      <div className="label">
        <b>
          {t('settings.scoring')} <Info text={t('tip.scoringLead')} />
        </b>
        <span>{config.scoring ? t('settings.scoringOn') : t('settings.scoringOff')}</span>
      </div>
      <OnOff
        value={config.scoring}
        disabled={disabled}
        onChange={(v) => onChange({ scoring: v })}
      />
    </div>
  );
}
