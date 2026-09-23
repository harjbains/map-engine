import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: "/map-engine/",
  plugins: [react()],
  // Local preview only: keep the V2 OpenFreeMap provider, but route its
  // requests through Vite because the in-app browser blocks that domain.
  optimizeDeps: {
    entries: ["index.html"],
  },
  server: {
    proxy: {
      "/__v2_tiles": {
        target: "https://tiles.openfreemap.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__v2_tiles/, ""),
      },
    },
  },
  define: {
    __TOMTOM_API_KEY__: JSON.stringify(loadEnv(mode, process.cwd(), "").TOMTOM_API_KEY ?? ""),
    __STATIC_BUILD__: "true",
  },
}));
