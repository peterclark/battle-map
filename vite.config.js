import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  // .glb is a model, not a module
  assetsInclude: ["**/*.glb"],
  build: {
    rollupOptions: {
      input: {
        // The table itself
        main: resolve(import.meta.dirname, "index.html"),
        // A spike page comparing the two ways of animating a unit. It is a
        // separate entry so Three.js never lands in the app's own bundle.
        trexLab: resolve(import.meta.dirname, "demo/trex-lab.html"),
        // Draw-call benchmark for the animated formations
        bench: resolve(import.meta.dirname, "demo/bench.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
