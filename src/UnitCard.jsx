import { map } from "lodash";
import classNames from "classnames";
import {
  attackProfile,
  damageBoxes,
  damageStatus,
} from "./rules/data/index.js";
import UnitPortrait from "./table/UnitPortrait.jsx";

const Stat = ({ label, value, tone }) => (
  <div className="flex flex-col items-center px-2">
    <span className={classNames("font-display text-xl leading-none", tone)}>
      {value ?? "—"}
    </span>
    <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-bone-500">
      {label}
    </span>
  </div>
);

// The card's damage track, in the printed green / yellow / red bands. Tapping
// a box marks the unit up to it; tapping the last marked box rubs one out —
// the same gesture handles taking a wound and taking one back.
const DamageTrack = ({ token, onMark }) => {
  const { green, yellow } = token.unit.damage;
  const total = damageBoxes(token.unit);
  // Anything past the green and yellow bands is the red band by definition
  const bandOf = (index) => {
    if (index < green) return "bg-moss-700 border-moss-500";
    if (index < green + yellow) return "bg-ember-600/60 border-ember-500";
    return "bg-blood-700 border-blood-500";
  };

  return (
    <div className="flex flex-wrap gap-1">
      {map(Array.from({ length: total }), (_, index) => {
        const marked = index < token.marked;
        return (
          <button
            key={index}
            type="button"
            aria-label={`Damage box ${index + 1} of ${total}`}
            aria-pressed={marked}
            onClick={() => onMark(index + 1 === token.marked ? index : index + 1)}
            // A marked box keeps its own band colour and is struck through,
            // rather than turning red. The track is already green, yellow and
            // red, so marking in red made a red box indistinguishable from a
            // spent one — the marks vanished exactly where the unit was in the
            // most trouble. This matches how the board paints them.
            className={classNames(
              "relative h-6 w-5 overflow-hidden rounded-sm border transition-colors",
              bandOf(index)
            )}
          >
            {marked && (
              <>
                <span className="absolute inset-0 bg-iron-900/75" />
                <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold leading-none text-bone-100/60">
                  ×
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};

const STATUS_LABEL = {
  fresh: null,
  yellow: "In the Yellow",
  red: "In the Red",
  destroyed: "Destroyed",
};

/**
 * A unit's card as the table prints it — the stat bar for the stance being
 * fought, its damage track, and the keywords that matter.
 */
export default function UnitCard({ token, mode, role, onMark, portrait }) {
  const { unit } = token;
  const profile = attackProfile(unit, mode);
  const status = damageStatus(unit, token.marked);
  const isAttacker = role === "attacker";

  return (
    <div
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-iron-500 bg-iron-800/80 p-3"
      style={{ borderTopColor: token.color, borderTopWidth: 3 }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <UnitPortrait token={token} enabled={portrait} />
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg leading-tight tracking-wider text-bone-100">
            {unit.name}
          </h3>
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-bone-500">
            {unit.factionName} · {unit.points} pts
          </p>
        </div>
        <span
          className={classNames(
            "shrink-0 rounded px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider",
            isAttacker
              ? "bg-ember-600/25 text-ember-400"
              : "bg-blood-600/25 text-blood-300"
          )}
        >
          {isAttacker ? "Attacker" : "Defender"}
        </span>
      </div>

      <div className="flex items-center justify-between rounded border border-iron-600 bg-iron-900/60 py-1.5">
        {isAttacker ? (
          <>
            <Stat label="Dice" value={profile?.dice} tone="text-ember-400" />
            <Stat label="OS" value={profile?.offensiveSkill} tone="text-ember-400" />
            <Stat label="OP" value={profile?.offensivePower} tone="text-ember-400" />
          </>
        ) : (
          <>
            <Stat label="DS" value={unit.defensiveSkill} tone="text-blood-300" />
            <Stat label="DP" value={unit.defensivePower} tone="text-blood-300" />
            <Stat label="Cou" value={unit.courage} tone="text-bone-300" />
          </>
        )}
        <Stat label="Move" value={`${unit.move}"`} tone="text-bone-300" />
        {mode === "ranged" && isAttacker && (
          <Stat
            label="Range"
            value={profile?.range ? `${profile.range}"` : "—"}
            tone="text-bone-300"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <DamageTrack token={token} onMark={onMark} />
        {STATUS_LABEL[status] && (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-blood-400">
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      {Boolean(unit.keywords?.length) && (
        <div className="flex flex-wrap gap-1">
          {map(unit.keywords, (keyword) => (
            <span
              key={keyword}
              className="rounded border border-iron-500 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-bone-500"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
