---
name: army-animation
description: Build or revise the animated 3D figures a unit fields on the battle map — new armies, new creature kinds, or fixing figures that read poorly on the table. Use when asked to make a faction's units look right, add figures for units that only have card art, or adjust how figures move. Covers the top-down camera constraints, the roster/registry split, gaits, the performance budget, and how to verify at true stand scale.
---

# Animating an army

The board can show a unit two ways: its printed card, or modelled figures
standing on that card. This skill is about the second.

Read `docs/creature-brief.md` for the per-faction direction that has been
agreed so far. If the army you are working on is not in it, ask for a
paragraph of direction before sculpting — see *Getting direction* below.

## The one rule that is not negotiable

**The art must be original.** Never work from photographs of the printed
cards, and never reproduce Your Move Games' artwork. This is the rule
BattleDeck sets for itself in `scripts/generate-art.mjs`, and it is the
reason this project's art is its own. Work from the unit's *name*, its
*keywords*, its *stat line* and written direction. "Trog Spearmen, squat and
toad-like, 243 points, Spears" is enough to sculpt from. A photo is not
needed and must not be used.

## The camera looks straight down

This constraint dominates every decision, and violating it is the single
most common way a figure fails. The camera is orthographic, directly
overhead, because the table is a flat panel two players stand across and any
tilt favours whoever is on the low side.

What follows from that:

**A vertical object has no silhouette.** A spear held upright is a dot. An
axe held high is a dot. This has burned this project twice — spears at 66°
from vertical were invisible, and axes went the same way. Both had to be
shouldered, to roughly 29° and 50°. **Pose weapons for legibility, not for
accuracy.** A shouldered spear reads as a spear; a correctly-held one reads
as nothing.

**Breadth is what you have to work with.** Shields, cloaks, wings, crests,
fanned tails, splayed limbs — anything that presents area to a camera above
it. A shield is the most valuable thing an infantryman carries here, and it
is worth canting forward so it presents its face upward.

**A tail is the cheapest species read there is.** From directly above, a
tail extending behind a body says *reptile* before any other detail
registers. The same trick works for a wolf's brush, a cloak, a banner.

**A formation manufactures a silhouette out of parts that have none.** This
was the finding that decided the whole approach: a single figure built from
capsules reads as nothing from overhead, and twenty of the same capsules in
ranks read unmistakably as infantry. The decisive axis is *one body versus
many*, not hand-drawn versus sculpted. If a single figure is not reading,
consider whether it should be a formation instead of a better sculpt.

## Value contrast beats detail

At true table scale a stand is 2.5" × 1.75" — about 165 × 115 px on a 4K
55" panel. Twenty figures in that space gives each one roughly 30 px. At
that size:

- Detail below about 4 px is wasted work.
- **A dark figure on the dark green field disappears.** The Orc Axemen block
  suffers from exactly this: `0x2f2a24` armour reads as a black lump. Give
  each figure at least one element that is clearly lighter or clearly darker
  than the turf beneath it — a pale shield face, a bone crest, a bright
  weapon head.
- Silhouette and value do the work. Texture and small geometry do not.

**Verify at stand scale, not at lab scale.** The lab shows a creature many
times the size it will be played at, where everything looks good. That is not
the test. The test is a screenshot of the actual board with the figures on
their stands. This project has already made the mistake of judging a creature
at lab scale and being wrong about it — twice, counting the Ancients.

## How the pieces fit together

Three files, and the split matters:

| File | Holds | Loads Three.js |
|---|---|---|
| `src/art/creatures/roster.js` | which *kind* a unit fields, and how much of its stand to fill | no |
| `src/art/creatures/registry.js` | which *builder* each kind maps to | yes |
| `src/art/creatures/<name>3d.js` | the builder and poser themselves | yes |

`roster.js` must stay free of Three.js. The board asks "does this unit have
figures?" on every frame in card mode too, and that question has to be
answerable without loading a renderer. Breaking this puts 600 KB back into
the app's own bundle.

