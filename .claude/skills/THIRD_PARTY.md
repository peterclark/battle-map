# Third-party skills

`threejs-fundamentals`, `threejs-geometry`, `threejs-materials`,
`threejs-lighting`, `threejs-textures`, `threejs-animation`, `threejs-loaders`,
`threejs-shaders`, `threejs-postprocessing` and `threejs-interaction` are not
written for this project. They were vendored verbatim from

    https://github.com/cloudai-x/threejs-skills
    commit b1c623076c661fc9b03dac19292e825a5d106823 (2026-01-20)

They are general Three.js references — API signatures, constructor arguments,
worked examples — and they carry no knowledge of this board. Everything
specific to Battle Map lives in `army-animation`, which is the skill to read
first and the only one to edit when a lesson is learned here.

Upstream publishes no licence file. Re-check before redistributing these
beyond this repository.

To refresh them, re-clone upstream and copy `skills/*` over the `threejs-*`
directories; do not hand-edit them, or the next refresh will silently discard
the edits.
