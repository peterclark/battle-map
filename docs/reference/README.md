# Reference builds

Standalone Three.js pages, kept because they are the direction a rig was
built *against*. None is part of the app: nothing under `src/` imports them,
the Vite build never sees them, and they are excluded from lint.

| File | What it is |
| --- | --- |
| `dragon.html` | A dragon, built as one tapered spine with wings, legs and a head hung off it |
| `ballista.html` | A dwarven field ballista: carriage, trail, turntable, recurved bow, windlass |
| `abomination.html` | The Abomination: a heap of noise-displaced lumps with heads half swallowed in it, five limbs planted and twelve reaching |
| `three-d-stage.js` | The turntable viewer the pages use — orbit, zoom, and OBJ/GLB export |

## Viewing them

Run the dev server and open a page:

```sh
npm run dev      # then open /docs/reference/dragon.html
```

Drag to orbit, scroll to zoom, right-drag to pan; each page also offers an
OBJ/MTL and a GLB export of what it is showing.

They import Three.js through an import map pointing at **the copy in
`node_modules`** — the same version `src/` builds against — so they need
`npm ci` and the Vite dev server, and they will not run from a `file://` URL or
from a plain static server rooted at this folder. That is what the leading `/`
on the import-map paths means: they resolve from the repo root, not from here.

Sharing a Three.js version with the app is the point. A reference that renders
under a different version is a reference that can disagree with the rig for
reasons nothing in either file records.

Rendering **is** verified, headlessly, by `npm run reference:shoot`, which loads
each page in Chromium, waits for the stage, counts what got built and writes a
PNG. These pages used to pull 0.184.0 from unpkg behind integrity pins, which
made them unrenderable wherever egress is filtered — including the agent
sessions that do most of the work on this board.

## Why they are in the repo

A reference that lives in a chat log is a reference that gets re-derived. These
are here so the next revision of `dragon3d.js` or `warMachine3d.js` starts from
the actual numbers rather than from a description of them — the joint tables,
the radius profiles, the limb geometry, the proportions between parts.

**They are reference, not a target.** This board's camera looks straight down at
a stand about 3.2" wide by 1.3" deep, and these pages are built for a free orbit
camera with no stand at all. So the two disagree on purpose, and the
disagreements are the interesting part:

- **Taken.** The single tapered spine — one `CatmullRom` curve with a
  piecewise-linear radius profile, swept into one surface — which is what
  `kit.js` now calls `tapered()`. A body built that way has no seams to show,
  and it is the difference between an animal and a stack of cones.
- **Taken.** Stating a part by its *endpoints* rather than by a rotation, which
  is `kit.js`'s `spanning()`. Every orientation bug this project has had came
  from writing an angle by hand.
- **Taken.** Placing detail *along* the curve by `t` — belly plates, dorsal
  spikes, scutes — so it follows the body when the body changes.
- **Taken.** The ballista's density: a framed carriage, a recurved bow with
  collars and caps, a trail and spade, a windlass with ratchets, and rivets
  wherever a real one carries them.
- **Not taken: the standing pose.** The reference dragon stands on four legs
  with its wings raised in a V. From directly above that is a bird's-eye view of
  a thin body and two edge-on membranes. This board's dragon holds its wings out
  nearly flat, because a spread wing is the best top-down shape in the game.
- **Not taken: the proportions, exactly.** A long animal pointed straight
  down-range is depth a 2.4:1 stand cannot spend. The tail is swept hard to one
  side so the same length becomes width.
- **Not taken: the palette.** These are lit by a neutral studio rig with no tone
  mapping to speak of. The board tone-maps with ACES at 1.25 exposure, which
  lifts and desaturates everything, so colours are chosen for how they *render*
  there rather than for how they match as swatches.
- **Not taken: high metalness.** Both notes and code here cap it around 0.3–0.4
  for the same reason this project does — no environment map means a metal
  surface has nothing to reflect and renders near black.

### The Abomination

`abomination3d.js` is a port of `abomination.html`, from its own tables.

- **Taken.** The whole construction: one heap of lumps, no skeleton, limbs
  sprouting where the corpses landed. The lump table, the `lumpy` noise
  function and the seed are the reference's own, so the heap is recognisably
  the same heap. So are the hands, feet and faces — big dark sockets and an
  open mouth are the one detail that carries at stand scale.
- **Taken.** Five limbs planted and the rest reaching, which is what makes it
  haul rather than walk.
- **Not taken: the footprint.** The reference is nearly round. The *layout* is
  squeezed along Z to about 0.45 — lump positions, anchors, feet, the reach of
  every loose limb — and head and limb angles are pulled toward the wide axis,
  while the parts keep their shapes. It measures 2.56:1 at rest.
- **Not taken: where the faces point.** Straight out of the heap is a face the
  overhead camera never sees. They are tipped most of the way up.
- **Not taken: the palette.** The reference heap is the turf's value once ACES
  lifts it. The heap goes dark and the limbs and faces stay pale, per the brief.
- **Not taken: placing detail on the ellipsoid.** Ribs, bones, sinew and gore
  placed on the ideal ellipsoid land inside the lumps, and did on the first
  render. The port casts a ray at the lumps and puts them where it lands.

`.claude/skills/army-animation/SKILL.md` carries the general form of all of the
above; this folder is the primary source behind it.

## Provenance

Original geometry, authored as code — no scanned, traced or third-party model
data, and nothing derived from Your Move Games' printed artwork, which is the
rule the whole `art/` tree is built under.

`three-d-stage.js` arrived as scaffolding alongside the two pages rather than
being written for them. It is here only so the pages run; nothing in the app
uses it, and it can be deleted along with them at any time without touching a
line of `src/`.
