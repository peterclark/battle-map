import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { find, findLast, forEach } from "lodash";
import { damageStatus } from "../rules/data/index.js";
import { inContact } from "../engagement.js";
import { CARD_H, CARD_W, damageBoxRects } from "../art/cardFace.js";
import { cardImage, isDrawable } from "../art/cardImage.js";
import {
  BOARD_HEIGHT_INCHES,
  BOARD_WIDTH_INCHES,
  clampToBoard,
  clampToMovement,
  marchedInches,
} from "./board.js";

// A drag has to travel this far before it stops counting as a tap. An IR
// touch frame reports a pixel or two of jitter while a finger rests on the
// glass, and a war table gets leaned on.
const TAP_SLOP_PX = 8;
const DOUBLE_TAP_MS = 350;

// Below this on-screen width the card's own printed name is too small to
// read and a label plate is drawn beside it instead. At the size the table is
// really built for — a 48" board on a 48"-wide panel — a card renders at its
// true 2.5" and this never fires.
const LEGIBLE_CARD_PX = 150;

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

// Put the canvas into a token's own frame: origin at its centre, +x running
// across its front edge and +y back through its depth, so the card image and
// everything drawn over it share one coordinate system.
const enterTokenFrame = (ctx, t, token) => {
  ctx.save();
  ctx.translate(t.offsetX + token.x * t.scale, t.offsetY + token.y * t.scale);
  // The card art is drawn facing up its own -y; turning a further quarter
  // circle points that edge along the unit's facing on the board.
  ctx.rotate(token.facing + Math.PI / 2);
};

