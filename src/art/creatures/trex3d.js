import * as THREE from "three";
import {
  at,
  bevelled,
  merge,
  part as skinned,
  surfaceMaterial,
  turned,
} from "./kit.js";

// The Tyrannosaurus, and the scene every creature is lit by: real geometry
// under a real
// light, with the camera pointed straight down at it.
//
// The comparison this exists to settle is not "which drawing is better" — it
// is what each approach gets you for free. Here, the shadow is cast rather
// than drawn, the flank is shaded by where the light actually is, and the
// stride is a joint hierarchy rather than a set of sine curves chosen to look
// like one. The costs move too: a WebGL context, a 600 KB dependency, and a
// GPU doing work on whatever box drives the table.
//
// The geometry is primitives rather than a sculpted model, but it is no
// longer a stack of boxes. Since this is one animal alone on a Colossal stand
// — the biggest thing in the game, and the one most likely to be looked at
// closely in the combat panel — it is worth the geometry: a skull cut as a
// profile with a fenestra behind the eye, lips over the tooth rows,
// osteoderms down the spine, and a foot with three toes and claws. All of it
// merges into eighteen buffers, one per joint that actually moves, where the
// box version needed fifty meshes to say less.

const HIDE = 0x3f5a2a;
const HIDE_DARK = 0x2b3d19;
const BELLY = 0x8d9c5b;
const CLAW = 0xe8e2cf;
const MAW = 0x6d2730;

const EYE = 0xe8a423;

const HIDE_S = { roughness: 0.86 };
const SCUTE = { metalness: 0.15, roughness: 0.6 };
const BONE = { metalness: 0.2, roughness: 0.45 };
const WET = { metalness: 0.35, roughness: 0.24 };

// Outlines are x-across, y-along. `prone` lays one down pointing forward,
// which is how a skull, a jaw and a foot are built here.
const prone = (points, thickness, bevel = 0.03) =>
  at(bevelled(points, thickness, bevel), { rot: [-Math.PI / 2, 0, 0] });

