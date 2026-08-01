import { map } from "lodash";
import classNames from "classnames";
import {
  attackProfile,
  damageBoxes,
  damageStatus,
} from "./rules/data/index.js";
import { armyBySide } from "./table/board.js";

const Stat = ({ label, value, tone }) => (
  <div className="flex flex-col items-center px-2">
    <span className={classNames("font-display text-xl leading-none", tone)}>
      {value ?? "—"}
    </span>
    <span className="mt-0.5 text-[10px] uppercase tracking-wider text-parchment-400">
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
  // The printed green / yellow / red bands; anything past the first two is
  // the red band by definition
  const bandOf = (index) => {
    if (index < green) return "bg-emerald-700/70 border-emerald-500/60";
    if (index < green + yellow) return "bg-yellow-700/70 border-yellow-500/60";
    return "bg-red-900/70 border-red-600/60";
  };

  return (
    <div className="flex flex-wrap gap-1">
      {map(Array.from({ length: total }), (_, index) => (
        <button
          key={index}
          type="button"
          aria-label={`Damage box ${index + 1} of ${total}`}
          aria-pressed={index < token.marked}
          onClick={() => onMark(index + 1 === token.marked ? index : index + 1)}
          className={classNames(
            "h-6 w-5 rounded-sm border transition-colors",
            index < token.marked
              ? "border-blood bg-blood shadow-[inset_0_0_6px_rgba(0,0,0,0.6)]"
              : bandOf(index)
          )}
        />
      ))}
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
 * fought, its damage track, and the card-back rules that matter.
 */
export default function UnitCard({ token, mode, role, onMark }) {
  const { unit } = token;
  const army = armyBySide(token.side);
  const profile = attackProfile(unit, mode);
  const status = damageStatus(unit, token.marked);
  const isAttacker = role === "attacker";

  return (
    <div
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-table-600 bg-table-900/80 p-3"
      style={{ borderTopColor: army.color, borderTopWidth: 3 }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg leading-tight text-parchment-100">
            {unit.name}
          </h3>
          <p className="truncate text-[11px] uppercase tracking-wider text-parchment-400">
            {unit.factionName} · {unit.points} pts
          </p>
        </div>
        <span
          className={classNames(
            "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            isAttacker ? "bg-ember/25 text-ember" : "bg-blood/25 text-red-300"
          )}
        >
          {isAttacker ? "Attacker" : "Defender"}
        </span>
      </div>

      <div className="flex items-center justify-between rounded border border-table-700 bg-table-950/60 py-1.5">
        {isAttacker ? (
          <>
            <Stat label="Dice" value={profile?.dice} tone="text-ember" />
            <Stat label="OS" value={profile?.offensiveSkill} tone="text-ember" />
            <Stat label="OP" value={profile?.offensivePower} tone="text-ember" />
          </>
        ) : (
          <>
            <Stat label="DS" value={unit.defensiveSkill} tone="text-red-300" />
            <Stat label="DP" value={unit.defensivePower} tone="text-red-300" />
            <Stat label="Cou" value={unit.courage} tone="text-parchment-200" />
          </>
        )}
        <Stat label="Move" value={`${unit.move}"`} tone="text-parchment-200" />
        {mode === "ranged" && isAttacker && (
          <Stat label="Range" value={profile?.range ? `${profile.range}"` : "—"} tone="text-parchment-200" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <DamageTrack token={token} onMark={onMark} />
        {STATUS_LABEL[status] && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blood">
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      {Boolean(unit.keywords?.length) && (
        <div className="flex flex-wrap gap-1">
          {map(unit.keywords, (keyword) => (
            <span
              key={keyword}
              className="rounded border border-table-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-parchment-300"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
