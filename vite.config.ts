import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The end-to-end tests set MNEMOS_STATE_DIR so they get their own local D1 and R2,
// apart from your development data in .wrangler/state.
const stateDir = process.env.MNEMOS_STATE_DIR;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({ persistState: stateDir ? { path: stateDir } : true }),
  ],
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