const hang = (parent, geometry, material, position) => {
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const tooth = (size) =>
  turned(
    [
      [size, 0],
      [size * 0.8, size * 0.7],
      [size * 0.45, size * 1.5],
      [0, size * 2.1],
    ],
    8
  );

const trunkParts = () => [
  skinned(new THREE.CapsuleGeometry(1.15, 1.9, 10, 18), HIDE, {
    pos: [0, 0, -1.1],
    rot: [Math.PI / 2, 0, 0],
    scale: [1, 0.82, 1.05],
    ...HIDE_S,
  }),
  skinned(new THREE.CapsuleGeometry(0.92, 1.6, 10, 18), BELLY, {
    pos: [0, -0.42, -1.1],
    rot: [Math.PI / 2, 0, 0],
    scale: [0.94, 0.8, 0.9],
    ...HIDE_S,
  }),
  // Osteoderms down the spine — the one pale line an overhead camera can
  // follow the whole length of the animal
  ...[-2.4, -1.9, -1.4, -0.9, -0.4, 0.1, 0.6].map((z, i) =>
    skinned(new THREE.OctahedronGeometry(0.16 + (i % 2) * 0.04, 0), CLAW, {
      pos: [0, 0.9 - Math.abs(i - 3) * 0.03, z],
      scale: [0.55, 1, 1.5],
      ...SCUTE,
    })
  ),
];

const neckParts = () => [
  skinned(new THREE.CapsuleGeometry(0.68, 0.6, 10, 16), HIDE, {
    pos: [0, 0, -0.38],
    rot: [Math.PI / 2.3, 0, 0],
    ...HIDE_S,
  }),
];

const headParts = () => {
  const parts = [
    // A skull cut as a profile: deep at the hinge, tapering to the snout,
    // with the brow ridge standing proud above the eye
    skinned(
      prone(
        [
          [-0.68, -1.05],
          [0.68, -1.05],
          [0.6, -0.2],
          [0.44, 0.5],
          [0.3, 0.95],
          [0, 1.05],
          [-0.3, 0.95],
          [-0.44, 0.5],
          [-0.6, -0.2],
        ],
        0.86,
        0.05
      ),
      HIDE,
      { pos: [0, 0, -0.72], ...HIDE_S }
    ),
    // Brows, which is what makes a skull read as a skull from above
    ...[0.44, -0.44].map((x) =>
      skinned(new THREE.BoxGeometry(0.3, 0.22, 0.5), HIDE_DARK, {
        pos: [x, 0.34, -0.74],
        rot: [0, x > 0 ? -0.1 : 0.1, 0],
        ...HIDE_S,
      })
    ),
    // The fenestra behind the eye, sunk into the cheek
    ...[0.6, -0.6].map((x) =>
      skinned(new THREE.SphereGeometry(0.22, 10, 8), HIDE_DARK, {
        pos: [x, 0.02, -0.42],
        scale: [0.4, 1, 1.5],
        ...HIDE_S,
      })
    ),
    ...[0.44, -0.44].map((x) =>
      skinned(new THREE.SphereGeometry(0.13, 14, 12), EYE, {
        pos: [x, 0.28, -0.86],
        ...WET,
      })
    ),
    // Nostrils
    ...[0.16, -0.16].map((x) =>
      skinned(new THREE.SphereGeometry(0.08, 8, 7), HIDE_DARK, {
        pos: [x, 0.14, -1.66],
        scale: [0.7, 0.8, 1.4],
        ...HIDE_S,
      })
    ),
  ];
  // Upper tooth row, with a lip over it
  for (let i = 0; i < 5; i += 1) {
    const z = -0.42 - i * 0.32;
    const size = 0.14 - i * 0.012;
    [0.32, -0.32].forEach((x) =>
      parts.push(
        skinned(tooth(size), CLAW, { pos: [x, -0.18, z], rot: [Math.PI, 0, 0], ...BONE })
      )
    );
  }
  return parts;
};

const jawParts = () => {
  const parts = [
    skinned(
      prone(
        [
          [-0.35, -1.0],
          [0.35, -1.0],
          [0.3, -0.1],
          [0.18, 0.7],
          [0, 0.95],
          [-0.18, 0.7],
          [-0.3, -0.1],
        ],
        0.3,
        0.03
      ),
      HIDE_DARK,
      { pos: [0, -0.1, -1.0], ...HIDE_S }
    ),
    skinned(new THREE.BoxGeometry(0.52, 0.12, 1.5), MAW, {
      pos: [0, 0.06, -0.95],
      ...HIDE_S,
    }),
  ];
  for (let i = 0; i < 5; i += 1) {
    const z = -0.42 - i * 0.32;
    const size = 0.14 - i * 0.012;
    [0.3, -0.3].forEach((x) =>
      parts.push(skinned(tooth(size), CLAW, { pos: [x, 0.12, z], ...BONE }))
    );
  }
  return parts;
};

const tailParts = (i) => [
  skinned(new THREE.CapsuleGeometry(0.86 - i * 0.13, 0.5, 8, 16), HIDE, {
    pos: [0, 0, 0.42],
    rot: [Math.PI / 2, 0, 0],
    ...HIDE_S,
  }),
  skinned(new THREE.OctahedronGeometry(0.14 - i * 0.018, 0), CLAW, {
    pos: [0, 0.82 - i * 0.13, 0.36],
    scale: [0.55, 1, 1.5],
    ...SCUTE,
  }),
];

const thighParts = () => [
  skinned(new THREE.CapsuleGeometry(0.66, 1.05, 10, 16), HIDE, {
    pos: [0, -0.5, 0],
    scale: [1, 1, 1.3],
    ...HIDE_S,
  }),
];

const shinParts = () => [
  skinned(new THREE.CapsuleGeometry(0.34, 0.95, 8, 16), HIDE_DARK, {
    pos: [0, -0.5, 0],
    ...HIDE_S,
  }),
];

const footParts = () => {
  const parts = [
    skinned(new THREE.BoxGeometry(0.5, 0.22, 0.6), HIDE_DARK, {
      pos: [0, -0.1, -0.16],
      ...HIDE_S,
    }),
  ];
  [-0.3, 0, 0.3].forEach((fan) => {
    parts.push(
      skinned(
        prone(
          [
            [-0.09, -0.32],
            [0.09, -0.32],
            [0.08, 0.28],
            [-0.08, 0.28],
          ],
          0.16,
          0.02
        ),
        HIDE_DARK,
        {
          pos: [Math.sin(fan) * 0.34, -0.12, -0.52 - Math.cos(fan) * 0.1],
          rot: [0, fan, 0],
          ...HIDE_S,
        }
      ),
      skinned(
        turned(
          [
            [0.1, 0],
            [0.08, 0.1],
            [0.05, 0.2],
            [0, 0.3],
          ],
          10
        ),
        CLAW,
        {
          pos: [Math.sin(fan) * 0.4, -0.12, -0.88 - Math.cos(fan) * 0.1],
          rot: [-Math.PI / 2, fan, 0],
          ...BONE,
        }
      )
    );
  });
  return parts;
};

const armParts = () => [
  skinned(new THREE.CapsuleGeometry(0.16, 0.42, 8, 14), HIDE_DARK, {
    pos: [0, -0.3, 0],
    ...HIDE_S,
  }),
  ...[0.06, -0.06].map((x) =>
    skinned(
      turned(
        [
          [0.07, 0],
          [0.05, 0.1],
          [0, 0.26],
        ],
        8
      ),
      CLAW,
      { pos: [x, -0.62, -0.1], rot: [-0.5, 0, 0], ...BONE }
    )
  ),
];

/**
 * Build the animal. Returns the root object plus the joints an animation
 * needs to touch, so posing is setting rotations rather than rebuilding.
 */
export const buildTyrannosaur = () => {
  const material = surfaceMaterial();
  const root = new THREE.Group();

  // Hips carry everything; the animal pivots about them the way it really does
  const hips = new THREE.Group();
  hips.position.set(0, 2.6, 0.6);
  root.add(hips);
  hang(hips, merge(trunkParts()), material);

  // Neck and head, hinged so the head can swing and duck
  const neck = new THREE.Group();
  neck.position.set(0, 0.3, -1.95);
  hips.add(neck);
  hang(neck, merge(neckParts()), material);

  const head = new THREE.Group();
  head.position.set(0, 0.26, -1.02);
  neck.add(head);
  hang(head, merge(headParts()), material);

  // Lower jaw on its own hinge
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.24, -0.2);
  head.add(jaw);
  hang(jaw, merge(jawParts()), material);

  // Tail: a chain of groups, each hung off the last, so a wave started at the
  // hips travels outward on its own
  const tail = [];
  let attach = hips;
  for (let i = 0; i < 6; i += 1) {
    const seg = new THREE.Group();
    seg.position.set(0, 0, i === 0 ? 1.0 : 0.86);
    attach.add(seg);
    hang(seg, merge(tailParts(i)), material);
    tail.push(seg);
    attach = seg;
  }

  const thighBuffer = merge(thighParts());
  const shinBuffer = merge(shinParts());
  const footBuffer = merge(footParts());
  const legs = [1, -1].map((side) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * 1.12, -0.1, -0.1);
    hips.add(thigh);
    thigh.rotation.z = -side * 0.34;
    hang(thigh, thighBuffer, material);

    const shin = new THREE.Group();
    shin.position.set(0, -1.05, 0);
    shin.rotation.z = side * 0.34;
    thigh.add(shin);
    hang(shin, shinBuffer, material);

    const foot = new THREE.Group();
    foot.position.set(0, -1.05, 0);
    shin.add(foot);
    hang(foot, footBuffer, material);

    return { thigh, shin, foot };
  });

  const armBuffer = merge(armParts());
  const arms = [1, -1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.78, 0.1, -1.85);
    hips.add(arm);
    hang(arm, armBuffer, material);
    return arm;
  });

  return { root, hips, neck, head, jaw, tail, legs, arms };
};

