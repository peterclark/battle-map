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

## Getting to the table

A title screen, then both players choose from every faction BattleDeck has
transcribed, then each builds a list from that faction with a running points
total and how far it sits from the other's — the number two players actually
negotiate over. The pickers use BattleDeck's own UI: same plates, same stat
abbreviations, same damage track, same rules text under each unit, so a player
moving from the phone to the table does not have to relearn the screen.

## Setting out

Before the first turn the armies form up. Each player may put their units
anywhere inside their own band of table — the near nine inches, tinted in
their colour — in any arrangement they like: a single line, a deep column,
everything on one flank, nothing on the other. What they may not do is start
closer to the enemy than the line allows, so a card dragged past it stops
there.

That leaves nine inches of open ground between the armies, about a turn's
march for most units. **Begin Battle** anchors every unit where it stands, so
the first turn's Movement is measured from the line the player chose rather
than from wherever the table happened to deal them.

Nine inches a side is a house line rather than a rule off any card —
Battleground's own scenarios vary it — so it is one constant,
`DEPLOY_DEPTH_INCHES`, to change.

## The cards

A unit is a card, not a counter. Each is drawn as SVG — a field of figures
seen from above, the unit's name on a banner, a bar of stat glyphs, the
green/yellow/red damage track and the standing-order disc — and blitted onto
the board as that unit's token. What a unit fields is read off its own card
rather than hand-listed: Cavalry get riders, Spears get long hafts, a Large or
Colossal unit gets a single behemoth instead of a rank, and archers form up
looser than heavy infantry.

The artwork is original. It follows the shape rank-and-file wargame cards have
used for decades, but nothing traces or derives from Your Move Games' printed
art — the same rule BattleDeck's own art script sets for itself.

Because a card is a rectangular stand, contact is a separating-axis test
between two oriented rectangles rather than two circles overlapping: a card
turned side-on reaches further than one presenting its narrow depth, exactly
as the printed stands do.

## Cards or figures

The header switches the board between the two. Cards are the default, because
every unit has one; figures are modelled army by army and a unit without a
sculpt keeps its card art rather than borrowing someone else's.

With figures on, a stand gives up its drawn ranks and keeps its banner, stat
bar and damage track — one army to a card, and the players still read what
they need off it. The figures stand in the band the ranks were drawn in.

Everything is built for a camera looking straight down, which is a harsher
constraint than it sounds: a spear held upright is a dot, a dark figure on
dark turf disappears, and a lone sculpt reads far worse than twenty of the
same parts in ranks. `.claude/skills/army-animation/` is the working guide,
and `docs/creature-brief.md` holds the agreed direction per faction.

Three.js loads on the first switch and not before, so a player who never turns
figures on never pays for them.

## When a unit is destroyed

Marking off the last damage box takes a unit out of the game. Its stand stays
where it fell as a record of what happened, dimmed to a third so it reads as
visibly behind the living, and it stops answering to anything: it cannot be
marched, selected, attacked, or charged into, and it no longer counts as
pinning an enemy's flank or rear.

The one gesture it still answers to is a double-tap, which rubs out a box and
brings it back at In the Red. That exists because a destroyed unit is
otherwise unreachable — a card marked off by accident could only be recovered
by rebuilding the whole muster.

## Which way the panel faces

An engagement opens the panel at the edge of the board belonging to whoever
called the attack, facing that seat. Two players stand on opposite sides of a
table and there is no orientation that suits both, so the one with a decision
to make gets the readable copy — which means Player One's panel is upside
down on a monitor and the right way up to the person it is for.

## Handling the table

| Gesture | What it does |
| --- | --- |
| Drag a card | March it. The board holds the tape measure — the march clamps to the unit's printed Movement, measured from where the turn found it |
| Hold a card, touch the board with a second finger | Turn it to face where you touched |
| March into an enemy | Opens the engagement, and counts as a charge |
| Tap your unit, then tap an enemy | Declares an attack without marching — this is how you shoot |
| Double-tap a unit | Rescind its order; it marches back to where the turn began |
| **New Turn** | Every unit's Movement allowance resets to where it now stands; charges and turn-scoped buffs clear |
| Double-tap a destroyed unit | Rub out one damage box and bring it back into the fight — the undo for a mis-tapped kill |

While setting out, dragging is bounded by the deployment line instead of by
Movement, and nothing can be attacked — no army is committed until both are
formed up.

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
  App.jsx             the screen flow, board state, turns, the open engagement
  CombatPanel.jsx     the cards, the three numbers, the breakdown, the grid
  UnitCard.jsx        one unit's stat bar and damage track
  art/
    cardFace.js       original SVG card art, and the damage-box geometry the
                      board draws its marks over
    cardImage.js      rasterises a card face once and caches it
    creatures/
      roster.js       which figures a unit fields -- no Three.js, so the board
                      can ask on every frame in card mode
      registry.js     which builder each kind maps to -- dynamically imported
      lizardfolk3d.js the Lizardmen: three peoples and their beasts
      saurians3d.js   the Lizardmen's Large saurians
      infantry3d.js   foot, by weapon, palette and build -- five weapons,
                      eight palettes, four body plans
      cavalry3d.js    horse and wolf, by mount, rider and what they carry
      warMachine3d.js ballistae, catapults and chariots, with their crews
      brutes3d.js     trolls, ogres, giants -- the shape with no silhouette
      dragon3d.js     wings, and the hydra that manages without them
      trex3d.js       the Tyrannosaurus Rex, and the shared scene and camera
  setup/
    TitleScreen.jsx   BattleMap, and the way in
    ArmySelect.jsx    both players choose a faction
    UnitSelect.jsx    both players build a list, with running points
    UnitRow.jsx       one unit on the army list, BattleDeck's row layout
  table/
    board.js          the inch board, rosters, deployment, movement, turns
    Battlefield.jsx   canvas rendering and multi-touch pointer handling
    CreatureLayer.jsx the figures, on a second canvas sharing the board's frame
  rules/              VENDORED FROM BATTLEDECK — see src/rules/README.md

demo/
  creature-lab.html   one creature at a time, large enough to work on
  bench.html          what a board of animated figures costs to draw
```

The board is modelled in inches, the unit the printed cards use, so a unit's
Movement and a weapon's Range are drawn to scale and read straight off the
card. 48" × 27" is a four-foot table at 16:9, the aspect of the panel or the
projected image it is drawn on.

The two players stand at the long edges, and that is what makes the cards
readable: a unit's card faces the enemy, so it faces away from its owner — and
text drawn away from you, on a table lying flat, is text the right way up when
you are the one standing behind it. Each player reads their own regiments
without the table having to take sides.

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

- Only one engagement is open at a time.
- Destroyed units stay on the table rather than being cleared away. They are
  inert and dimmed, but they still occupy their square of board.
- Command Cards are plumbed through `resolveEngagement` but have no UI yet.
- The standing-order disc is drawn on every card but nothing writes to it yet;
  orders are still something the players hold between them.
- Rosters live in memory, so a reload starts a fresh muster.
- Every stand is the same 2.5" × 1.75" card, scaled up for Large and Colossal.
  The physical game varies stand width by unit, so frontages are close rather
  than exact.
- Every unit in every faction has figures — 89 units across 57 creature kinds,
  built from 9 rigs. Only the Lizardmen brief has been looked at on a table;
  the rest were written from unit names and stat lines and are waiting on a
  second opinion.

## Credit

*Battleground: Fantasy Warfare* is a game by Your Move Games. The unit cards
transcribed under `src/rules/data/` are their work; this is an unofficial
table for playing it.