`CreatureLayer.jsx` does the rest: it scales each rig to the stand it
occupies by measuring its bounding box, so builders can model at whatever
size reads best on their own.

## Adding a creature kind

1. **Write the builder** in `src/art/creatures/<name>3d.js`, exporting
   `build<Name>()` and `pose<Name>(rig, time, state)`.
   - Model facing **-Z**, standing on **y = 0**. `CreatureLayer` handles
     board placement and heading.
   - Share geometry across figures. One `CapsuleGeometry` reused by twenty
     bodies costs one body's worth of buffers; only the transforms differ.
     See `infantry3d.js` for the pattern.
   - Return the parts the poser needs: `{ root, ... }`.
2. **Add the kind** to `KINDS` in `roster.js`, with a `match` predicate and
   a `fill`. Order matters — named units first, archetypes after. Below 1,
   figures sit inside the printed edge; above 1 they overhang, which is what
   makes a monster read as a monster.
3. **Point the kind at the builder** in `registry.js`.
4. **Verify** — see below.

## Gaits

Every poser takes a state. The board supplies it from what it already knows:
`attack` if the unit is in the open engagement, `march` if it has moved from
its order anchor this turn, `idle` otherwise.

A `GAITS` table of scalar multipliers, with the pose written once in terms of
those scalars, is how the existing builders do it and is worth copying.

**Phase, not lockstep.** Give every figure in a block its own phase, hashed
from its position, spread tightly around a common rhythm. Perfect unison
reads as a machine; random phase reads as a crowd; a tight spread reads as
soldiers. Never use `Math.random()` — jitter must be stable across frames or
the block shimmers.

## The performance budget

Measured on a Mac mini, native 4K, shadows on, ten units on the board
(a 1,250-point army is about five units, so ten is a full game):

- **6ms of CPU** against a 16.7ms frame budget
- ~3,600 meshes, ~7,200 submitted draw calls
- Posing 200 figures costs about **1ms** — animation logic is effectively free

Headroom is real but not unlimited. Rules of thumb:

- **~20 meshes per figure, ~20 figures per unit.** The Orc Axemen block sits
  at exactly this and is comfortable.
- Doubling to twenty units at 1080p reached 90% of budget, so do not treat
  the ceiling as far away.
- Pose cost is not the constraint; **mesh count is**. If you need more
  figures, cut meshes per figure rather than reaching for instancing.
- Shadows cost about 1.5ms at real board size. Keep them — they are what
  makes figures sit on the ground rather than float above it.

`demo/bench.html?units=10` measures this. It must be run on the target
hardware; a headless container uses a software rasteriser and its frame
times mean nothing.

## Verifying

Always do both:

1. **The lab** — `demo/creature-lab.html?kind=<kind>` for working on a
   creature in isolation, where you can actually see what you are doing. It
   is driven by the registry, so every kind appears there automatically.
2. **The board at stand scale** — build, preview, drive the app to the
   battlefield, flip the toggle to Figures, and screenshot. This is the only
   test that counts. Use a large viewport (3200 × 1800 or more) so a stand
   renders near its true size, and clip the screenshot to a few stands
   rather than squinting at the whole board.

Check specifically:

- Can you tell what the unit *is* from the silhouette alone?
- Does it read against the turf, or vanish into it?
- Are the weapons visible?
- Does it stay inside its stand, and does it turn with it?
- Do the three gaits look different from each other?

## Getting direction

If the faction has no entry in `docs/creature-brief.md`, ask for a paragraph
before building. What is useful:

- **Body plan** — upright, hunched, quadruped, serpentine
- **Proportions** — squat and broad, tall and lean
- **The distinguishing feature** — crest, tail, carapace, extra limbs
- **Palette** — and remember it has to hold up against dark green turf
- **How the breeds within a faction differ** from each other

What is not useful, and must not be requested: photographs of the printed
cards.

Write what you are told into `docs/creature-brief.md` before building, so
the next revision starts from the agreed direction rather than re-deriving
it.
