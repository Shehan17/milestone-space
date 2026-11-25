# Contributing to MilestoneSpace

Thanks for helping out! This page covers how to set up, how changes get into `main`, and the few rules
that protect people's data. [CLAUDE.md](CLAUDE.md) has the full details on how the code is organised
(database, components, styling, the desktop shell); read the parts that touch what you're changing.

## Setup

Prerequisites: [Node.js](https://nodejs.org/) 24+, [Rust](https://www.rust-lang.org/tools/install) and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for Windows.

```bash
npm install
npm run seed:dev      # sample projects and tasks in the dev database (-- --reset empties it first)
npm run tauri dev     # run the app
```

The dev build uses its own database (`tracker-dev.db`), settings and quick capture shortcut
(**Ctrl+Alt+Shift+Space**), and shows a DEV badge in the sidebar, so it can run next to an installed copy
without touching its data.

## How changes get into main

`main` is protected: nobody pushes to it directly, every change goes through a pull request.

1. Start from an up-to-date `main` and make a branch named after the change:
   ```bash
   git switch main && git pull
   git switch -c fix-widget-position
   ```
2. Commit, push the branch and open a pull request into `main`:
   ```bash
   git push -u origin fix-widget-position
   gh pr create --base main     # or open it on GitHub
   ```
3. The **Checks** workflow runs on the pull request (App, Rust and Website). Fix anything it reports.
4. Someone else reviews and approves it, then it's merged and the branch is deleted.

Keep a pull request to one change. Say in the description what it does and how you tested it, with a
screenshot for anything visible.

Before pushing, run the same checks yourself:

```bash
npm run check                    # must show 0 errors and 0 warnings
npm run build
cd src-tauri && cargo check      # only after changing Rust, Cargo.toml or tauri.conf.json
```

For the website (`website/`, a separate project), run `npm install`, `npm run check` and `npm run build`
inside that folder. Merging a website change to `main` publishes it to GitHub Pages straight away.

## Rules that protect people's data

The app keeps everything in a local SQLite file, so a mistake here can lose someone's real data.

- **Never change the app `identifier`** in `src-tauri/tauri.conf.json`, or the `sqlite:tracker.db` name in
  `src/lib/db.ts`. The app would open a new, empty database.
- **Never edit a migration that has already shipped.** Schema changes go in a new entry at the end of
  `MIGRATIONS` in `src/lib/migrations.ts`. See "Database code" in CLAUDE.md for how migrations must be
  written (one `execute()` call, foreign keys off while rebuilding a table).
- **Test against the dev database** (`tracker-dev.db`, used by `npm run tauri dev`), never the real
  `tracker.db`. Before running a risky migration on real data, test it on a copy and compare row counts.
- All SQL lives in `src/lib/db.ts`; pages call its functions instead of writing queries.

## Code style

- Svelte 5 runes and TypeScript. Match the code around you.
- Use the theme's color tokens (`bg-surface`, `text-muted`, `border-line`...), never Tailwind palette
  colors like `zinc-*` or `red-*`, and reuse the shared classes in `src/app.css` (`.btn`, `.card`,
  `.input`...).
- No UI libraries. Icons are Lucide SVGs in `src/lib/components/Icon.svelte`.
- A new keyboard shortcut also goes into `shortcutGroups()` in `src/lib/shortcuts.svelte.ts`.

## Releases

Releases are made by the maintainer: bump the version in `package.json`, `src-tauri/tauri.conf.json` and
`src-tauri/Cargo.toml`, run `npm run tauri build` and upload the setup `.exe` from
`src-tauri/target/release/bundle/nsis/` to a GitHub release. The website's download buttons pick up the
newest release by themselves.
