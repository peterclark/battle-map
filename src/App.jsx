import { useCallback, useMemo, useState } from "react";
import { find, forEach, map, omit } from "lodash";
import Battlefield from "./table/Battlefield.jsx";
import CreatureLayer from "./table/CreatureLayer.jsx";
import CombatPanel from "./CombatPanel.jsx";
import TitleScreen from "./setup/TitleScreen.jsx";
import ArmySelect from "./setup/ArmySelect.jsx";
import UnitSelect from "./setup/UnitSelect.jsx";
import { MODIFIERS } from "./rules/modifiers.js";
import { FACTIONS_BY_ID } from "./rules/data/index.js";
import { preferredMode, resolveEngagement } from "./engagement.js";
import {
  SIDES,
  deployTokens,
  rosterPoints,
  stillStanding,
  withDamage,
  withNewTurn,
} from "./table/board.js";

const EMPTY_PLAYERS = {
  one: { factionId: null, roster: {} },
  two: { factionId: null, roster: {} },
};

export default function App() {
  // title -> armies -> units -> deploy -> battle
  const [phase, setPhase] = useState("title");
  const [players, setPlayers] = useState(EMPTY_PLAYERS);
  const [tokens, setTokens] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [turn, setTurn] = useState(1);
  // { attackerId, defenderId, mode, overrides } — the attack currently on
  // the table. Only one at a time: two players resolve one engagement
  // together, then move on.
  const [engagement, setEngagement] = useState(null);
  // Cards or figures. Cards are the default because they are the game's own
  // idiom and every unit has one; figures are modelled army by army.
  const [figures, setFigures] = useState(false);

  const attacker = engagement && find(tokens, { id: engagement.attackerId });
  const defender = engagement && find(tokens, { id: engagement.defenderId });

  const result = useMemo(() => {
    if (!attacker || !defender) return null;
    return resolveEngagement(attacker, defender, {
      mode: engagement.mode,
      overrides: engagement.overrides,
      // Only the living. `others` is what raises Attack my Flank and Attack
      // my Rear, and a destroyed unit standing where it fell is not pinning
      // anybody — leaving it in would have the board assert a modifier the
      // players can see is wrong.
      others: stillStanding(tokens),
    });
  }, [attacker, defender, engagement, tokens]);

  const pickFaction = (side, factionId) =>
    setPlayers((current) => ({
      ...current,
      // Changing faction abandons a list built from the old one
      [side]: { factionId, roster: {} },
    }));

  const setRoster = (side, roster) =>
    setPlayers((current) => ({
      ...current,
      [side]: { ...current[side], roster },
    }));

  const takeTheField = () => {
    setTokens(deployTokens(players));
    setSelectedId(null);
    setEngagement(null);
    setTurn(1);
    setPhase("deploy");
  };

  // Both armies are formed up. Anchoring every unit where it now stands is
  // what makes the first turn's Movement measure from the line a player
  // chose rather than from where the table happened to deal them.
  const beginBattle = () => {
    setTokens(withNewTurn);
    setSelectedId(null);
    setPhase("battle");
  };

  const handleEngage = useCallback(
    (attackerId, defenderId) => {
      const from = find(tokens, { id: attackerId });
      const to = find(tokens, { id: defenderId });
      if (!from || !to) return;
      setEngagement({
        attackerId,
        defenderId,
        mode: preferredMode(from, to),
        overrides: {},
      });
      setSelectedId(null);
    },
    [tokens]
  );

  // Switching stance drops any manual override belonging to the stance being
  // left — a Hard Cover tap has no meaning once the units are swinging axes.
  const handleModeChange = (mode) =>
    setEngagement((current) => {
      const overrides = { ...current.overrides };
      forEach(MODIFIERS, (mod, id) => {
        if (mod.category && mod.category !== mode) delete overrides[id];
      });
      return { ...current, mode, overrides };
    });

  const handleOverride = (id, value) =>
    setEngagement((current) => {
      // Tapping a modifier back to exactly what the board already asserted
      // hands control of it back to the board
      const boardValue = result?.auto.includes(id);
      const isBoardValue = typeof value === "boolean" && value === boardValue;
      return {
        ...current,
        overrides: isBoardValue
          ? omit(current.overrides, id)
          : { ...current.overrides, [id]: value },
      };
    });

  const handleMark = (tokenId, marked) =>
    setTokens((current) =>
      map(current, (token) =>
        token.id === tokenId ? withDamage(token, marked) : token
      )
    );

  const handleNewTurn = () => {
    setTokens(withNewTurn);
    setEngagement(null);
    setSelectedId(null);
    setTurn((current) => current + 1);
  };

  if (phase === "title") {
    return <TitleScreen onStart={() => setPhase("armies")} />;
  }

  if (phase === "armies") {
    return (
      <ArmySelect
        players={players}
        onPick={pickFaction}
        onBack={() => setPhase("title")}
        onConfirm={() => setPhase("units")}
      />
    );
  }

  if (phase === "units") {
    return (
      <UnitSelect
        players={players}
        onRosterChange={setRoster}
        onBack={() => setPhase("armies")}
        onConfirm={takeTheField}
      />
    );
  }

  const deploying = phase === "deploy";

  return (
    <div className="flex h-full w-full flex-col bg-iron-900">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-iron-500 px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-base font-bold uppercase tracking-[0.2em] text-ember-400">
            BattleMap
          </h1>
          <div className="flex items-center gap-3">
            {map(SIDES, (seat) => (
              <span
                key={seat.side}
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-bone-300"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: seat.color }}
                />
                {FACTIONS_BY_ID[players[seat.side].factionId]?.name}
                <span className="text-bone-500">
                  {rosterPoints(players[seat.side].roster)} pts
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-bone-500">
            {deploying ? "Deployment" : `Turn ${turn}`}
          </span>
          <button
            type="button"
            onClick={() => setFigures((on) => !on)}
            aria-pressed={figures}
            className={`plate px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.2em] ${
              figures ? "text-ember-400" : ""
            }`}
          >
            {figures ? "Figures" : "Cards"}
          </button>
          <button
            type="button"
            onClick={deploying ? beginBattle : handleNewTurn}
            className={`plate px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.2em] ${
              deploying ? "text-ember-400" : ""
            }`}
          >
            {deploying ? "Begin Battle" : "New Turn"}
          </button>
          <button
            type="button"
            onClick={() => setPhase("units")}
            className="plate px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.2em]"
          >
            Rebuild
          </button>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Battlefield
          tokens={tokens}
          onTokensChange={setTokens}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEngage={handleEngage}
          engagement={engagement}
          figures={figures}
          deploying={deploying}
        />
        <CreatureLayer
          tokens={tokens}
          engagement={engagement}
          enabled={figures}
        />
        {!engagement && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-mono text-[10px] uppercase tracking-wider text-bone-500">
            {deploying
              ? "Set your army out anywhere inside your own colour · hold a card and touch the board to turn it · Begin Battle when both sides are content"
              : "Drag a card to march it · hold it and touch the board to turn it · march into an enemy or tap one then the other to attack · double-tap to rescind the order"}
          </p>
        )}

        {/* The panel floats over the board rather than squeezing it: cards
            must not shift underneath the players' hands when an engagement
            opens.

            It arrives at the edge belonging to whoever called the attack, and
            faces that seat. Two players stand on opposite sides of a table, so
            there is no orientation that suits both — the one who has a
            decision to make gets the readable copy. Player One's panel is
            therefore upside down on a monitor and the right way up to the
            person it is for. */}
        {result && (
          <div
            className={
              attacker.side === "one"
                ? "absolute inset-x-0 top-0 rotate-180"
                : "absolute inset-x-0 bottom-0"
            }
          >
            <div className="panel-in">
              <CombatPanel
                result={result}
                attacker={attacker}
                defender={defender}
                mode={engagement.mode}
                onModeChange={handleModeChange}
                overrides={engagement.overrides}
                onOverride={handleOverride}
                onMark={handleMark}
                portrait={figures}
                onClose={() => setEngagement(null)}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
