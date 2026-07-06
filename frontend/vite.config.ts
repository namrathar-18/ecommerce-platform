import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // proxy API calls to the backend so the browser sees a single origin
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
