import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En dev, Vite sirve src/ y hace proxy de /api hacia Fastify (server/, puerto
// 3939 por defecto). En producción, `vite build` genera dist-client/ y Fastify
// lo sirve como estático (ver server/index.ts).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-client",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3939",
        changeOrigin: true,
      },
    },
  },
});
