import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // The table itself
        main: resolve(import.meta.dirname, "index.html"),
        // A workbench for one creature at a time. A separate entry so
        // Three.js never lands in the app's own bundle.
        creatureLab: resolve(import.meta.dirname, "demo/creature-lab.html"),
        // Draw-call benchmark for the animated formations
        bench: resolve(import.meta.dirname, "demo/bench.html"),
        // The board itself, laid out for photographing at true stand scale
        boardShoot: resolve(import.meta.dirname, "demo/board-shoot.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    coverage: {
      provider: "v8",
      // `json-summary` is the one the badge needs; the others are for humans.
      reporter: ["text-summary", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",

      // What coverage is measured over, and why it is not simply `src/**`.
      //
      // Two thirds of this codebase draws rather than decides: the Three.js
      // creature rigs, the canvas battlefield, and the React screens. Those are
      // verified the way the README and the army-animation skill say they are —
      // by rendering them at true stand scale and looking, which is the only
      // check that catches the failures they actually have (a figure that
      // vanishes into the turf, a tail hidden under a wing). A line-coverage
      // number over that code would measure nothing anyone relies on.
      //
      // So this measures the part a unit test can actually hold: the rules
      // engine, the board geometry, and the card layout maths. Every
      // exclusion below is a whole category, not a hand-picked file, so the
      // number cannot be quietly improved by dropping an awkward module.
      //
      // For the honest whole-repository figure, run:
      //   npx vitest run --coverage --coverage.include='src/**/*.{js,jsx}'
      // It is about 10%, and docs/ci-and-badges.md explains the gap.
      include: ["src/**/*.js"],
      exclude: [
        // Drawn, not decided — verified by rendering. See above.
        "src/art/creatures/**",
        // The tests themselves, and their setup
        "**/*.test.js",
        "src/test/**",
      ],
    },
  },
});
