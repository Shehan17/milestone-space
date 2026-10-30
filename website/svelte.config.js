// A fully prerendered static site: every page is built to HTML, no server needed.
// Set BASE_PATH when it's served from a subfolder (GitHub Pages: BASE_PATH=/milestone-space).
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    paths: {
      base: /** @type {"" | `/${string}`} */ (process.env.BASE_PATH ?? ""),
    },
  },
};

export default config;
