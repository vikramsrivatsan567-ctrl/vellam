import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server forwards /api and /uploads to FastAPI on port 8000,
// so one URL (and one ngrok tunnel) serves the whole app.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // reachable from other devices on your Wi-Fi
    port: 5173,
    allowedHosts: true,  // lets ngrok / cloudflare tunnel URLs through
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/uploads": "http://127.0.0.1:8000",
    },
  },
});
