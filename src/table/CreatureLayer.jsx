import { useEffect, useRef, useState } from "react";
import { damageStatus } from "../rules/data/index.js";
import { ART_FIELD_DEPTH } from "../art/cardFace.js";
import {
  BOARD_HEIGHT_INCHES,
  BOARD_WIDTH_INCHES,
  marchedInches,
  unitStand,
} from "./board.js";
import { creatureKindFor } from "../art/creatures/roster.js";

// The figures, drawn over the stands.
//
// This is a second canvas rather than a second renderer inside the first,
// because the two are good at different things: the 2D context draws a card,
// a damage box and a name plate far more cheaply than WebGL would, and WebGL
// lights and shadows a creature in a way the 2D context cannot at all. They
// are stacked and share one coordinate system, so a stand and the figures
// standing on it cannot drift apart.
//
// Three.js is imported dynamically. The table's own bundle is 313 KB and the
// library is another 600; a player who never turns figures on should never
// pay for them.

// A player who has asked their system for less motion gets figures that are
// modelled and lit but do not move: one frame is drawn and the loop stops.
const prefersStillness = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Board inches to world units, one to one, with the origin at board centre —
// the same frame the 2D canvas uses once its fit transform is applied.
const worldX = (inches) => inches - BOARD_WIDTH_INCHES / 2;
const worldZ = (inches) => inches - BOARD_HEIGHT_INCHES / 2;

// A token's facing is an angle on the board, where +PI/2 points down the
// screen. A creature is modelled facing its own -Z. This is the rotation that
// reconciles them.
const headingToRotation = (facing) =>
  Math.atan2(-Math.cos(facing), -Math.sin(facing));

// What the figures should be doing, read off the same board state the cards
// read: fighting if they are in the open engagement, marching if they have
// moved from their order anchor this turn, standing otherwise.
const stateFor = (token, engagement) => {
  if (
    engagement &&
    (token.id === engagement.attackerId || token.id === engagement.defenderId)
  ) {
    return "attack";
  }
  return marchedInches(token) > 0.05 ? "march" : "idle";
};

