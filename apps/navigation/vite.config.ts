import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "/",

  resolve: {
    alias: {
      "@zhaolong/canvas-webgis": fileURLToPath(
        new URL("../../packages/webgis/src/index.ts", import.meta.url)
      )
    }
  },

  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true
      }
    }
  }
});
