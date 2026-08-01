# Battle Map

A digital war table for **Battleground: Fantasy Warfare** (Your Move Games).
Two armies stand on a shared surface — a TV lying flat under an IR touch
frame, or a projected image with the same frame around it — and both players
march their units with their hands. When two units engage, the table works out
the attack.

It is the table half of [BattleDeck](https://github.com/peterclark/battledeck).
BattleDeck is a calculator you hold: you tap in the dice, the Skill and Power
ranks, and every situational modifier, and it tells you what to roll. Battle
Map runs BattleDeck's rules core unchanged, but the board supplies the inputs
itself — because unlike a phone sitting next to the table, the table can see
the table.

## What the board works out on its own

March a regiment into an enemy and the engagement opens with the modifiers
already asserted, each one labelled with the board fact behind it:

- **Charging**, and which band — the unit marched into contact this turn, and
  the 4+/3− split comes off its attack dice
- **Flanking** and **Rear Attack** — from where the attacker stands in the
  defender's 90° arcs, which the board draws so nobody has to argue about them
- **Long Range** (7–14") and **Extreme Range** (15"+), and whether the shot is
  inside the weapon's printed range at all
- **In the Yellow** / **In the Red** — from the attacker's own damage track
- **Cavalry / Large / Colossal Target** — from the defender's keywords
- **Attack my Flank** / **Attack my Rear** — from *other* enemies in contact
  with the attacker, which only something seeing the whole board can spot
- **Foe Damaged**, **Foe Routing**

A unit's own card rules fire off those assertions the same way they do in
BattleDeck — Spears lose a die when charging and gain Skill against Cavalry,
archers take their penalty while Engaged — and each shows up as its own line
in the breakdown.

Everything the board asserts is marked with a gold rule and its reason. Tapping
any modifier overrules the board: it is a model of the game, and where the
model and the players disagree, the players are right.

## Handling the table

| Gesture | What it does |
| --- | --- |
| Drag a unit | March it. The board holds the tape measure — the march clamps to the unit's printed Movement, measured from where the turn found it |
| Hold a unit, touch the board with a second finger | Turn it to face where you touched |
| March into an enemy | Opens the engagement, and counts as a charge |
| Tap your unit, then tap an enemy | Declares an attack without marching — this is how you shoot |
| Double-tap a unit | Rescind its order; it marches back to where the turn began |
| **New Turn** | Every unit's Movement allowance resets to where it now stands; charges and turn-scoped buffs clear |

Input is the Pointer Events API keyed by `pointerId`, so every contact the
touch frame reports is tracked independently and both players can march at the
same time without stealing each other's grip. A mouse arrives down the same
path, which is what makes this testable on a desk.

## Running it

```sh
npm install
npm run dev      # Vite dev server
npm test         # the engagement suite
npm run lint
npm run build    # production build to dist/
```

Node 20 (`.nvmrc`).

## Layout

```
src/
  engagement.js       board geometry -> BattleDeck modifiers -> the three numbers
  engagement.test.js  real printed numbers off real unit cards
  App.jsx             board state, turns, the open engagement
  CombatPanel.jsx     the cards, the three numbers, the breakdown, the grid
  UnitCard.jsx        one unit's stat bar and damage track
  table/
    board.js          the inch board, deployment, movement clamping, turns
    Battlefield.jsx   canvas rendering and multi-touch pointer handling
  rules/              VENDORED FROM BATTLEDECK — see src/rules/README.md
```

The board is modelled in inches, the unit the printed cards use, so a unit's
Movement and a weapon's Range are drawn to scale and read straight off the
card. 48" × 27" is a four-foot table at 16:9, the aspect of the panel or the
projected image it is drawn on.

`src/rules/` is a verbatim copy of BattleDeck's rules layer and is never edited
here; `node scripts/sync-rules.mjs ../battledeck` re-copies it.

## Hardware

The app is a plain web page and assumes nothing beyond a browser with Pointer
Events, so either build works:

- **Flat TV table.** A 55" 4K panel laid flat on a leg frame, a 55" 10-point
  IR touch overlay on top, tempered glass over that. Avoid OLED — the panel
  sags when it lies flat.
- **Projection.** The same IR frame mounted around a projected image on a
  wall. IR frames sense an infrared grid rather than the display, so they work
  over any flat surface, and a vertical surface needs no protective glass.

## Known rough edges

- Labels and card text render upright, so they read correctly from one long
  edge of the table. Orienting each army's text toward its own player is the
  obvious next move for a surface two people stand across.
- Only one engagement is open at a time.
- Command Cards are plumbed through `resolveEngagement` but have no UI yet.
- Units are discs; the physical game uses rectangular stands of varying
  width, so contact and arc checks are close rather than exact.

## Credit

*Battleground: Fantasy Warfare* is a game by Your Move Games. The unit cards
transcribed under `src/rules/data/` are their work; this is an unofficial
table for playing it.
