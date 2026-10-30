import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Use this project's tsconfig for every file. Otherwise Vite also looks up the app's tsconfig.json
  // (one folder up), which needs the app's generated .svelte-kit folder and fails in CI.
  tsconfig: "./tsconfig.json",
  server: {
    // The screenshots and the icon are imported from the app's folders (src/lib/assets.ts),
    // so there is one copy of each.
    fs: { allow: ["../docs/screenshots", "../src-tauri/icons"] },
  },
});
