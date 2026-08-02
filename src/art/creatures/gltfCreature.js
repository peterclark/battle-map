import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Loading a bought creature.
//
// This is the whole of the third approach: a .glb carries the mesh, the
// skeleton, the materials and the animator's own clips, so the walk cycle is
// something someone made rather than something a sine curve approximates.
// Nothing here is specific to any one animal — point it at a different file
// and name different clips, and it is a different creature.
//
// The clip names are the only thing that varies between models. Sellers do
// not agree on a vocabulary, so the caller maps the board's three gaits onto
// whatever the file actually contains, and `clipNames` reports what that is.

const loader = new GLTFLoader();

/**
 * Load a creature and prepare it for the board.
 *
 * @param {string} url        the .glb to load
 * @param {object} options
 * @param {object} options.clips   board gait -> clip name in the file
 * @param {number} options.height  metres tall to scale the model to, so a
 *                                 creature bought at any scale lands at the
 *                                 size the board expects
 * @param {number} options.faceZ   rotation about Y to point the model down -Z,
 *                                 since exporters disagree on which way is
 *                                 forward
 */
export const loadCreature = (
  url,
  { clips = {}, height = 3.2, faceY = 0 } = {}
) =>
  new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        // A bought model arrives at whatever scale its author used and sitting
        // wherever its origin happens to be. Normalise both, so swapping one
        // creature for another does not mean re-tuning the scene.
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = height / (size.y || 1);
        model.scale.setScalar(scale);

        const scaled = new THREE.Box3().setFromObject(model);
        const centre = new THREE.Vector3();
        scaled.getCenter(centre);
        // Centre it on the spot, and stand it on the ground rather than
        // through it
        model.position.x -= centre.x;
        model.position.z -= centre.z;
        model.position.y -= scaled.min.y;

        model.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          // Sample and marketplace models are frequently exported single-sided
          // with inconsistent winding, which reads as holes from directly above
          if (child.material) child.material.side = THREE.FrontSide;
        });

        const root = new THREE.Group();
        root.rotation.y = faceY;
        root.add(model);

        const mixer = new THREE.AnimationMixer(model);
        const byName = new Map(gltf.animations.map((clip) => [clip.name, clip]));
        const actions = {};
        Object.entries(clips).forEach(([gait, clipName]) => {
          const clip = byName.get(clipName);
          if (clip) actions[gait] = mixer.clipAction(clip);
        });

        let current = null;
        /** Cross-fade to a gait. Blending is what a bought rig gives you that
         *  a hand-tuned curve does not — the change of gait is itself
         *  animated rather than a jump. */
        const play = (gait, fade = 0.25) => {
          const next = actions[gait];
          if (!next || next === current) return;
          next.reset().setEffectiveWeight(1).play();
          if (current) current.crossFadeTo(next, fade, false);
          current = next;
        };

        resolve({
          root,
          model,
          mixer,
          play,
          update: (delta) => mixer.update(delta),
          clipNames: gltf.animations.map((clip) => clip.name),
          actions,
        });
      },
      undefined,
      reject
    );
  });
