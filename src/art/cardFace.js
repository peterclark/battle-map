import { includes, map, range } from "lodash";
import { attackProfile, damageBoxes } from "../rules/data/index.js";

// Original artwork for a unit's card face, drawn as SVG and blitted onto the
// board as the unit's token.
//
// The layout follows the shape every rank-and-file wargame card has used for
// decades — a field of figures seen from above, the unit's name under it, a
// bar of stat glyphs, a damage track, and a disc for the standing order — but
// every mark here is drawn from scratch. Nothing traces, copies, or derives
// from Your Move Games' printed card art, matching the same rule
// BattleDeck's own art script sets for itself.

// Card space. 10:7 is the proportion of the physical cards.
export const CARD_W = 240;
export const CARD_H = 168;

// The same proportions in board inches, so a card token sits on the table at
// the size the printed one would
export const CARD_INCHES_W = 2.5;
export const CARD_INCHES_H = 1.75;

// The foot of the card carries the name, the stat bar and the damage track,
// with the standing-order disc set into the corner beside them. The name
// banner straddles the edge of the field the way the printed cards do.
const ART_BOTTOM = 104;

// The share of a card's depth given over to the field the ranks are drawn on.
// Modelled figures stand in exactly this band, so they land where the drawn
// ranks would have and leave the banner, stat bar and damage track clear.
export const ART_FIELD_DEPTH = (ART_BOTTOM - 4) / CARD_H;
const BANNER_Y = 94;
const BANNER_H = 18;
const BANNER_LEFT = 24;
const BANNER_RIGHT = 172;
const STAT_Y = 126;
const STAT_BAR_TOP = 118;
const STAT_BAR_H = 17;
const DAMAGE_Y = 142;
const DAMAGE_H = 14;
const DAMAGE_BOX_W = 14;
const TRACK_LEFT = 8;
const TRACK_RIGHT = 190;
const ORDER_CX = 212;
const ORDER_CY = 132;
const ORDER_R = 19;

// A stable hash, so a unit's ranks are jumbled the same way on every render.
// Math.random would reshuffle the formation on every repaint.
const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const jitter = (seed, index, spread) =>
  ((hash(`${seed}:${index}`) % 1000) / 1000 - 0.5) * spread;

// --- Figures -------------------------------------------------------------
// Each figure is drawn around its own origin, facing up the card (-y), and
// placed by a transform. Seen from above a soldier is mostly cloak, pauldrons
// and the crown of a helmet, with the weapon and shield breaking the outline
// — that read is what makes a block of them look like a regiment.

const ARMOUR_DARK = "#15120d";
const ARMOUR_MID = "#241d15";
const STEEL = "#7c848c";
const STEEL_LIT = "#b7c0c8";
const HAFT = "#0e0c08";

const soldierBody = () => `
  <ellipse cx="0" cy="2.5" rx="8.2" ry="10" fill="${ARMOUR_DARK}" />
  <ellipse cx="0" cy="-0.5" rx="7.2" ry="7" fill="${ARMOUR_MID}" />
  <circle cx="0" cy="-3" r="4.5" fill="${STEEL}" />
  <circle cx="-1.4" cy="-4.3" r="1.7" fill="${STEEL_LIT}" />`;

const shield = (side = -1) => `
  <ellipse cx="${side * 7.4}" cy="1.5" rx="3.4" ry="5" fill="#6c747d"
    stroke="${ARMOUR_DARK}" stroke-width="1" />`;

const WEAPONS = {
  axe: `
    <line x1="4.5" y1="7" x2="9.5" y2="-8" stroke="${HAFT}" stroke-width="1.7" />
    <path d="M9.5 -8 l4.6 1.6 l-1.8 4.6 l-4.4 -1.6 z" fill="${STEEL}"
      stroke="${ARMOUR_DARK}" stroke-width="0.7" />`,
  sword: `
    <line x1="4.8" y1="6" x2="8.6" y2="-7.5" stroke="${STEEL}" stroke-width="1.5" />
    <line x1="3.6" y1="4.2" x2="7.4" y2="5.4" stroke="${HAFT}" stroke-width="1.6" />`,
  spear: `
    <line x1="3.5" y1="10" x2="10" y2="-13" stroke="${HAFT}" stroke-width="1.5" />
    <path d="M10 -13 l2.6 3.4 l-3.9 1.1 z" fill="${STEEL_LIT}" />`,
  bow: `
    <path d="M6 -7 Q12 0 6 7" fill="none" stroke="${HAFT}" stroke-width="1.5" />
    <line x1="6" y1="-7" x2="6" y2="7" stroke="#9aa0a6" stroke-width="0.7" />`,
};