const GAITS = {
  idle: { wave: 1.1, waveGain: 0.5, stride: 0.1, bob: 0.4, jaw: 0.05, surge: 0 },
  march: { wave: 2.4, waveGain: 1, stride: 1, bob: 1, jaw: 0.12, surge: 0 },
  attack: { wave: 3.3, waveGain: 1.3, stride: 0.55, bob: 1.5, jaw: 1, surge: 1 },
};

/**
 * Pose the animal for a moment in time. Nothing is rebuilt — this only sets
 * rotations, which is what keeps a boardful of them affordable.
 */
export const poseTyrannosaur = (rig, time, state = "idle") => {
  const gait = GAITS[state] ?? GAITS.idle;
  const t = time;

  // The wave travels down the tail rather than swinging it as one piece
  rig.tail.forEach((seg, i) => {
    seg.rotation.y =
      Math.sin(t * gait.wave - i * 0.6) * 0.17 * gait.waveGain * (1 + i * 0.2);
    seg.rotation.x = Math.sin(t * gait.wave * 0.5 - i * 0.4) * 0.05;
  });

  // Head and neck counter the tail, which is what keeps the animal balanced
  rig.neck.rotation.y = -Math.sin(t * gait.wave) * 0.1 * gait.waveGain;
  rig.neck.rotation.x = 0.1 + Math.sin(t * gait.wave * 2) * 0.05 * gait.bob;
  rig.head.rotation.x = -0.12 + Math.sin(t * gait.wave * 2 + 0.7) * 0.07 * gait.bob;
  rig.head.rotation.y = Math.sin(t * 0.7) * 0.14;

  const jawOpen =
    state === "attack"
      ? 0.28 + 0.34 * Math.abs(Math.sin(t * 5))
      : gait.jaw + Math.max(Math.sin(t * 0.6), 0.8) * 0.06;
  rig.jaw.rotation.x = jawOpen;

  // Stride: the two legs run half a cycle apart, and the shin trails the thigh
  rig.legs.forEach(({ thigh, shin, foot }, i) => {
    const phase = t * gait.wave * 2 + i * Math.PI;
    thigh.rotation.x = Math.sin(phase) * 0.55 * gait.stride;
    shin.rotation.x = Math.max(-Math.sin(phase - 0.7), 0) * 0.8 * gait.stride;
    foot.rotation.x = -thigh.rotation.x * 0.5 - shin.rotation.x * 0.5;
  });

  rig.arms.forEach((arm, i) => {
    arm.rotation.x = -0.5 + Math.sin(t * 3 + i) * 0.16;
  });

  // The whole animal rises and falls on each stride, and pitches into a lunge
  rig.hips.position.y = 2.6 + Math.sin(t * gait.wave * 4) * 0.11 * gait.bob;
  rig.hips.rotation.x =
    Math.sin(t * gait.wave * 2) * 0.03 * gait.bob -
    gait.surge * Math.max(Math.sin(t * 5), 0) * 0.16;
  rig.root.position.z = -gait.surge * Math.max(Math.sin(t * 5), 0) * 0.9;
};

