import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // The screenshots and the icon are imported from the app's folders (src/lib/assets.ts),
    // so there is one copy of each.
    fs: { allow: ["../docs/screenshots", "../src-tauri/icons"] },
  },
});