export default function CreatureLayer({ tokens, engagement, enabled }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const tokensRef = useRef(tokens);
  const engagementRef = useRef(engagement);
  const [failed, setFailed] = useState(null);

  tokensRef.current = tokens;
  engagementRef.current = engagement;

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    let frame = 0;

    const boot = async () => {
      const [THREE, { buildScene }, { tuneRenderer }, { builderFor }] =
        await Promise.all([
          import("three"),
          import("../art/creatures/trex3d.js"),
          import("../art/creatures/materials.js"),
          import("../art/creatures/registry.js"),
        ]);
      if (!live) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearAlpha(0);
      tuneRenderer(renderer);

      // The board is wider than it is tall, and the fit is driven by whichever
      // axis runs out first — exactly as the 2D canvas does it.
      const { scene, camera, ground, key } = buildScene(
        BOARD_WIDTH_INCHES,
        BOARD_HEIGHT_INCHES,
        { span: BOARD_HEIGHT_INCHES }
      );
      // The ground belongs to the 2D board underneath; this layer only owns
      // what stands on it.
      scene.remove(ground);
      // A shadow frustum sized to the board rather than to one monster,
      // which is the mistake the benchmark caught.
      const reach = Math.ceil(
        Math.max(BOARD_WIDTH_INCHES, BOARD_HEIGHT_INCHES) / 2
      );
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -reach;
      key.shadow.camera.right = reach;
      key.shadow.camera.top = reach;
      key.shadow.camera.bottom = -reach;
      key.shadow.camera.updateProjectionMatrix();

      // A stand-shaped catcher so figures cast onto their own base rather
      // than into the void
      const shadowCatcher = new THREE.Mesh(
        new THREE.PlaneGeometry(BOARD_WIDTH_INCHES, BOARD_HEIGHT_INCHES),
        new THREE.ShadowMaterial({ opacity: 0.38 })
      );
      shadowCatcher.rotation.x = -Math.PI / 2;
      shadowCatcher.receiveShadow = true;
      scene.add(shadowCatcher);

      // No ambient occlusion here, and that is a measurement rather than an
      // oversight. `UnitPortrait` uses it; this layer used to, and gave it up.
      //
      // The board is 48 inches across on a 3840-pixel panel, which puts a
      // stand's art field at about 256 by 106 pixels. Rendered side by side at
      // exactly that size, occlusion on and off are indistinguishable — the
      // creases it darkens are a pixel or two wide from straight overhead, and
      // it has no stand to cast against because the cards are a separate
      // canvas and are not in this depth buffer at all.
      //
      // It cost 8ms of a 16.7ms frame for that: ten units at native 4K went
      // 62fps to 38. Half-resolution buffers gave 2ms of it back, which is how
      // we learned the bill is not fill-rate — GTAO draws the whole scene a
      // second time into a normal buffer before it can shade anything, and
      // 1,601 meshes resubmitted costs the same however big the buffer is.
      //
      // So it goes where it earns its pass. The portrait is one creature at a
      // tilt filling a panel, which is the only view here where a crease has
      // any depth to read.

      const stage = {
        THREE,
        renderer,
        scene,
        camera,
        builderFor,
        built: new Map(),
        start: performance.now(),
      };
      stageRef.current = stage;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(rect.width, rect.height, false);
        // Mirror the 2D canvas's fit exactly. It scales by whichever axis runs
        // out first and letterboxes the rest; a camera that merely matched the
        // aspect ratio would agree on wide panels and part company on narrow
        // ones, sliding every creature off the stand it belongs to.
        const pxPerInch = Math.min(
          rect.width / BOARD_WIDTH_INCHES,
          rect.height / BOARD_HEIGHT_INCHES
        );
        camera.left = -rect.width / (2 * pxPerInch);
        camera.right = rect.width / (2 * pxPerInch);
        camera.top = rect.height / (2 * pxPerInch);
        camera.bottom = -rect.height / (2 * pxPerInch);
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      const syncOne = (token) => {
        let built = stage.built.get(token.id);
        if (!built) {
          const kind = creatureKindFor(token.unit);
          const builder = kind && builderFor(kind.kind);
          if (!builder) return null;
          const made = builder.build(token.unit);
          const holder = new THREE.Group();
          holder.add(made.root);

          // Scale the figures to the stand they occupy. Builders model at
          // whatever size reads best on their own, so the fit is measured
          // rather than assumed.
          //
          // The band they get is the card's art field, not the whole card:
          // the bottom of a stand carries the banner, the stat bar and the
          // damage track, and figures standing on those make the one thing
          // players actually have to read unreadable.
          //
          // A long animal is allowed more depth than that, because the band is
          // barely three fifths of the card and the fit takes the *smaller* of
          // the two axes. A Tyrannosaurus is three times longer than it is
          // wide, so it was being scaled to fit its own nose-to-tail length
          // into that band and coming out at a seventh of the size its stand
          // could carry — a Colossal rendering smaller than a spearman.
          //
          // `depth` lets a kind overhang, and the placement below sends the
          // excess forward, off the front edge, rather than back across the
          // banner. That is also what a big miniature does on a base.
          const stand = unitStand(token.unit);
          const bandDepth = stand.halfDepth * 2 * ART_FIELD_DEPTH;
          const box = new THREE.Box3().setFromObject(made.root);
          const size = box.getSize(new THREE.Vector3());
          const fit = Math.min(
            (stand.halfWidth * 2 * kind.fill) / (size.x || 1),
            (bandDepth * (kind.depth ?? kind.fill)) / (size.z || 1)
          );
          made.root.scale.setScalar(fit);

          // Where the rig ends up has to account for where it *goes*, not just
          // where it starts. A resting bounding box is not the space a unit
          // occupies once it is animating: a spear block sweeps 39% deeper
          // than it measures at rest, a Tyrannosaurus 23%, and the difference
          // is spears and tails drawn across the name banner. So sample the
          // gaits and place the rig by the box it actually needs.
          const swept = new THREE.Box3();
          const probe = new THREE.Box3();
          ["idle", "march", "attack"].forEach((state) => {
            for (let i = 0; i < 6; i += 1) {
              builder.pose(made, i * 0.63, state);
              made.root.updateMatrixWorld(true);
              swept.union(probe.setFromObject(made.root));
            }
          });
          const sweptSize = swept.getSize(new THREE.Vector3());
          const sweptCentre = swept.getCenter(new THREE.Vector3());

          // A card faces its own -Z, so the art field runs from the front edge
          // back. Centre in the band when the rig stays inside it, and when it
          // does not, pin its back edge to the back of the band so everything
          // over-length hangs off the front — which is what a big miniature
          // does on a base, and keeps the banner clear either way.
          const bandCentre = stand.halfDepth * (ART_FIELD_DEPTH - 1);
          const bandBack = stand.halfDepth * (2 * ART_FIELD_DEPTH - 1);
          const anchor = Math.min(bandCentre, bandBack - sweptSize.z / 2);

          made.root.position.x = -sweptCentre.x;
          made.root.position.z = anchor - sweptCentre.z;
          made.root.position.y = -swept.min.y;

          built = { ...made, holder, builder };
          stage.built.set(token.id, built);
          scene.add(holder);
        }
        return built;
      };

      const step = (now) => {
        if (!live) return;
        const time = (now - stage.start) / 1000;
        const current = tokensRef.current;
        const seen = new Set();

        current.forEach((token) => {
          // A destroyed unit's card stays on the table as a record; its
          // figures do not, because they are dead
          if (damageStatus(token.unit, token.marked) === "destroyed") return;
          const built = syncOne(token);
          if (!built) return;
          seen.add(token.id);
          built.holder.position.set(worldX(token.x), 0, worldZ(token.y));
          built.holder.rotation.y = headingToRotation(token.facing);
          built.builder.pose(built, time, stateFor(token, engagementRef.current));
        });

        // A unit that left the board takes its figures with it
        stage.built.forEach((built, id) => {
          if (seen.has(id)) return;
          scene.remove(built.holder);
          stage.built.delete(id);
        });

        renderer.render(scene, camera);
        if (!prefersStillness()) frame = requestAnimationFrame(step);
      };

      frame = requestAnimationFrame(step);

      stage.teardown = () => {
        observer.disconnect();
        renderer.dispose();
      };
    };

    boot().catch((error) => {
      // Figures are an enhancement; the cards underneath are the game. If
      // WebGL is unavailable or the import fails, say so and stay out of the
      // way rather than taking the board down.
      if (live) setFailed(error?.message ?? "figures unavailable");
    });

    return () => {
      live = false;
      cancelAnimationFrame(frame);
      stageRef.current?.teardown?.();
      stageRef.current = null;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {failed && (
        <p className="pointer-events-none absolute inset-x-0 top-2 text-center font-mono text-[10px] uppercase tracking-wider text-ember-400">
          Figures unavailable — {failed}
        </p>
      )}
    </>
  );
}
