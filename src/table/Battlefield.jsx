import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { find, findLast, forEach } from "lodash";
import { damageBoxes, damageStatus } from "../rules/data/index.js";
import { inContact } from "../engagement.js";
import {
  BOARD_HEIGHT_INCHES,
  BOARD_WIDTH_INCHES,
  armyBySide,
  clampToBoard,
  clampToMovement,
  marchedInches,
} from "./board.js";

// A drag has to travel this far before it stops counting as a tap. An IR
// touch frame reports a pixel or two of jitter while a finger rests on the
// glass, and a war table gets leaned on.
const TAP_SLOP_PX = 8;
const DOUBLE_TAP_MS = 350;

// Fit the inch board into the canvas, letterboxed, so the whole battlefield
// is always on screen whatever the table's aspect ratio.
const fitTransform = (width, height) => {
  const scale = Math.min(
    width / BOARD_WIDTH_INCHES,
    height / BOARD_HEIGHT_INCHES
  );
  return {
    scale,
    offsetX: (width - BOARD_WIDTH_INCHES * scale) / 2,
    offsetY: (height - BOARD_HEIGHT_INCHES * scale) / 2,
  };
};

const drawBoard = (ctx, t, width, height) => {
  ctx.fillStyle = "#0b0906";
  ctx.fillRect(0, 0, width, height);

  const x0 = t.offsetX;
  const y0 = t.offsetY;
  const w = BOARD_WIDTH_INCHES * t.scale;
  const h = BOARD_HEIGHT_INCHES * t.scale;

  // Worn leather playing surface
  const felt = ctx.createRadialGradient(
    x0 + w / 2,
    y0 + h / 2,
    0,
    x0 + w / 2,
    y0 + h / 2,
    Math.max(w, h) / 1.4
  );
  felt.addColorStop(0, "#241d14");
  felt.addColorStop(1, "#120e09");
  ctx.fillStyle = felt;
  ctx.fillRect(x0, y0, w, h);

  // Inch grid, with every sixth line drawn heavier — the players read
  // distances off this the way they would off a tape measure
  ctx.lineWidth = 1;
  for (let i = 0; i <= BOARD_WIDTH_INCHES; i += 1) {
    ctx.strokeStyle = i % 6 === 0 ? "rgba(201,180,140,0.16)" : "rgba(201,180,140,0.05)";
    ctx.beginPath();
    ctx.moveTo(x0 + i * t.scale, y0);
    ctx.lineTo(x0 + i * t.scale, y0 + h);
    ctx.stroke();
  }
  for (let i = 0; i <= BOARD_HEIGHT_INCHES; i += 1) {
    ctx.strokeStyle = i % 6 === 0 ? "rgba(201,180,140,0.16)" : "rgba(201,180,140,0.05)";
    ctx.beginPath();
    ctx.moveTo(x0, y0 + i * t.scale);
    ctx.lineTo(x0 + w, y0 + i * t.scale);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(217,164,65,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, w, h);
};

// The ground a unit may still claim this turn, drawn while a player holds it
const drawMovementAllowance = (ctx, t, token) => {
  const cx = t.offsetX + token.orderX * t.scale;
  const cy = t.offsetY + token.orderY * t.scale;
  const allowance = (token.unit.move ?? 0) * t.scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, allowance, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(217,164,65,0.06)";
  ctx.fill();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(217,164,65,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  // The march itself, anchor to current position, labelled in inches
  const marched = marchedInches(token);
  if (marched > 0.1) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(t.offsetX + token.x * t.scale, t.offsetY + token.y * t.scale);
    ctx.strokeStyle = "rgba(217,164,65,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#d9a441";
    ctx.font = `600 ${Math.round(t.scale * 0.62)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      `${marched.toFixed(1)}" of ${token.unit.move}"`,
      (cx + t.offsetX + token.x * t.scale) / 2,
      (cy + t.offsetY + token.y * t.scale) / 2 - 8
    );
  }
  ctx.restore();
};

const drawToken = (ctx, t, token, { held, selected, engaged }) => {
  const army = armyBySide(token.side);
  const cx = t.offsetX + token.x * t.scale;
  const cy = t.offsetY + token.y * t.scale;
  const r = token.radius * t.scale;
  const status = damageStatus(token.unit, token.marked);

  ctx.save();

  // Front arc — the 90° wedge that decides Flanking and Rear Attacks, so it
  // is drawn rather than left for the players to argue about
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r * 2.1, token.facing - Math.PI / 4, token.facing + Math.PI / 4);
  ctx.closePath();
  const wedge = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 2.1);
  wedge.addColorStop(0, `${army.color}55`);
  wedge.addColorStop(1, `${army.color}00`);
  ctx.fillStyle = wedge;
  ctx.fill();

  if (held || selected || engaged) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    ctx.strokeStyle = engaged ? "#e07a3c" : "#d9a441";
    ctx.lineWidth = engaged ? 3 : 2;
    ctx.stroke();
  }

  // Body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const body = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  body.addColorStop(0, army.color);
  body.addColorStop(1, "#1a150e");
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = status === "destroyed" ? "#a8302c" : army.accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  // A nose mark so facing is legible even where the wedge washes out under
  // a bright projector
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(token.facing) * r * 0.45, cy + Math.sin(token.facing) * r * 0.45);
  ctx.lineTo(cx + Math.cos(token.facing) * r * 0.95, cy + Math.sin(token.facing) * r * 0.95);
  ctx.strokeStyle = army.accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Damage pips around the rim: one per box, filled as the unit is chewed up
  const boxes = damageBoxes(token.unit);
  const arcSpan = Math.PI * 1.5;
  const start = Math.PI * 0.75;
  for (let i = 0; i < boxes; i += 1) {
    const angle = start + (arcSpan * i) / Math.max(boxes - 1, 1);
    const px = cx + Math.cos(angle) * r * 1.18;
    const py = cy + Math.sin(angle) * r * 1.18;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(r * 0.09, 2), 0, Math.PI * 2);
    ctx.fillStyle = i < token.marked ? "#a8302c" : "rgba(226,211,176,0.28)";
    ctx.fill();
  }

  // A destroyed unit is struck through until the players clear it away
  if (status === "destroyed") {
    ctx.strokeStyle = "#a8302c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
    ctx.moveTo(cx + r * 0.7, cy - r * 0.7);
    ctx.lineTo(cx - r * 0.7, cy + r * 0.7);
    ctx.stroke();
  }

  ctx.restore();
};

const overlaps = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// Names ride on plates rather than inside the discs: a long regiment name
// never fits in a token, and a player standing over the table reads a label
// faster than text squeezed into a counter. Two units in contact would print
// their plates on top of each other, so each label takes the first free slot
// below, above, or off to either side of its unit.
const drawLabel = (ctx, t, token, placed) => {
  const army = armyBySide(token.side);
  const cx = t.offsetX + token.x * t.scale;
  const cy = t.offsetY + token.y * t.scale;
  const r = token.radius * t.scale;
  const size = Math.max(Math.round(t.scale * 0.5), 11);

  ctx.save();
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const label = token.unit.name;
  const width = ctx.measureText(label).width + size * 0.9;
  const height = size * 1.7;
  const gap = r * 1.3 + height / 2;

  const candidates = [
    { x: cx, y: cy + gap },
    { x: cx, y: cy - gap },
    { x: cx, y: cy + gap + height * 1.15 },
    { x: cx, y: cy - gap - height * 1.15 },
  ];
  const spot =
    candidates.find((candidate) => {
      const rect = {
        left: candidate.x - width / 2,
        right: candidate.x + width / 2,
        top: candidate.y - height / 2,
        bottom: candidate.y + height / 2,
      };
      return !placed.some((other) => overlaps(rect, other));
    }) ?? candidates[0];

  placed.push({
    left: spot.x - width / 2,
    right: spot.x + width / 2,
    top: spot.y - height / 2,
    bottom: spot.y + height / 2,
  });

  ctx.beginPath();
  ctx.roundRect(spot.x - width / 2, spot.y - height / 2, width, height, size * 0.35);
  ctx.fillStyle = "rgba(11,9,6,0.85)";
  ctx.fill();
  ctx.strokeStyle = `${army.color}88`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle =
    damageStatus(token.unit, token.marked) === "destroyed" ? "#a8302c" : "#f2e7d0";
  ctx.fillText(label, spot.x, spot.y);
  ctx.restore();
};

const drawEngagementLine = (ctx, t, attacker, defender) => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(t.offsetX + attacker.x * t.scale, t.offsetY + attacker.y * t.scale);
  ctx.lineTo(t.offsetX + defender.x * t.scale, t.offsetY + defender.y * t.scale);
  ctx.strokeStyle = "#e07a3c";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.restore();
};

/**
 * The table surface. Owns pointer handling and rendering only — every change
 * it makes to a unit goes back out through `onTokensChange`, so the board
 * state has a single home in App.
 *
 * Input is Pointer Events keyed by `pointerId`, which is what makes this work
 * on the IR touch frame: the frame reports each contact as its own pointer,
 * so both players can march units at the same time and neither steals the
 * other's grip. A mouse arrives through the same path for desk testing.
 */
export default function Battlefield({
  tokens,
  onTokensChange,
  selectedId,
  onSelect,
  onEngage,
  engagement,
}) {
  const canvasRef = useRef(null);
  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  // pointerId -> { tokenId, mode, grabX, grabY, startX, startY, moved }
  const pointersRef = useRef(new Map());
  const lastTapRef = useRef({ tokenId: null, at: 0 });
  // Rendering reads the freshest tokens without re-binding pointer handlers
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;

  const toBoard = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = transformRef.current;
    return {
      x: (clientX - rect.left - t.offsetX) / t.scale,
      y: (clientY - rect.top - t.offsetY) / t.scale,
    };
  }, []);

  // Topmost token under a board point. Later tokens draw over earlier ones,
  // so the search runs back to front to match what the players can see.
  const tokenAt = useCallback((point) => {
    const t = transformRef.current;
    // A finger is fatter than a mouse: allow a little grace around the disc
    const grace = 6 / t.scale;
    return findLast(
      tokensRef.current,
      (token) =>
        Math.hypot(token.x - point.x, token.y - point.y) <= token.radius + grace
    );
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    const t = fitTransform(width, height);
    transformRef.current = t;

    drawBoard(ctx, t, width, height);

    const held = new Set(
      [...pointersRef.current.values()].map((grip) => grip.tokenId)
    );

    forEach(tokensRef.current, (token) => {
      if (held.has(token.id) || token.id === selectedId) {
        drawMovementAllowance(ctx, t, token);
      }
    });

    if (engagement) {
      const attacker = find(tokensRef.current, { id: engagement.attackerId });
      const defender = find(tokensRef.current, { id: engagement.defenderId });
      if (attacker && defender) drawEngagementLine(ctx, t, attacker, defender);
    }

    forEach(tokensRef.current, (token) =>
      drawToken(ctx, t, token, {
        held: held.has(token.id),
        selected: token.id === selectedId,
        engaged:
          engagement &&
          (engagement.attackerId === token.id ||
            engagement.defenderId === token.id),
      })
    );

    // Labels last, over every disc, so a name is never buried under the unit
    // standing next to it
    const placed = [];
    forEach(tokensRef.current, (token) => drawLabel(ctx, t, token, placed));

    ctx.restore();
  }, [selectedId, engagement]);

  // Keep the backing store in step with the element's CSS size and the
  // display's pixel ratio, so the board stays crisp on a 4K panel
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      render();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [render]);

  useEffect(() => {
    render();
  }, [tokens, render]);

  const updateToken = useCallback(
    (id, changes) =>
      onTokensChange((current) =>
        current.map((token) => (token.id === id ? { ...token, ...changes } : token))
      ),
    [onTokensChange]
  );

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toBoard(event.clientX, event.clientY);
    const token = tokenAt(point);

    // A second finger while a unit is held points that unit: hold the
    // regiment, and touch where you want it to face.
    const grip = [...pointersRef.current.values()].find(
      (entry) => entry.mode === "drag"
    );
    if (grip && (!token || token.id === grip.tokenId)) {
      pointersRef.current.set(event.pointerId, {
        tokenId: grip.tokenId,
        mode: "rotate",
      });
      const held = find(tokensRef.current, { id: grip.tokenId });
      if (held) {
        updateToken(held.id, {
          facing: Math.atan2(point.y - held.y, point.x - held.x),
        });
      }
      return;
    }

    if (!token) {
      onSelect(null);
      return;
    }

    // Two taps on the same unit rescind its order — it marches back to where
    // the turn found it, the undo for a march made in error.
    const now = event.timeStamp;
    const previous = lastTapRef.current;
    if (previous.tokenId === token.id && now - previous.at < DOUBLE_TAP_MS) {
      lastTapRef.current = { tokenId: null, at: 0 };
      onTokensChange((current) =>
        current.map((entry) =>
          entry.id === token.id
            ? {
                ...entry,
                x: entry.orderX,
                y: entry.orderY,
                facing: entry.orderFacing,
                charged: false,
              }
            : entry
        )
      );
      return;
    }
    lastTapRef.current = { tokenId: token.id, at: now };

    pointersRef.current.set(event.pointerId, {
      tokenId: token.id,
      mode: "drag",
      grabX: point.x - token.x,
      grabY: point.y - token.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    });
  };

  const handlePointerMove = (event) => {
    const grip = pointersRef.current.get(event.pointerId);
    if (!grip) return;
    const point = toBoard(event.clientX, event.clientY);
    const token = find(tokensRef.current, { id: grip.tokenId });
    if (!token) return;

    if (grip.mode === "rotate") {
      updateToken(token.id, {
        facing: Math.atan2(point.y - token.y, point.x - token.x),
      });
      return;
    }

    if (
      !grip.moved &&
      Math.hypot(
        event.clientX - grip.startClientX,
        event.clientY - grip.startClientY
      ) > TAP_SLOP_PX
    ) {
      grip.moved = true;
    }
    if (!grip.moved) return;

    // The board holds the tape measure: a march is clamped to the unit's
    // printed Movement, measured from where the turn found it.
    const wanted = clampToMovement(token, point.x - grip.grabX, point.y - grip.grabY);
    updateToken(token.id, clampToBoard(token, wanted.x, wanted.y));
  };

  const endPointer = (event) => {
    const grip = pointersRef.current.get(event.pointerId);
    if (!grip) return;
    pointersRef.current.delete(event.pointerId);
    const token = find(tokensRef.current, { id: grip.tokenId });
    if (!token || grip.mode === "rotate") {
      render();
      return;
    }

    if (grip.moved) {
      // A march that ends in contact with an enemy is a charge, and opens
      // the engagement without anyone reaching for a phone.
      const enemy = find(
        tokensRef.current,
        (other) => other.side !== token.side && inContact(token, other)
      );
      if (enemy) {
        updateToken(token.id, { charged: marchedInches(token) > 0.5 });
        onEngage(token.id, enemy.id);
      }
      render();
      return;
    }

    // A tap. On your own unit it takes the reins; on an enemy while one of
    // yours is selected it declares the attack — which is how a ranged
    // attack is made, with no need to march into contact.
    const selected = find(tokensRef.current, { id: selectedId });
    if (selected && selected.side !== token.side) {
      onEngage(selected.id, token.id);
    } else {
      onSelect(token.id === selectedId ? null : token.id);
    }
    render();
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    />
  );
}