const footSoldier = (weapon) => `
  ${soldierBody()}
  ${shield(-1)}
  ${WEAPONS[weapon] ?? WEAPONS.sword}`;

// A rider reads as a long mount with a smaller figure sitting across it
const horseman = () => `
  <ellipse cx="0" cy="3" rx="6.4" ry="14" fill="#1b1610" />
  <ellipse cx="0" cy="-8" rx="4" ry="5" fill="#241d15" />
  <ellipse cx="0" cy="1" rx="6.6" ry="6.4" fill="${ARMOUR_DARK}" />
  <circle cx="0" cy="-1" r="4" fill="${STEEL}" />
  <circle cx="-1.2" cy="-2" r="1.5" fill="${STEEL_LIT}" />
  <line x1="4" y1="9" x2="11" y2="-11" stroke="${HAFT}" stroke-width="1.6" />
  <path d="M11 -11 l2.6 3.4 l-3.9 1.1 z" fill="${STEEL_LIT}" />`;

// One big body instead of a rank — hunched shoulders, a small head, and a
// weapon out of scale with everything else on the card
const behemoth = () => `
  <ellipse cx="0" cy="6" rx="20" ry="24" fill="#191510" />
  <ellipse cx="0" cy="-2" rx="17" ry="15" fill="#241d17" />
  <ellipse cx="-11" cy="-8" rx="6.5" ry="7" fill="#2c241b" />
  <ellipse cx="11" cy="-8" rx="6.5" ry="7" fill="#2c241b" />
  <circle cx="0" cy="-12" r="7.5" fill="#4b4034" />
  <circle cx="-2.5" cy="-14" r="2.6" fill="#6d5f4e" />
  <line x1="15" y1="16" x2="27" y2="-16" stroke="${HAFT}" stroke-width="3.4" />
  <path d="M27 -16 l7.5 3 l-3 7.4 l-7.2 -3 z" fill="#5d646b"
    stroke="${ARMOUR_DARK}" stroke-width="1" />`;

// Which figure a unit fields, read off its own card rather than hand-listed
export const archetypeOf = (unit) => {
  const keywords = unit.keywords ?? [];
  if (includes(keywords, "colossal") || includes(keywords, "large")) {
    return "behemoth";
  }
  if (includes(keywords, "cavalry")) return "cavalry";
  if (includes(keywords, "spears")) return "spear";
  // A unit whose ranged attack outranges its reach is drawn with bows
  if (attackProfile(unit, "ranged")?.range >= 7) return "archer";
  if (unit.melee?.offensivePower >= 6) return "axe";
  return "sword";
};

// Rows and columns per archetype: heavy infantry stand shoulder to shoulder,
// skirmishers spread out, cavalry take more room, a behemoth stands alone.
const FORMATIONS = {
  sword: { cols: 7, rows: 4, figure: () => footSoldier("sword") },
  axe: { cols: 7, rows: 4, figure: () => footSoldier("axe") },
  spear: { cols: 7, rows: 4, figure: () => footSoldier("spear") },
  archer: { cols: 6, rows: 3, figure: () => footSoldier("bow") },
  cavalry: { cols: 5, rows: 2, figure: horseman },
  behemoth: { cols: 1, rows: 1, figure: behemoth, scale: 1.5 },
};

const ranks = (unit, seed) => {
  const { cols, rows, figure, scale = 1 } = FORMATIONS[archetypeOf(unit)];
  const body = figure();
  const spanX = CARD_W - 34;
  const spanY = ART_BOTTOM - 24;
  const stepX = spanX / cols;
  const stepY = spanY / rows;

  return map(range(rows), (row) =>
    map(range(cols), (col) => {
      // Alternate ranks step half a file across, the way a real formation
      // closes its gaps. A lone figure has no rank to dress by, so it simply
      // stands in the middle of the field.
      const alone = cols === 1 && rows === 1;
      const stagger = row % 2 === 1 ? stepX / 2 : 0;
      const x = alone
        ? CARD_W / 2
        : 17 + stepX / 2 + col * stepX + stagger + jitter(seed, row * 31 + col, 4);
      const y = alone
        ? 14 + spanY / 2
        : 16 + stepY / 2 + row * stepY + jitter(seed, row * 71 + col, 3.5);
      if (x > CARD_W - 12) return "";
      const tilt = jitter(seed, row * 17 + col + 500, 26);
      const sized = scale === 1 ? "" : ` scale(${scale})`;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)})${sized}">${body}</g>`;
    }).join("")
  ).join("");
};

