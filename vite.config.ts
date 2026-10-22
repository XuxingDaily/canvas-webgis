import { defineConfig } from "vite";

export default defineConfig({
  base: "/",

  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: "../nav-map-sys/nav-server/src/main/resources/static",
    emptyOutDir: true
  }
});
