# Reference builds

Two standalone Three.js pages, kept because they are the direction a rig was
built *against*. Neither is part of the app: nothing under `src/` imports them,
the Vite build never sees them, and they are excluded from lint.

| File | What it is |
| --- | --- |
| `dragon.html` | A dragon, built as one tapered spine with wings, legs and a head hung off it |
| `ballista.html` | A dwarven field ballista: carriage, trail, turntable, recurved bow, windlass |
| `three-d-stage.js` | The turntable viewer both pages use — orbit, zoom, and OBJ/GLB export |

## Viewing them

Serve the folder and open a page:

```sh
npx serve docs/reference     # then open /dragon.html
```

Drag to orbit, scroll to zoom, right-drag to pan; each page also offers an
OBJ/MTL and a GLB export of what it is showing.

They pull Three.js **0.184.0 from unpkg**, through a pinned import map with
integrity hashes, so they need that host reachable — which is worth knowing
before concluding a page is broken. They also will not run from a `file://` URL
in every browser, hence `serve` rather than double-clicking.

This is the one thing about these files that cannot be checked from inside a
sandboxed agent session: unpkg is commonly blocked by egress policy there, so
the most that can be verified is that the pages and their import maps are
intact. Rendering has to be confirmed in a real browser.

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
