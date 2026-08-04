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
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
