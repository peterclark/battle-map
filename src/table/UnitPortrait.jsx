import { useEffect, useRef } from "react";
import { creatureKindFor } from "../art/creatures/roster.js";

// One unit, seen from a three-quarter angle, beside its card in the combat
// panel.
//
// The board itself is locked to a camera looking straight down and will stay
// that way: the two players stand on opposite long edges, and any tilt that
// gives figures volume necessarily favours one of them. There is no angle
// that is fair to both — the only rotation that treats the seats equally is
// about the vertical, and that adds no depth at all. A tilt would also let
// tall figures hide short ones, differently for each player, on a surface
// whose whole job is to let you judge contact and frontage by eye.
//
// The panel is the exception, and it is exempt for a reason rather than by
// preference. It already opens on the edge belonging to whoever called the
// attack and already faces that seat, so it is asymmetric *by construction,
// in the right direction*. A tilted portrait inside it is seen by the one
// player it is meant for, which is precisely what cannot be arranged on the
// board.
//
// This is also where the sculpting finally pays. Every odd decision in the
// creature rigs — spears laid back off the vertical, frills flattened, wings
// held spread, cloaks and caparisons — exists only to survive the overhead
// camera. Tilted, none of that compensation is needed and the models look
// like what they are.

// Far enough off vertical to give real volume, not so far that a rank behind
// disappears behind the rank in front
const PORTRAIT_TILT = 34;

export default function UnitPortrait({ token, enabled = true, state = "attack" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!enabled || !token) return undefined;
    const kind = creatureKindFor(token.unit);
    if (!kind) return undefined;

    let live = true;
    let frame = 0;
    let teardown = null;

    const boot = async () => {
      // Three.js is already resident whenever this renders — portraits only
      // appear with figures switched on — so these resolve from cache
      const [THREE, { buildScene, setTilt }, { tuneRenderer }, { builderFor }] =
        await Promise.all([
          import("three"),
          import("../art/creatures/trex3d.js"),
          import("../art/creatures/materials.js"),
          import("../art/creatures/registry.js"),
        ]);
      if (!live) return;

      const builder = builderFor(kind.kind);
      const canvas = canvasRef.current;
      if (!builder || !canvas) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearAlpha(0);
      tuneRenderer(renderer);

      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);

      const { scene, camera, ground, key } = buildScene(width, height, { span: 7 });
      // The card behind is the background; a ground plane would just be a
      // grey slab across it
      scene.remove(ground);
      key.shadow.mapSize.set(1024, 1024);

      const made = builder.build();
      const holder = new THREE.Group();
      holder.add(made.root);
      scene.add(holder);

      // Frame whatever was built. A block of twenty and a single dragon both
      // have to arrive at a usable size without this knowing their dimensions.
      const box = new THREE.Box3().setFromObject(made.root);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const fit = 5.4 / Math.max(size.x, size.z, 0.001);
      made.root.scale.setScalar(fit);
      made.root.position.set(-centre.x * fit, -box.min.y * fit, -centre.z * fit);

      setTilt(camera, PORTRAIT_TILT);
      // Turned a little off square so the unit is seen from its front
      // quarter rather than head-on, which is what gives it depth
      holder.rotation.y = 0.6;

      const start = performance.now();
      const step = (now) => {
        if (!live) return;
        builder.pose(made, (now - start) / 1000, state);
        renderer.render(scene, camera);
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);

      teardown = () => {
        renderer.dispose();
        // Portraits come and go with every engagement, and a browser will
        // only hand out so many WebGL contexts before it starts dropping the
        // oldest — which would take the board's own canvas with it
        renderer.forceContextLoss();
      };
    };

    boot().catch(() => {
      // A portrait is decoration; the card beside it is the game
    });

    return () => {
      live = false;
      cancelAnimationFrame(frame);
      teardown?.();
    };
  }, [token, enabled, state]);

  if (!enabled || !token || !creatureKindFor(token.unit)) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="h-20 w-32 shrink-0 rounded border border-iron-500/70 bg-iron-900/50"
    />
  );
}
