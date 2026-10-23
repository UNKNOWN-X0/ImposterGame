/**
 * The face a role wears.
 */

import { CrewIcon, DetectiveIcon, ImposterIcon, JesterIcon, SidekickIcon } from '../icons/index.jsx';
import { ROLE } from '../../core/engine.js';

/** The little icon a role carries wherever it is named. */
export function RoleGlyph({ role, size = 15 }) {
  const Icon = { detective: DetectiveIcon, sidekick: SidekickIcon, jester: JesterIcon }[role];
  return Icon ? <Icon size={size} /> : null;
}

/** The icon, the heading and the colour each role's card carries. */
export const ROLE_FACE = {
  [ROLE.CREW]: { icon: CrewIcon, label: 'reveal.crew', tone: 'crew' },
  [ROLE.IMPOSTER]: { icon: ImposterIcon, label: 'reveal.imposter', tone: 'imposter' },
  [ROLE.DETECTIVE]: { icon: DetectiveIcon, label: 'role.detectiveCard', tone: 'crew' },
  // The sidekick plays for the imposters, and their card says so — they can
  // hardly cover for somebody they have not been told about.
  [ROLE.SIDEKICK]: { icon: SidekickIcon, label: 'role.sidekickCard', tone: 'imposter' },
  // The jester is on nobody's side, so their card is neither colour.
  [ROLE.JESTER]: { icon: JesterIcon, label: 'role.jesterCard', tone: 'wild' },
};
