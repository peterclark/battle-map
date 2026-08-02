// A Tyrannosaurus Rex, seen from above, drawn per frame rather than stamped
// from an image.
//
// The card face stays a cached SVG — grass, banner, stat bar, damage track —
// and the animal is painted over its field each frame. That split is what
// makes this affordable: the expensive, unchanging part is rasterised once,
// and only the creature costs anything to move.
//
// Nothing here is a sprite or a keyframe. The animal is a chain of spine
// nodes with a travelling wave running down it, legs on a stride cycle, and a
// jaw on its own clock. Everything is a function of time, so it renders
// crisply at any size, on any surface, and a 55" table gets the same animal a
// laptop does with more pixels in it.

// Body length in local units, snout to tail tip. The caller scales this to
// whatever the board's inch grid works out to.
const NOSE = -46;
const TAIL = 56;

// Spine, head first. `w` is the half-width of the body at that node, `amp`
// how far that node swings when the wave passes through it. A theropod's
// mass sits over the hips, so the chest barely moves while the head and the
// tail counterswing about it — that opposition is what reads as an animal
// rather than a wobbling shape.
// Proportion is the whole job here. From above, a tyrannosaur is a narrow
// head on a thick neck, a body that widens all the way back to the hips —
// the widest point, because that is where the legs hang — and then half its
// length again in tail. Get those masses right and the silhouette reads at
// the size a card sits on the board, where nothing else survives.
const SPINE = [
  { y: NOSE, w: 2.0, amp: 3.0 }, // snout tip
  { y: -41, w: 3.6, amp: 2.7 },
  { y: -35, w: 6.0, amp: 2.2 }, // skull, at its widest across the cheeks
  { y: -29, w: 4.4, amp: 1.7 }, // the neck joint, pinched behind the jaw
  { y: -21, w: 7.0, amp: 1.0 },
  { y: -11, w: 11.8, amp: 0.4 }, // shoulders
  { y: -1, w: 15.0, amp: 0.2 }, // chest
  { y: 10, w: 16.0, amp: 0.5 }, // hips — the widest point on the animal
  { y: 19, w: 9.2, amp: 2.8 }, // waist, stepping sharply down off the hips
  { y: 28, w: 6.8, amp: 5.0 },
  { y: 38, w: 4.7, amp: 7.4 },
  { y: 47, w: 3.0, amp: 9.8 },
  { y: TAIL, w: 1.2, amp: 12.6 }, // tail tip
];

const HIP_NODE = 7;
const CHEST_NODE = 6;
const SKULL_NODE = 2;

const PALETTE = {
  back: "#3f5a2a",
  backLit: "#587a37",
  flank: "#33491f",
  belly: "#9aa863",
  ridge: "#243414",
  stripe: "#26381a",
  hide: "#2b3d19",
  claw: "#e8e2cf",
  maw: "#6d2730",
  tooth: "#f2ecdd",
  eye: "#e8a423",
  thigh: "#48632f",
};

// How each gait drives the animal
const GAITS = {
  idle: { wave: 1.05, waveGain: 0.55, stride: 0.16, bob: 0.35, jaw: 0.04, lunge: 0 },
  march: { wave: 2.5, waveGain: 1, stride: 1, bob: 1, jaw: 0.12, lunge: 0 },
  attack: { wave: 3.4, waveGain: 1.25, stride: 0.5, bob: 1.4, jaw: 1, lunge: 1 },
};

// Quadratic smoothing through a ring of points — the body is a handful of
// nodes, and this is what turns them into a continuous flank
const smoothClosed = (ctx, points) => {
  ctx.beginPath();
  const first = points[0];
  const last = points[points.length - 1];
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let i = 0; i < points.length; i += 1) {
    const cur = points[i];
    const next = points[(i + 1) % points.length];
    ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
  }
  ctx.closePath();
};

// Where every spine node sits this frame. The wave travels tailwards rather
// than the whole spine swinging together, which is why the tail lags the hips
// instead of moving with them.
const poseSpine = (time, gait) => {
  const phaseStep = 0.52;
  return SPINE.map((node, index) => ({
    ...node,
    x: node.amp * gait.waveGain * Math.sin(time * gait.wave - index * phaseStep),
    y: node.y,
  }));
};

