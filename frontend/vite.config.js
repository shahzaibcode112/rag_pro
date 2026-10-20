import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, requests to /api go to the FastAPI backend (so cookies work, no CORS needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.js",
  },
});
