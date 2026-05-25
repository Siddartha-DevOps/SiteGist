import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from '@tailwindcss/vite';
import path from "path";

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      remix({
        future: {
          v3_fetcherPersist: true,
          v3_throwAbortReason: true,
        },
      }),
      tsconfigPaths(),
      tailwindcss(),
    ],
    optimizeDeps: {
      exclude: ["pdf-parse", "pdf-parse/lib/pdf-parse.js"],
    },
    ssr: {
      external: ["pdf-parse", "pdf-parse/lib/pdf-parse.js"],
      noExternal: [
        "react-markdown",
        "remark-gfm",
        /^@upstash\//,
      ],
    },
    resolve: {
      alias: {
        "~": path.resolve("./app"),
      },
      dedupe: ["react", "react-dom", "@remix-run/react", "@remix-run/router"],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    }
  };
});