const outlineOf = (nodes) => [
  ...nodes.map((n) => ({ x: n.x - n.w, y: n.y })),
  ...[...nodes].reverse().map((n) => ({ x: n.x + n.w, y: n.y })),
];

// One hind leg. Top-down, a stride reads as the knee swinging fore and aft
// and the foot lifting clear on the return — so the foot shrinks slightly
// off the ground and the claws splay when it plants.
const drawLeg = (ctx, { hip, side, phase, gait }) => {
  const swing = Math.sin(phase) * 11 * gait.stride;
  const lift = Math.max(Math.cos(phase), 0) * gait.stride;

  // The leg has to break the body outline, or from above the animal reads as
  // one lump. Knee and foot both sit well outside the hip.
  const kneeX = hip.x + side * (hip.w + 6.5);
  const kneeY = hip.y - 1 + swing * 0.45;
  const footX = hip.x + side * (hip.w + 11.0);
  const footY = hip.y + 11 + swing;

  ctx.save();

  // Thigh — the heaviest mass on the animal, and the one that sells the gait
  const thigh = ctx.createLinearGradient(hip.x, hip.y, kneeX, kneeY + 6);
  thigh.addColorStop(0, PALETTE.flank);
  thigh.addColorStop(1, PALETTE.thigh);
  ctx.fillStyle = thigh;
  ctx.beginPath();
  ctx.ellipse(
    hip.x + side * (hip.w * 0.82 + 3.5),
    hip.y + 1 + swing * 0.3,
    8.2,
    12.0,
    side * -0.3,
    0,
    Math.PI * 2
  );
  ctx.fill();
  // A dark seam where the thigh meets the flank, so the two masses part
  ctx.strokeStyle = PALETTE.ridge;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Shank, thinner and darker, angling back down to the foot
  ctx.strokeStyle = PALETTE.hide;
  ctx.lineCap = "round";
  ctx.lineWidth = 5.4 - lift * 1.1;
  ctx.beginPath();
  ctx.moveTo(kneeX, kneeY + 4);
  ctx.lineTo(footX, footY);
  ctx.stroke();

  // Three forward toes and a spur behind, splaying as the foot plants
  const spread = 1 + (1 - lift) * 0.22;
  [-0.5, 0, 0.5].forEach((fan) => {
    ctx.strokeStyle = PALETTE.hide;
    ctx.lineWidth = 2.9;
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(
      footX + Math.sin(fan) * 6.2 * spread,
      footY + Math.cos(fan) * 6.2 * spread
    );
    ctx.stroke();
    ctx.strokeStyle = PALETTE.claw;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(
      footX + Math.sin(fan) * 5.2 * spread,
      footY + Math.cos(fan) * 5.2 * spread
    );
    ctx.lineTo(
      footX + Math.sin(fan) * 7.6 * spread,
      footY + Math.cos(fan) * 7.6 * spread
    );
    ctx.stroke();
  });
  ctx.strokeStyle = PALETTE.hide;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(footX, footY);
  ctx.lineTo(footX - side * 2.6, footY - 3.6);
  ctx.stroke();

  ctx.restore();
};

// The famous vestigial forelimbs — small, but they sell the silhouette
const drawArm = (ctx, { chest, side, time }) => {
  const twitch = Math.sin(time * 3.1 + side) * 0.9;
  ctx.save();
  ctx.strokeStyle = PALETTE.hide;
  ctx.lineCap = "round";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(chest.x + side * (chest.w - 2), chest.y - 2);
  ctx.lineTo(chest.x + side * (chest.w + 3.4), chest.y + 2.4 + twitch);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.claw;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(chest.x + side * (chest.w + 3.4), chest.y + 2.4 + twitch);
  ctx.lineTo(chest.x + side * (chest.w + 5.4), chest.y + 4.6 + twitch);
  ctx.stroke();
  ctx.restore();
};

