/**
 * The icon sheet — every icon, large, with its motion running.
 *
 * Not part of the game: it is reached by putting `#icons` on the end of the
 * address, and nothing links to it. It exists because motion cannot be
 * reviewed in a screenshot, and because an icon set drifts unless there is
 * one place that shows the whole of it at once. It reads from the same
 * components the game uses, so it cannot fall out of date.
 *
 * English only, deliberately: it is a workbench, not a screen players see.
 */
import {
  BrandMark, CrewIcon, ImposterIcon, UnknownIcon, HintIcon, CardBackIcon,
  PassIcon, EyeIcon, BellIcon, DiceIcon, TargetIcon, BrokenIcon, TieIcon,
  HourglassIcon, ShrugIcon, TrophyIcon, CheckIcon, ChevronLeftIcon, GlobeIcon,
  CopyIcon, PhoneIcon, WifiIcon, ContrastIcon,
  DetectiveIcon, JesterIcon, SidekickIcon, ScoreIcon,
} from '../../ui/icons/index.jsx';

const ICONS = [
  [CrewIcon, 'Crew', 'The card of anyone who is not an imposter', 'The tick strokes itself on as the card turns'],
  [ImposterIcon, 'Imposter', 'The imposter card, and the end of a game they won', 'Blinks always; glances left and right'],
  [UnknownIcon, 'Unknown', 'Blind mode, where nobody is told their role', 'The question mark cannot make its mind up'],
  [HintIcon, 'Hint', 'Hint mode: a description instead of a word', 'The bulb comes on and the rays come with it'],
  [DetectiveIcon, 'Detective', 'The detective’s card, and the settings chip', 'Sweeps, the way you look for something'],
  [SidekickIcon, 'Sidekick', 'The sidekick’s card — crew to everyone else', 'The one behind edges closer'],
  [JesterIcon, 'Jester', 'The jester’s card, and the end of a game they won', 'The cap tips and the bells swing after it'],
  [ScoreIcon, 'Score', 'The scoreboard heading', 'The bars settle, tallest last'],
  [ContrastIcon, 'Contrast', 'The display menu in the header', 'The shadow slides across as it opens'],
  [CardBackIcon, 'CardBack', 'The card before anyone holds it down', 'Light travels down the three lines'],
  [PassIcon, 'Pass', 'Handing the phone to the next player', 'Waves from the wrist'],
  [EyeIcon, 'Eye', 'While a card is being held open', 'Blinks, and glances sideways'],
  [BellIcon, 'Bell', 'An imposter calling the word mid-round', 'Swings from the crown, clapper lagging behind'],
  [DiceIcon, 'Dice', 'The final guess after being voted out', 'Rolls a quarter turn and lands'],
  [TargetIcon, 'Target', 'The vote caught an imposter', 'The rings close in and hold'],
  [BrokenIcon, 'Broken', 'The vote took one of the crew', 'The crack opens down the shield'],
  [TieIcon, 'Tie', 'A split vote — nobody goes', 'Rocks, then settles level'],
  [HourglassIcon, 'Hourglass', 'Waiting on somebody else’s phone', 'Somebody turns it over, then it waits'],
  [ShrugIcon, 'Shrug', 'You tapped call and you are not the imposter', 'Tilts, the way a shrug does'],
  [TrophyIcon, 'Trophy', 'The crew won', 'A shine crosses the cup, clipped to it'],
  [CheckIcon, 'Check', 'A vote landed; something was copied', 'Strokes itself on'],
  [ChevronLeftIcon, 'ChevronLeft', 'Back', 'Still — it is furniture'],
  [GlobeIcon, 'Globe', 'The language picker', 'The meridian flattens and fills out: it turns'],
  [CopyIcon, 'Copy', 'Copying the room code', 'The top sheet lifts off the one underneath'],
  [PhoneIcon, 'Phone', 'Pass-and-play on one phone', 'Still — it is a label'],
  [WifiIcon, 'Wifi', 'A phone each over the same wifi', 'The arcs go out from the dot in turn'],
];

export default function IconBoard() {
  return (
    <div className="shell board">
      <div className="row" style={{ alignItems: 'center', gap: 12 }}>
        <BrandMark size={40} />
        <div>
          <h1 className="title" style={{ margin: 0 }}>Icon set</h1>
          <p className="hint" style={{ margin: 0 }}>
            24×24, 1.8 stroke, round caps, inside a 20 live area. Motion is opt-in per
            place it is used, and all of it stops under reduced motion.
          </p>
        </div>
      </div>

      <div className="board-grid">
        {ICONS.map(([Icon, name, used, motion]) => (
          <div className="board-cell" key={name}>
            <div className="board-art">
              <Icon size={64} anim />
            </div>
            <div className="board-sizes">
              <Icon size={30} anim />
              <Icon size={20} anim />
              <Icon size={16} anim />
            </div>
            <b>{name}</b>
            <span className="hint">{used}</span>
            <span className="hint motion">{motion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