/**
 * A scene lit for a table seen from directly above: one hard key throwing a
 * real shadow across the ground, and enough fill that the flanks do not go
 * black. The camera is orthographic, so the animal does not distort toward
 * the edges of the board the way a perspective lens would.
 */
export const buildScene = (width, height, { span = 14 } = {}) => {
  const scene = new THREE.Scene();

  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(
    (-span * aspect) / 2,
    (span * aspect) / 2,
    span / 2,
    -span / 2,
    0.1,
    100
  );
  camera.position.set(0, 20, 0);
  camera.lookAt(0, 0, 0);
  // Straight down needs an explicit up, or the view rolls arbitrarily
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xfff0d0, 2.1);
  key.position.set(3.5, 17, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0015;
  scene.add(key);

  scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x2b3d19, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  // A rim from behind and low, opposite the key. It does almost nothing to
  // brightness and a great deal to shape: it catches the far edge of a helmet
  // or a shoulder and separates the figure from whatever is behind it, which
  // is the difference between a lit model and a lump with a shadow.
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.1);
  rim.position.set(-6, 4, -9);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x3f6420, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  return { scene, camera, ground, key, rim };
};

/**
 * Point the camera at the board from `degrees` off vertical. Zero is straight
 * down, which is the honest choice for a surface two players stand across —
 * any tilt favours whoever is on the low side.
 */
export const setTilt = (camera, degrees) => {
  const radians = (degrees * Math.PI) / 180;
  const distance = 20;
  camera.position.set(
    0,
    Math.cos(radians) * distance,
    Math.sin(radians) * distance
  );
  camera.up.set(0, Math.cos(radians), -Math.sin(radians));
  camera.lookAt(0, 1.6, 0);
  camera.updateProjectionMatrix();
};
