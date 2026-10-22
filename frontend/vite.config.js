import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the UI runs on :5173 and proxies /api to the FastAPI backend on :8000,
// so the same relative URLs work in dev and when FastAPI serves the built UI.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
