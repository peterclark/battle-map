import { cardFaceSvg } from "./cardFace.js";

// A unit's card face is expensive to build and never changes, so it is drawn
// once into an Image and blitted from then on. Only the parts that move —
// damage marks, the standing order, selection rings — are painted onto the
// board each frame.

const cache = new Map();

const key = (unit, armyColor, liveOccupant) =>
  `${unit.uid ?? unit.id}|${armyColor}|${liveOccupant ? "live" : "art"}`;

/**
 * The card face for a unit, as an Image.
 *
 * Returns immediately, before the image has decoded — a card is a few
 * kilobytes of inline SVG with no network fetch behind it, so it lands within
 * a frame or two. `onReady` fires once it can be drawn, which is the board's
 * cue to repaint.
 *
 * `liveOccupant` asks for the face a unit wears when a modelled creature is
 * standing on it: the banner, the stat bar and the damage track stay, and the
 * drawn ranks come off, because two armies on one stand reads as a mistake.
 * It is a separate cache entry rather than a redraw, so flipping the board
 * between cards and figures costs nothing after the first flip.
 */
export const cardImage = (unit, armyColor, onReady, { liveOccupant } = {}) => {
  const id = key(unit, armyColor, liveOccupant);
  const cached = cache.get(id);
  if (cached) return cached;

  const image = new Image();
  const svg = cardFaceSvg(unit, armyColor, { liveOccupant });
  image.decoding = "sync";
  // A data URL rather than a blob URL: nothing to revoke, and the cache holds
  // the only reference for the life of the page
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  image.addEventListener("load", () => onReady?.(), { once: true });
  cache.set(id, image);
  return image;
};

export const isDrawable = (image) => Boolean(image?.complete && image.naturalWidth);
