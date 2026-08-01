import { map } from "lodash";
import classNames from "classnames";
import { FaArrowLeft, FaCheck } from "react-icons/fa";
import { FACTIONS } from "../rules/data/index.js";
import { SIDES } from "../table/board.js";

const FactionRow = ({ faction, selected, takenBy, onPick }) => (
  <button
    type="button"
    className={classNames(
      "plate flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left",
      selected && "plate-on-gold"
    )}
    aria-pressed={selected}
    onClick={onPick}
  >
    <span className="min-w-0 font-display text-sm tracking-wider text-bone-100">
      {faction.name}
    </span>
    <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-bone-500">
      {takenBy && !selected && (
        <span className="text-steel-300">{takenBy} chose this</span>
      )}
      {faction.units.length} units
      {selected && <FaCheck className="text-[10px] text-ember-500" aria-hidden />}
    </span>
  </button>
);

const PlayerColumn = ({ seat, factionId, otherFactionId, otherName, onPick }) => (
  <section className="flex min-w-0 flex-1 flex-col gap-2" aria-label={seat.name}>
    <header
      className="flex items-center gap-2 border-b-2 pb-1.5"
      style={{ borderColor: seat.color }}
    >
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: seat.color }}
        aria-hidden
      />
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-bone-100">
        {seat.name}
      </h2>
    </header>
    <div className="flex flex-col gap-1.5">
      {map(FACTIONS, (faction) => (
        <FactionRow
          key={faction.id}
          faction={faction}
          selected={faction.id === factionId}
          takenBy={faction.id === otherFactionId ? otherName : null}
          onPick={() => onPick(faction.id)}
        />
      ))}
    </div>
  </section>
);

/**
 * Both players choose a faction, side by side on the one surface. Every
 * faction BattleDeck has transcribed is offered, and both may field the same
 * one — a mirror match is legal, so the other player's pick is flagged
 * rather than locked out.
 */
export default function ArmySelect({ players, onPick, onBack, onConfirm }) {
  const ready = Boolean(players.one.factionId && players.two.factionId);

  return (
    <div className="flex h-full w-full flex-col bg-iron-900">
      <header className="flex shrink-0 items-center gap-3 border-b border-iron-500 px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="plate flex h-9 w-9 items-center justify-center text-bone-300"
          aria-label="Back to title"
        >
          <FaArrowLeft />
        </button>
        <h1 className="flex-1 text-center font-display text-base font-bold uppercase tracking-[0.25em] text-ember-400">
          Choose your armies
        </h1>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!ready}
          className={classNames(
            "plate px-5 py-2 font-display text-xs font-bold uppercase tracking-[0.2em]",
            ready && "plate-on-ember"
          )}
        >
          Muster
        </button>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto p-4">
        {map(SIDES, (seat) => {
          const other = seat.side === "one" ? "two" : "one";
          return (
            <PlayerColumn
              key={seat.side}
              seat={seat}
              factionId={players[seat.side].factionId}
              otherFactionId={players[other].factionId}
              otherName={other === "one" ? "Player One" : "Player Two"}
              onPick={(factionId) => onPick(seat.side, factionId)}
            />
          );
        })}
      </div>
    </div>
  );
}