const drawBoard = (ctx, t, width, height) => {
  ctx.fillStyle = "#0e0c0a";
  ctx.fillRect(0, 0, width, height);

  const x0 = t.offsetX;
  const y0 = t.offsetY;
  const w = BOARD_WIDTH_INCHES * t.scale;
  const h = BOARD_HEIGHT_INCHES * t.scale;

  const felt = ctx.createRadialGradient(
    x0 + w / 2,
    y0 + h / 2,
    0,
    x0 + w / 2,
    y0 + h / 2,
    Math.max(w, h) / 1.4
  );
  felt.addColorStop(0, "#241f18");
  felt.addColorStop(1, "#12100c");
  ctx.fillStyle = felt;
  ctx.fillRect(x0, y0, w, h);

  // Inch grid, every sixth line heavier — the players read distances off
  // this the way they would off a tape measure
  ctx.lineWidth = 1;
  for (let i = 0; i <= BOARD_WIDTH_INCHES; i += 1) {
    ctx.strokeStyle = i % 6 === 0 ? "rgba(216,206,184,0.14)" : "rgba(216,206,184,0.045)";
    ctx.beginPath();
    ctx.moveTo(x0 + i * t.scale, y0);
    ctx.lineTo(x0 + i * t.scale, y0 + h);
    ctx.stroke();
  }
  for (let i = 0; i <= BOARD_HEIGHT_INCHES; i += 1) {
    ctx.strokeStyle = i % 6 === 0 ? "rgba(216,206,184,0.14)" : "rgba(216,206,184,0.045)";
    ctx.beginPath();
    ctx.moveTo(x0, y0 + i * t.scale);
    ctx.lineTo(x0 + w, y0 + i * t.scale);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(250,199,117,0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, w, h);
};

const drawMovementAllowance = (ctx, t, token) => {
  const cx = t.offsetX + token.orderX * t.scale;
  const cy = t.offsetY + token.orderY * t.scale;
  const allowance = (token.unit.move ?? 0) * t.scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, allowance, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(250,199,117,0.05)";
  ctx.fill();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(250,199,117,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  const marched = marchedInches(token);
  if (marched > 0.1) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(t.offsetX + token.x * t.scale, t.offsetY + token.y * t.scale);
    ctx.strokeStyle = "rgba(250,199,117,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fac775";
    ctx.font = `600 ${Math.round(Math.max(t.scale * 0.5, 11))}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      `${marched.toFixed(1)}" of ${token.unit.move}"`,
      (cx + t.offsetX + token.x * t.scale) / 2,
      (cy + t.offsetY + token.y * t.scale) / 2 - 8
    );
  }
  ctx.restore();
};

const roundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const drawToken = (ctx, t, token, { held, selected, engaged, repaint }) => {
  const cardW = token.halfWidth * 2 * t.scale;
  const cardH = token.halfDepth * 2 * t.scale;
  const image = cardImage(token.unit, token.color, repaint);
  const status = damageStatus(token.unit, token.marked);

  enterTokenFrame(ctx, t, token);

  // Cast shadow, so a card reads as lying on the table rather than printed
  // into it
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = Math.max(cardH * 0.12, 4);
  ctx.shadowOffsetY = Math.max(cardH * 0.05, 2);
  ctx.fillStyle = "#0e0c0a";
  roundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, cardH * 0.07);
  ctx.fill();
  ctx.restore();

  if (isDrawable(image)) {
    ctx.drawImage(image, -cardW / 2, -cardH / 2, cardW, cardH);
  }

  // Damage marks go over the printed track, so the card face stays cached
  // however chewed up the unit gets
  if (token.marked > 0) {
    const boxes = damageBoxRects(token.unit);
    ctx.save();
    for (let i = 0; i < Math.min(token.marked, boxes.length); i += 1) {
      const box = boxes[i];
      const x = (box.x / CARD_W) * cardW - cardW / 2;
      const y = (box.y / CARD_H) * cardH - cardH / 2;
      const w = (box.w / CARD_W) * cardW;
      const h = (box.h / CARD_H) * cardH;
      ctx.fillStyle = "rgba(14,12,10,0.82)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#e24b4a";
      ctx.lineWidth = Math.max(cardH * 0.012, 1);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + h * 0.25);
      ctx.lineTo(x + w * 0.8, y + h * 0.75);
      ctx.moveTo(x + w * 0.8, y + h * 0.25);
      ctx.lineTo(x + w * 0.2, y + h * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The front edge: a bright rule along the side the unit is facing, which is
  // the edge a charge has to reach and the one the arcs are measured from
  ctx.strokeStyle = engaged ? "#e24b4a" : "rgba(250,199,117,0.85)";
  ctx.lineWidth = Math.max(cardH * 0.05, 2);
  ctx.beginPath();
  ctx.moveTo(-cardW / 2 + cardW * 0.08, -cardH / 2);
  ctx.lineTo(cardW / 2 - cardW * 0.08, -cardH / 2);
  ctx.stroke();

  if (held || selected || engaged) {
    ctx.strokeStyle = engaged ? "#e24b4a" : "#fac775";
    ctx.lineWidth = Math.max(cardH * 0.035, 2);
    roundedRect(
      ctx,
      -cardW / 2 - 3,
      -cardH / 2 - 3,
      cardW + 6,
      cardH + 6,
      cardH * 0.09
    );
    ctx.stroke();
  }

  if (status === "destroyed") {
    ctx.strokeStyle = "#a32d2d";
    ctx.lineWidth = Math.max(cardH * 0.06, 3);
    ctx.beginPath();
    ctx.moveTo(-cardW / 2, -cardH / 2);
    ctx.lineTo(cardW / 2, cardH / 2);
    ctx.moveTo(cardW / 2, -cardH / 2);
    ctx.lineTo(-cardW / 2, cardH / 2);
    ctx.stroke();
  }

  ctx.restore();
};

const overlaps = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// The card prints its own name, but on a screen far smaller than the table
// the type is unreadable, so a plate is drawn beside it. Cards standing in
// contact would print their plates on top of each other, so each takes the
// first free slot below or above its unit.
const drawLabel = (ctx, t, token, placed) => {
  const cx = t.offsetX + token.x * t.scale;
  const cy = t.offsetY + token.y * t.scale;
  const reach = Math.hypot(token.halfWidth, token.halfDepth) * t.scale;
  const size = Math.max(Math.round(t.scale * 0.42), 10);

  ctx.save();
  ctx.font = `700 ${size}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const label = token.unit.name;
  const width = ctx.measureText(label).width + size * 0.9;
  const height = size * 1.6;
  const gap = reach + height * 0.7;

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

  roundedRect(ctx, spot.x - width / 2, spot.y - height / 2, width, height, size * 0.35);
  ctx.fillStyle = "rgba(14,12,10,0.88)";
  ctx.fill();
  ctx.strokeStyle = `${token.color}99`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle =
    damageStatus(token.unit, token.marked) === "destroyed" ? "#e24b4a" : "#f2ecdd";
  ctx.fillText(label, spot.x, spot.y);
  ctx.restore();
};

const drawEngagementLine = (ctx, t, attacker, defender) => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(t.offsetX + attacker.x * t.scale, t.offsetY + attacker.y * t.scale);
  ctx.lineTo(t.offsetX + defender.x * t.scale, t.offsetY + defender.y * t.scale);
  ctx.strokeStyle = "#e24b4a";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.restore();
};

// Is a board point inside this card? Measured in the card's own frame, so a
// turned card is hit where it looks, not where its bounding box is.
const hits = (token, point, grace) => {
  const dx = point.x - token.x;
  const dy = point.y - token.y;
  const along = dx * Math.cos(token.facing) + dy * Math.sin(token.facing);
  const across = -dx * Math.sin(token.facing) + dy * Math.cos(token.facing);
  return (
    Math.abs(along) <= token.halfDepth + grace &&
    Math.abs(across) <= token.halfWidth + grace
  );
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
  // pointerId -> { tokenId, mode, grabX, grabY, startClientX/Y, moved }
  const pointersRef = useRef(new Map());
  const lastTapRef = useRef({ tokenId: null, at: 0 });
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const renderRef = useRef(() => {});

  const toBoard = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = transformRef.current;
    return {
      x: (clientX - rect.left - t.offsetX) / t.scale,
      y: (clientY - rect.top - t.offsetY) / t.scale,
    };
  }, []);

  // Topmost card under a board point. Later cards draw over earlier ones, so
  // the search runs back to front to match what the players can see.
  const tokenAt = useCallback((point) => {
    const grace = 6 / transformRef.current.scale;
    return findLast(tokensRef.current, (token) => hits(token, point, grace));
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

    // A card face finishes decoding after the frame that asked for it, so it
    // asks for one more once it can be drawn
    const repaint = () => renderRef.current();

    forEach(tokensRef.current, (token) =>
      drawToken(ctx, t, token, {
        held: held.has(token.id),
        selected: token.id === selectedId,
        engaged:
          engagement &&
          (engagement.attackerId === token.id ||
            engagement.defenderId === token.id),
        repaint,
      })
    );

    if (t.scale * 2.5 < LEGIBLE_CARD_PX) {
      const placed = [];
      forEach(tokensRef.current, (token) => drawLabel(ctx, t, token, placed));
    }

    ctx.restore();
  }, [selectedId, engagement]);

  renderRef.current = render;

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

    // A second finger while a card is held turns it: hold the regiment, and
    // touch where you want it to face.
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

    // Two taps on the same card rescind its order — it marches back to where
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
