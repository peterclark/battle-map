import { useState } from "react";
import { filter, map, size, sortBy } from "lodash";
import classNames from "classnames";
import UnitCard from "./UnitCard.jsx";
import { MODIFIERS, PLATE_ON } from "./rules/modifiers.js";
import { attackProfile } from "./rules/data/index.js";

const signed = (value) => (value > 0 ? `+${value}` : `${value}`);

// One of the three numbers the players actually roll against, with its
// working shown underneath the way BattleDeck prints it.
const StatCard = ({ title, value, hint, overkill, terms, tone }) => (
  <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-iron-500 bg-iron-800/80 p-3">
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-bone-500">
        {title}
      </span>
      {overkill > 0 && (
        <span className="rounded bg-ember-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-ember-400">
          OK: {overkill}×6→5
        </span>
      )}
    </div>
    <span className={classNames("font-display text-6xl leading-none", tone)}>
      {value}
    </span>
    <span className="mt-1 text-[11px] text-bone-500">{hint}</span>
    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 border-t border-iron-600 pt-2 text-[11px] text-bone-300">
      {map(terms, (term, index) => (
        <span key={index} className="whitespace-nowrap">
          <span
            className={
              term.amount < 0
                ? "text-blood-400"
                : term.base
                  ? ""
                  : "text-moss-300"
            }
          >
            {term.base ? term.amount : signed(term.amount)}
          </span>
          <span className="ml-0.5 text-bone-500">{term.code ?? term.label}</span>
        </span>
      ))}
    </div>
  </div>
);