// --- Stat glyphs ---------------------------------------------------------
// Simple original marks, sized to sit on the stat bar's baseline

const GLYPHS = {
  sword: `<path d="M0 -7 l1.7 3 v7 l-1.7 2 l-1.7 -2 v-7 z" fill="#c9d1d8" />
          <line x1="-3.4" y1="-2.4" x2="3.4" y2="-2.4" stroke="#c9d1d8" stroke-width="1.4" />`,
  shield: `<path d="M0 -7 c4 0 5 1.6 5 4.4 c0 4 -3 6.8 -5 7.8 c-2 -1 -5 -3.8 -5 -7.8 c0 -2.8 1 -4.4 5 -4.4 z"
             fill="none" stroke="#c9d1d8" stroke-width="1.5" />`,
  bow: `<path d="M-3 -7 Q4 0 -3 7" fill="none" stroke="#c9d1d8" stroke-width="1.5" />
        <line x1="-3" y1="-7" x2="-3" y2="7" stroke="#c9d1d8" stroke-width="1" />`,
  flag: `<line x1="-3" y1="-7" x2="-3" y2="7" stroke="#c9d1d8" stroke-width="1.4" />
         <path d="M-3 -7 l8 2.2 l-8 2.6 z" fill="#c9d1d8" />`,
  boot: `<path d="M-3 -7 h3.6 v7 l4.4 1.6 v3.4 h-8 z" fill="#c9d1d8" />`,
};

const statEntry = (glyph, text, x) => `
  <g transform="translate(${x} 0)">
    <g transform="translate(0 0.5) scale(0.74)">${GLYPHS[glyph]}</g>
    <text x="6.5" y="4" font-family="Georgia, serif" font-size="11"
      font-weight="700" fill="#f2ecdd">${text}</text>
  </g>`;

// --- Damage track --------------------------------------------------------
// Exported as geometry too, because the board draws the marks over the top of
// the cached face and the two must agree on where the boxes are.

export const damageBoxRects = (unit) => {
  const total = damageBoxes(unit);
  const gap = 2.5;
  // Boxes keep one size whatever a unit's total, so a five-box card and a
  // fourteen-box card read as the same track at different lengths — the way
  // the printed cards do. Only a track too long for the card is squeezed.
  const available = TRACK_RIGHT - TRACK_LEFT;
  const wanted = total * DAMAGE_BOX_W + (total - 1) * gap;
  const boxWidth =
    wanted <= available ? DAMAGE_BOX_W : (available - gap * (total - 1)) / total;
  const { green, yellow } = unit.damage;
  return map(range(total), (index) => ({
    x: TRACK_LEFT + index * (boxWidth + gap),
    y: DAMAGE_Y,
    w: boxWidth,
    h: DAMAGE_H,
    band: index < green ? "green" : index < green + yellow ? "yellow" : "red",
  }));
};

const BAND_FILL = { green: "#639922", yellow: "#e0b23a", red: "#a32d2d" };
const BAND_LIT = { green: "#8ec44a", yellow: "#f2d071", red: "#cf5450" };

const damageTrack = (unit) =>
  map(
    damageBoxRects(unit),
    ({ x, y, w, h, band }) => `
      <rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}"
        rx="2" fill="${BAND_FILL[band]}" stroke="#0e0c0a" stroke-width="1" />
      <rect x="${(x + 1.2).toFixed(1)}" y="${y + 1.2}" width="${(w - 2.4).toFixed(1)}"
        height="${(h / 2.6).toFixed(1)}" rx="1" fill="${BAND_LIT[band]}" opacity="0.75" />`
  ).join("");

// --- The face ------------------------------------------------------------

const escapeText = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The full card face for a unit, as an SVG string.
 *
 * `armyColor` frames the card so the two warbands read apart from a standing
 * player's distance — the printed cards rely on faction art for that, which
 * a board seen from six feet up cannot lean on.
 */
