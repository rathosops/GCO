import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    // só vale no `vite dev` (não afeta seu container Nginx)
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      // IMPORTANTÍSSIMO: sourcemap externo (.map) para o DevTools mapear TS/TSX
      // (Vite documenta build.sourcemap como true | "inline" | "hidden") :contentReference[oaicite:1]{index=1}
      sourcemap: true,

      // opcional: deixa mais previsível
      minify: isProd ? "esbuild" : false,
    },
  };
});