// The modifier grid. Anything the board asserted from the units' positions
// carries a gold rule and its reason; tapping any tile overrules the board,
// because where the model and the players disagree the players are right.
const ModifierGrid = ({ result, mode, overrides, onOverride }) => {
  const visible = sortBy(
    filter(
      MODIFIERS,
      (mod) => mod.id !== "reset" && (!mod.category || mod.category === mode)
    ),
    "position"
  );

  return (
    <div className="grid grid-cols-6 gap-1 sm:grid-cols-8 lg:grid-cols-12">
      {map(visible, (mod) => {
        const state = result.modifiers[mod.id];
        const on = state?.on;
        const auto = result.auto.includes(mod.id);
        const count = state?.count ?? 0;
        const next = mod.maxCount
          ? (count + 1) % (mod.maxCount + 1)
          : !on;

        return (
          <button
            key={mod.id}
            type="button"
            title={result.reasons[mod.id] ?? mod.name.replace(/\n/g, " ")}
            aria-pressed={Boolean(on)}
            onClick={() => onOverride(mod.id, next)}
            className={classNames(
              "plate flex h-14 flex-col items-center justify-center px-1 text-center text-[10px] font-semibold leading-tight",
              on && PLATE_ON[mod.color],
              auto && "plate-auto"
            )}
          >
            <span className="whitespace-pre-line">{mod.name}</span>
            {mod.maxCount && count > 0 && (
              <span className="mt-0.5 text-[10px] text-ember-400">×{count}</span>
            )}
            {Boolean(overrides[mod.id] !== undefined) && (
              <span className="mt-0.5 text-[9px] uppercase tracking-wide text-bone-500">
                manual
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * What the table shows when two units engage: both cards, the three numbers
 * derived by BattleDeck's own rules core, and every modifier that fed them —
 * with the board's own assertions marked so the players can see the table's
 * reasoning rather than trusting it.
 */
export default function CombatPanel({
  result,
  attacker,
  defender,
  mode,
  onModeChange,
  overrides,
  onOverride,
  onMark,
  portrait,
  onClose,
}) {
  const canMelee = Boolean(attackProfile(attacker.unit, "melee"));
  const canShoot = Boolean(attackProfile(attacker.unit, "ranged"));
  // The grid stays folded away by default: the board already asserts most of
  // what a phone would have made the players tap, and an unfolded grid covers
  // the rank of units standing at the near edge of the table.
  const [showModifiers, setShowModifiers] = useState(false);
  const manualCount = size(overrides);

  return (
    <section
      className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto border-t-2 border-ember-500/40 bg-iron-900/95 p-4 shadow-[0_-8px_32px_rgba(0,0,0,0.7)]"
      aria-label="Engagement"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-xl text-bone-100">
            {attacker.unit.name}{" "}
            <span className="text-bone-500">attacks</span>{" "}
            {defender.unit.name}
          </h2>
          <span className="text-[11px] uppercase tracking-wider text-bone-500">
            {result.distance.toFixed(1)}&quot; · {result.arc} arc
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowModifiers((current) => !current)}
            aria-expanded={showModifiers}
            className={classNames(
              "plate px-4 py-2 text-xs font-semibold uppercase tracking-wider",
              manualCount > 0 && PLATE_ON["bg-yellow-400"]
            )}
          >
            Modifiers{manualCount > 0 && ` · ${manualCount}`}
          </button>

          <div className="flex gap-1" role="group" aria-label="Attack stance">
            <button
              type="button"
              disabled={!canMelee}
              onClick={() => onModeChange("melee")}
              className={classNames(
                "plate px-4 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-30",
                mode === "melee" && PLATE_ON["bg-red-400"]
              )}
            >
              Melee
            </button>
            <button
              type="button"
              disabled={!canShoot}
              onClick={() => onModeChange("ranged")}
              className={classNames(
                "plate px-4 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-30",
                mode === "ranged" && PLATE_ON["bg-green-400"]
              )}
            >
              Ranged
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="plate px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          >
            Disengage
          </button>
        </div>
      </header>

      {!result.legal && (
        <p className="rounded border border-blood-500/60 bg-blood-600/15 px-3 py-2 text-sm text-blood-300">
          {result.outOfRange
            ? `Out of range — ${result.distance.toFixed(1)}" to a target at ${result.profile?.range}".`
            : mode === "ranged"
              ? `${attacker.unit.name} is engaged and cannot shoot.`
              : `${attacker.unit.name} is not in contact with ${defender.unit.name}.`}{" "}
          The numbers below are shown anyway, so you can see what the attack
          would be.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_2fr_1fr]">
        <UnitCard
          token={attacker}
          mode={mode}
          role="attacker"
          onMark={(marked) => onMark(attacker.id, marked)}
          portrait={portrait}
        />

        <div className="flex gap-3">
          <StatCard
            title="Dice"
            value={result.diceToRoll}
            hint={result.diceLocked ? "locked by the card" : "dice to roll"}
            terms={result.breakdown.dice}
            tone="text-bone-100"
          />
          <StatCard
            title="Hit"
            value={result.rollToHit}
            hint="hit on this or less"
            overkill={result.hitOverkill}
            terms={result.breakdown.hit}
            tone="text-ember-400"
          />
          <StatCard
            title="Wound"
            value={result.rollToWound}
            hint="wound on this or less"
            overkill={result.woundOverkill}
            terms={result.breakdown.wound}
            tone="text-blood-400"
          />
        </div>

        <UnitCard
          token={defender}
          mode={mode}
          role="defender"
          onMark={(marked) => onMark(defender.id, marked)}
          portrait={portrait}
        />
      </div>

      {Boolean(result.auto.length) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-ember-500/25 bg-ember-600/5 px-3 py-2 text-[11px] text-bone-300">
          <span className="font-semibold uppercase tracking-wider text-ember-400">
            The board sees
          </span>
          {map(result.auto, (id) => (
            <span key={id}>{result.reasons[id]}</span>
          ))}
        </div>
      )}

      {Boolean(result.abilities.length) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-ember-500/25 bg-ember-600/5 px-3 py-2 text-[11px] text-bone-300">
          <span className="font-semibold uppercase tracking-wider text-ember-400">
            Card rules in play
          </span>
          {map(result.abilities, (ability, index) => (
            <span key={index}>
              {ability.name} ({ability.bonus.map(signed).join(" / ")})
            </span>
          ))}
        </div>
      )}

      {showModifiers && (
        <ModifierGrid
          result={result}
          mode={mode}
          overrides={overrides}
          onOverride={onOverride}
        />
      )}
    </section>
  );
}