export const cardFaceSvg = (unit, armyColor, { liveOccupant = false } = {}) => {
  const seed = unit.uid ?? unit.id ?? unit.name;
  const melee = unit.melee;
  const ranged = unit.ranged;

  const meleeText = melee
    ? `(${melee.dice}) ${melee.offensiveSkill}/${melee.offensivePower}`
    : "—";
  const rangedText = ranged ? `${ranged.range ?? "—"}"` : "—";

  // Long regiment names step down a point or two rather than running off the
  // banner — Cinzel at 12 fits about sixteen characters across it
  const nameSize = unit.name.length > 20 ? 9 : unit.name.length > 16 ? 10.5 : 12;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <defs>
    <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4d7a2a" />
      <stop offset="0.55" stop-color="#3d6421" />
      <stop offset="1" stop-color="#2f4d19" />
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a3229" />
      <stop offset="1" stop-color="#211c17" />
    </linearGradient>
    <radialGradient id="disc" cx="0.38" cy="0.32" r="0.8">
      <stop offset="0" stop-color="#eef2e4" />
      <stop offset="1" stop-color="#b8c4a6" />
    </radialGradient>
    <clipPath id="field">
      <rect x="3" y="3" width="${CARD_W - 6}" height="${CARD_H - 6}" rx="9" />
    </clipPath>
  </defs>

  <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" rx="11" fill="${armyColor}" />
  <g clip-path="url(#field)">
    <rect x="3" y="3" width="${CARD_W - 6}" height="${CARD_H - 6}" fill="url(#turf)" />
    <!-- torn ground and scrub, so the field is not a flat swatch -->
    <path d="M3 78 q40 -12 82 -3 t74 -6 t78 5 v40 h-234 z" fill="#365a1d" opacity="0.55" />
    <path d="M3 34 q52 10 96 1 t135 6" fill="none" stroke="#5d8b33" stroke-width="3"
      opacity="0.35" />
    <ellipse cx="42" cy="98" rx="26" ry="9" fill="#2b451a" opacity="0.5" />
    <ellipse cx="196" cy="46" rx="22" ry="8" fill="#2b451a" opacity="0.45" />

    <!-- The drawn ranks come off when modelled figures are standing on this
         stand: one army to a card. Everything else about the face stays,
         because the banner, the stat bar and the damage track are what the
         players actually read off it. -->
    ${liveOccupant ? "" : ranks(unit, seed)}

    <!-- the ground plate the stat bar sits on -->
    <rect x="0" y="${ART_BOTTOM - 4}" width="${CARD_W}" height="${CARD_H - ART_BOTTOM + 4}"
      fill="#100e0b" opacity="0.93" />
  </g>

  <!-- name banner, straddling the foot of the field -->
  <g>
    <rect x="${BANNER_LEFT}" y="${BANNER_Y}" width="${BANNER_RIGHT - BANNER_LEFT}"
      height="${BANNER_H}" rx="8" fill="#0c0a07" stroke="${armyColor}"
      stroke-width="1.4" />
    <text x="${(BANNER_LEFT + BANNER_RIGHT) / 2}" y="${BANNER_Y + 13}"
      text-anchor="middle" font-family="Cinzel, Georgia, serif"
      font-size="${nameSize}" font-weight="700" fill="#f2ecdd"
      >${escapeText(unit.name)}</text>
  </g>

  <!-- stat bar: the same five marks the printed stat line carries -->
  <rect x="${TRACK_LEFT - 2}" y="${STAT_BAR_TOP}" width="${TRACK_RIGHT - TRACK_LEFT + 4}"
    height="${STAT_BAR_H}" rx="6" fill="url(#bar)" stroke="#4a4238" stroke-width="1" />
  <g transform="translate(0 ${STAT_Y})">
    ${statEntry("sword", meleeText, TRACK_LEFT + 6)}
    ${statEntry("shield", `${unit.defensiveSkill}/${unit.defensivePower}`, TRACK_LEFT + 66)}
    ${statEntry("bow", rangedText, TRACK_LEFT + 100)}
    ${statEntry("flag", `${unit.courage ?? "—"}`, TRACK_LEFT + 132)}
    ${statEntry("boot", `${unit.move}"`, TRACK_LEFT + 158)}
  </g>

  <!-- damage track -->
  ${damageTrack(unit)}

  <!-- standing order disc: left blank on the card, written on in play -->
  <circle cx="${ORDER_CX}" cy="${ORDER_CY}" r="${ORDER_R}" fill="url(#disc)"
    stroke="#0e0c0a" stroke-width="1.6" />
  <circle cx="${ORDER_CX}" cy="${ORDER_CY}" r="${ORDER_R - 4}" fill="none"
    stroke="#8d9a7c" stroke-width="1" opacity="0.7" />
</svg>`;
};

export const ORDER_DISC = { cx: ORDER_CX, cy: ORDER_CY, r: ORDER_R };
