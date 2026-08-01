import { map, range } from "lodash";
import classNames from "classnames";
import { GiBowArrow, GiCrossedSwords } from "react-icons/gi";
import { FaMinus, FaPlus } from "react-icons/fa";
import { KEYWORDS } from "../rules/data/index.js";

// The card's green/yellow/red damage track, one square per box
const DamageTrack = ({ damage }) => {
  const bands = [
    ...map(range(damage.green), () => "bg-moss-500"),
    ...map(range(damage.yellow), () => "bg-ember-500"),
    ...map(range(damage.red), () => "bg-blood-500"),
  ];
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {map(bands, (tone, box) => (
        <span key={box} className={classNames("h-2 w-2 rounded-[2px]", tone)} />
      ))}
    </span>
  );
};

const Profile = ({ icon: Icon, profile }) => (
  <span className="flex items-center gap-1">
    <Icon className="text-xs text-ember-600" aria-hidden />
    {profile.dice}d · OS {profile.offensiveSkill} · P {profile.offensivePower}
    {profile.range ? ` · ${profile.range}″` : ""}
  </span>
);

/**
 * One unit on the army list, with the stepper that adds and removes copies.
 * The layout is BattleDeck's unit row — same stat abbreviations, same damage
 * track, same rules text underneath — so a player reads the two apps the
 * same way.
 */
export default function UnitRow({ unit, copies, onAdd, onRemove }) {
  return (
    <div
      className={classNames(
        "plate flex w-full flex-col gap-1 px-3 py-2 text-left",
        copies > 0 && "plate-on-gold"
      )}
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5 font-display text-sm tracking-wider text-bone-100">
          <span className="truncate">{unit.name}</span>
          {copies > 0 && (
            <span className="shrink-0 rounded-sm border border-ember-500/50 px-1 font-mono text-[9px] tracking-widest text-ember-400">
              ×{copies}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[10px] text-bone-500">
            {unit.points} pts
          </span>
          <button
            type="button"
            className="plate flex h-7 w-7 items-center justify-center text-bone-300"
            onClick={onRemove}
            disabled={copies === 0}
            aria-label={`Remove one ${unit.name}`}
          >
            <FaMinus className="text-[10px]" />
          </button>
          <button
            type="button"
            className="plate flex h-7 w-7 items-center justify-center text-bone-300"
            onClick={onAdd}
            aria-label={`Add one ${unit.name}`}
          >
            <FaPlus className="text-[10px]" />
          </button>
        </span>
      </div>

      <span className="flex w-full flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] leading-tight text-bone-300">
        {unit.melee && <Profile icon={GiCrossedSwords} profile={unit.melee} />}
        {unit.ranged && <Profile icon={GiBowArrow} profile={unit.ranged} />}
        <span>
          DS {unit.defensiveSkill} · T {unit.defensivePower}
        </span>
        <span>Cg {unit.courage ?? "—"}</span>
        <span>Mv {unit.move}″</span>
      </span>

      <span className="flex w-full items-center gap-2">
        <DamageTrack damage={unit.damage} />
        <span className="sr-only">
          Damage boxes: {unit.damage.green} green, {unit.damage.yellow} yellow,{" "}
          {unit.damage.red} red
        </span>
      </span>

      {map(unit.abilities, ({ name, text }) => (
        <span key={name} className="text-[10px] leading-snug text-bone-500">
          <span className="font-bold text-bone-300">{name}.</span> {text}
        </span>
      ))}
      {map(unit.keywords, (id) => (
        <span key={id} className="text-[10px] leading-snug text-bone-500">
          <span className="font-bold text-ember-500">{KEYWORDS[id].name}.</span>{" "}
          {KEYWORDS[id].text}
        </span>
      ))}
    </div>
  );
}
