import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // dev: проксируем /v1/* на api-gateway (port-forward на 8080).
      // ws: true убран — Watch/WebSocket не используются с 1.0.
      "/v1": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/healthz": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/readyz": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
