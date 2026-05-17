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
      // dev: проксируем domain-prefixed paths на api-gateway (port-forward на 8080).
      // URL-ы verbatim из proto google.api.http annotations.
      "/organization-manager": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/resource-manager": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/vpc": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/compute": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/iam": {
        target: process.env.KACHO_API_BASE || "http://localhost:8080",
        changeOrigin: true,
      },
      "/operations": {
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
