import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleString()),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5200,
  },
  build: {
    outDir: "docs",
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "recharts";
          }
        },
      },
    },
  },
});