// Skull and jaws. The lower jaw hinges under the skull, so an open mouth
// shows the maw and the teeth around it.
const drawHead = (ctx, { nodes, open }) => {
  const snout = nodes[0];
  const brow = nodes[SKULL_NODE];
  const angle = Math.atan2(snout.x - brow.x, snout.y - brow.y);

  ctx.save();
  ctx.translate(brow.x, brow.y);
  ctx.rotate(-angle);

  const jawLength = 15 + open * 2;

  if (open > 0.02) {
    // Gullet, drawn first so the jaws close over it
    ctx.fillStyle = PALETTE.maw;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-5.2, -jawLength);
    ctx.lineTo(5.2, -jawLength);
    ctx.closePath();
    ctx.fill();
  }

  // Lower jaw swings out to each side as the mouth opens
  const gape = open * 0.42;
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.rotate(side * gape);
    ctx.fillStyle = PALETTE.flank;
    ctx.beginPath();
    ctx.moveTo(side * 1.2, 3);
    ctx.quadraticCurveTo(side * 6.4, -6, side * 3.1, -jawLength);
    ctx.quadraticCurveTo(side * 1.2, -jawLength - 2.4, 0, -jawLength);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();

    // Teeth along the jaw line
    ctx.fillStyle = PALETTE.tooth;
    for (let i = 0; i < 5; i += 1) {
      const along = 3 - (i + 0.6) * (jawLength / 5.4);
      const spread = 3.6 - i * 0.42;
      ctx.beginPath();
      ctx.moveTo(side * spread, along);
      ctx.lineTo(side * (spread - 1.5), along - 0.5);
      ctx.lineTo(side * (spread - 0.4), along - 2.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });

  // Skull roof: broad at the cheeks, tapering to a narrow snout. Seen from
  // above that wedge is the most recognisable thing about the animal.
  ctx.fillStyle = PALETTE.back;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.quadraticCurveTo(-6.6, 1, -5.4, -6);
  ctx.quadraticCurveTo(-4.4, -13, -2.0, -jawLength * 0.86);
  ctx.quadraticCurveTo(0, -jawLength * 0.95, 2.0, -jawLength * 0.86);
  ctx.quadraticCurveTo(4.4, -13, 5.4, -6);
  ctx.quadraticCurveTo(6.6, 1, 0, 5);
  ctx.closePath();
  ctx.fill();

  // Lit crown down the middle of the skull
  ctx.fillStyle = PALETTE.backLit;
  ctx.beginPath();
  ctx.ellipse(0, -5.5, 2.6, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Brow ridges, and the eyes set into the sides of the skull
  [-1, 1].forEach((side) => {
    ctx.fillStyle = PALETTE.ridge;
    ctx.beginPath();
    ctx.ellipse(side * 4.0, -4.6, 1.9, 3.0, side * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.eye;
    ctx.beginPath();
    ctx.arc(side * 4.3, -5.2, 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#160f06";
    ctx.beginPath();
    ctx.ellipse(side * 4.4, -5.2, 0.38, 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Nostrils at the tip
  ctx.fillStyle = PALETTE.ridge;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(side * 1.3, -jawLength * 0.74, 0.55, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
};

/**
 * Draw the animal, centred on the current origin and facing -y.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number} opts.time     seconds; the only thing that moves
 * @param {number} opts.size     body length in pixels, snout to tail tip
 * @param {string} opts.state    "idle" | "march" | "attack"
 * @param {number} opts.phase    per-unit offset so two of them never lockstep
 */
export const drawTyrannosaur = (
  ctx,
  { time = 0, size = 100, state = "idle", phase = 0, showBones = false } = {}
) => {
  const gait = GAITS[state] ?? GAITS.idle;
  const t = time + phase;
  const scale = size / (TAIL - NOSE);

  ctx.save();
  ctx.scale(scale, scale);

  // A charging animal throws itself forward, and the whole body drops and
  // rises on each stride
  const lunge = gait.lunge * Math.max(Math.sin(t * 4.2), 0) * -7;
  const bob = Math.sin(t * gait.wave * 2) * 0.9 * gait.bob;
  ctx.translate(0, lunge + bob);

  const nodes = poseSpine(t, gait);
  const hip = nodes[HIP_NODE];
  const chest = nodes[CHEST_NODE];

  // Ground shadow: the animal's own outline, offset and flattened, so it
  // hugs the shape instead of pooling under it as a blob
  ctx.save();
  ctx.translate(4, 6);
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  smoothClosed(
    ctx,
    outlineOf(nodes.map((n) => ({ ...n, w: n.w * 1.05 })))
  );
  ctx.fill();
  ctx.restore();

  // Legs sit under the body
  const stridePhase = t * gait.wave * 2;
  drawLeg(ctx, { hip, side: -1, phase: stridePhase, gait, scale });
  drawLeg(ctx, { hip, side: 1, phase: stridePhase + Math.PI, gait, scale });

  // Body and tail as one continuous flank
  const body = outlineOf(nodes);
  smoothClosed(ctx, body);
  const shade = ctx.createLinearGradient(-16, 0, 16, 0);
  shade.addColorStop(0, PALETTE.flank);
  shade.addColorStop(0.42, PALETTE.back);
  shade.addColorStop(0.6, PALETTE.backLit);
  shade.addColorStop(1, PALETTE.flank);
  ctx.fillStyle = shade;
  ctx.fill();

  // Pale underside showing along one flank
  ctx.save();
  ctx.clip();
  ctx.fillStyle = PALETTE.belly;
  ctx.globalAlpha = 0.26;
  smoothClosed(
    ctx,
    outlineOf(nodes.map((n) => ({ ...n, x: n.x + n.w * 0.72, w: n.w * 0.3 })))
  );
  ctx.fill();
  ctx.globalAlpha = 1;

  // Banding over the back and tail — faint, or the animal reads as segmented
  ctx.strokeStyle = PALETTE.stripe;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 3.4;
  for (let i = 5; i < nodes.length - 2; i += 2) {
    const node = nodes[i];
    ctx.beginPath();
    ctx.moveTo(node.x - node.w, node.y - 1.5);
    ctx.quadraticCurveTo(node.x, node.y + 2.6, node.x + node.w, node.y - 1.5);
    ctx.stroke();
  }

  // Pebbled hide, thickest over the shoulders and hips
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = PALETTE.ridge;
  for (let i = 4; i < nodes.length - 1; i += 1) {
    const node = nodes[i];
    for (let k = -2; k <= 2; k += 1) {
      const across = (k / 2.4) * node.w;
      ctx.beginPath();
      ctx.arc(node.x + across, node.y + (k % 2 ? 2.6 : -2.2), 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Dorsal ridge — one narrow line of scutes down the spine, tapering into
  // the tail rather than banding across the body
  ctx.fillStyle = PALETTE.ridge;
  for (let i = 4; i < nodes.length - 1; i += 1) {
    const node = nodes[i];
    const next = nodes[i + 1];
    const scute = Math.max(2.2 - i * 0.13, 0.7);
    ctx.beginPath();
    ctx.moveTo(node.x - scute, node.y);
    ctx.lineTo(node.x, node.y - scute * 1.5);
    ctx.lineTo(node.x + scute, node.y);
    ctx.lineTo(next.x, next.y);
    ctx.closePath();
    ctx.fill();
  }

  drawArm(ctx, { chest, side: -1, time: t });
  drawArm(ctx, { chest, side: 1, time: t });

  // The jaw runs on its own clock — a snap is faster than a stride
  const jawOpen =
    state === "attack"
      ? 0.45 + 0.55 * Math.abs(Math.sin(t * 5.2))
      : gait.jaw + Math.max(Math.sin(t * 0.6 + phase), 0.82) * 0.1;
  drawHead(ctx, { nodes, open: jawOpen });

  // The rig itself, for tuning a gait — every node and the wave running
  // through it, drawn over the animal
  if (showBones) {
    ctx.save();
    ctx.strokeStyle = "#ef9f27";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    nodes.forEach((node, i) =>
      i ? ctx.lineTo(node.x, node.y) : ctx.moveTo(node.x, node.y)
    );
    ctx.stroke();
    nodes.forEach((node) => {
      ctx.fillStyle = "#fbe3b5";
      ctx.beginPath();
      ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(239,159,39,0.35)";
      ctx.beginPath();
      ctx.moveTo(node.x - node.w, node.y);
      ctx.lineTo(node.x + node.w, node.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  ctx.restore();
};

export const TREX_STATES = Object.keys(GAITS);
