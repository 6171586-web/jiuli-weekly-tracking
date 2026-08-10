import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/jiuli-weekly-tracking/",
  plugins: [react()],
  css: {
    postcss: { plugins: [] },
  },
  build: {
    outDir: "gh-pages-dist",
    emptyOutDir: true,
  },
});
