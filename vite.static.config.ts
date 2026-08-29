import { createHash } from "node:crypto";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const tomTomKey = env.TOMTOM_API_KEY?.trim() ?? "";
  const keyFlag = createHash("sha1").update(tomTomKey).digest("hex").slice(0, 6);
  return {
    base: "/map-engine/",
    plugins: [react()],
    define: {
      __TOMTOM_API_KEY__: JSON.stringify(tomTomKey),
      __STATIC_BUILD__: "true",
    },
    build: {
      outDir: "dist-static",
      emptyOutDir: true,
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, "index.html") },
        output: {
          entryFileNames: `assets/[name]-${keyFlag}-[hash].js`,
          assetFileNames: "assets/[name]-[hash].[ext]",
          chunkFileNames: `assets/[name]-${keyFlag}-[hash].js`,
        },
      },
    },
  };
});