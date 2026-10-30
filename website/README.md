# MilestoneSpace website

The app's landing page: a static site built with SvelteKit (every page prerendered), Tailwind CSS v4 and the
app's Aurora colors and Onest font. It's a separate project with its own `package.json`; the app's build
and checks don't include it.

```bash
cd website
npm install
npm run dev       # http://localhost:5173
npm run build     # static files in website/build
npm run preview   # serve the build
npm run check     # type-check
```

## Where things are

```
src/lib/site.ts          name, description, GitHub and download links, header navigation
src/lib/content.ts       the home page copy: "why" cards, features, tour stops
src/lib/assets.ts        screenshots (from ../docs/screenshots) and the app icon (from ../src-tauri/icons)
src/lib/components/      Header, Footer, Section, Screenshot, Icon (inline Lucide icons)
src/routes/+page.svelte  the home page
src/app.css              color tokens and shared classes (.btn, .card, .eyebrow, .section-title...)
```

- **Add a feature or a tour stop**: one more entry in `content.ts`. A tour stop names a screenshot in
  `docs/screenshots` (file name without the extension), so it's the same image as in the app's README.
- **Add a page**: create `src/routes/<name>/+page.svelte` (it gets the header and footer from
  `+layout.svelte`) and add it to `nav` in `site.ts` if it belongs in the header.
- **Add an icon**: copy it from [Lucide](https://lucide.dev) into `Icon.svelte`.

## Deploying

The site is on GitHub Pages at https://shehan17.github.io/milestone-space/. The workflow
`.github/workflows/website.yml` checks, builds and publishes it on every push to `main` that changes
`website/`, `docs/screenshots/` or `src-tauri/icons/` (app-only commits don't deploy). It can also be run by
hand from the Actions tab. One-time setup: Settings → Pages → Source: **GitHub Actions**.

The site is served from `/milestone-space`, so the workflow builds with `BASE_PATH=/milestone-space`.
To try a build like that locally: `BASE_PATH=/milestone-space npm run build`.
