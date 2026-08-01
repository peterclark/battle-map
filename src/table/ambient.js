// Ambient motion — the cheap half of making the table feel alive.
//
// At the size a card sits on a 48" board, anatomy is invisible: a rank of
// goblins is a hundred pixels across, and no amount of articulated leg is
// going to read. What does read is that the whole thing is breathing. So
// every unit on the board gets this, monsters and militia alike, and it
// costs no artwork at all.
//
// Everything here is a pure function of (token, time). Nothing is stored, so
// the board can start and stop animating without state to keep in step.

// A stable per-unit phase, so two regiments of the same troops never breathe
// in lockstep. Derived from the token id rather than stored, and never from
// Math.random, which would reshuffle on every repaint.
const phaseOf = (id) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 * Math.PI * 2;
};

// Big things breathe slowly. A unit's stand size stands in for its mass,
// which is the only handle the card gives us.
const breathRate = (token) => {
  const bulk = token.halfWidth * token.halfDepth;
  return 0.85 - Math.min(bulk / 12, 0.42);
};

/**
 * What this unit is doing this frame.
 *
 * `breath` is a scale multiplier, `sway` a rotation in radians, and the
 * shadow offsets are in board inches.
 */
export const ambientFor = (token, time, { engaged = false, held = false } = {}) => {
  const phase = phaseOf(token.id);
  const rate = breathRate(token);
  const t = time * rate + phase;

  // A held card is in a player's hand, and a hand is steadier than lungs
  const depth = held ? 0.4 : 1;
  const breath = 1 + Math.sin(t) * 0.011 * depth;
  const sway = Math.sin(t * 0.63 + phase) * 0.006 * depth;

  // The shadow lags the body, which is what stops the pair reading as one
  // flat sticker sliding about
  const shadowX = 0.05 + Math.sin(t - 0.5) * 0.012;
  const shadowY = 0.07 + Math.cos(t * 0.8 - 0.5) * 0.01;

  // An engaged unit has something to be agitated about
  const alarm = engaged ? 0.5 + 0.5 * Math.sin(time * 3.4 + phase) : 0;

  return { breath, sway, shadowX, shadowY, alarm };
};

// The allowance ring's dashes crawl while a card is held, so the tape
// measure reads as live rather than printed on the table
export const antOffset = (time) => -(time * 14) % 12;

/**
 * Dust kicked up along a march. Returns motes in board inches, trailing the
 * line the unit actually walked — so it appears only once a unit has moved,
 * and points back the way it came.
 */
export const marchDust = (token, time, marched) => {
  if (marched < 0.4) return [];
  const phase = phaseOf(token.id);
  const dx = token.orderX - token.x;
  const dy = token.orderY - token.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const motes = [];

  for (let i = 0; i < 7; i += 1) {
    // Each mote runs its own loop, offset so they do not puff in unison
    const life = ((time * 0.6 + i * 0.19 + phase) % 1);
    const along = life * Math.min(marched, 3.2);
    const spread = Math.sin(phase + i * 2.3) * 0.5 * life;
    motes.push({
      x: token.x + ux * along - uy * spread,
      y: token.y + uy * along + ux * spread,
      radius: 0.06 + life * 0.22,
      alpha: (1 - life) * 0.3,
    });
  }
  return motes;
};

// Honour a viewer who has asked the platform for less movement. The table
// still works; it simply stops idling.
export const prefersStillness = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
