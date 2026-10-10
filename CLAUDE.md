# MilestoneSpace

Personal desktop workspace for tracking projects (client, personal, study), their milestones,
tasks, and deadlines. Single user, local SQLite, Windows.

Stack: Tauri 2 + SvelteKit (Svelte 5 runes, TypeScript) + Tailwind CSS v4 + tauri-plugin-sql (SQLite).
SPA mode: `src/routes/+layout.ts` sets `ssr = false`, adapter-static with `fallback: "index.html"`.

## Commands

- `npm run check` — svelte-check (types + Svelte warnings). Must show 0 errors, 0 warnings.
- `npm run build` — frontend production build; catches Tailwind `@apply` / routing problems.
- `cargo check` in `src-tauri/` — Rust side (only needed after Rust/Cargo/tauri.conf changes).
- `npm run seed:dev` — adds sample clients/projects/tasks to `tracker-dev.db` only
  (`-- --reset` empties it first). Dates are relative to today. Data is in `scripts/seed-dev.mjs`.
- **Do not run `npm run tauri dev`** — the user runs the app themselves.

## Data: do not lose it

- The database is `%APPDATA%\com.shehan.milestonespace\tracker.db`. The folder comes from
  `identifier` in `src-tauri/tauri.conf.json`. **Never change the identifier** (or the
  `sqlite:tracker.db` name in `db.ts`): the app would open a new empty database.
- `tracker.db` holds the user's real day-to-day data (used by the installed build).
  Development (`npm run tauri dev`, `import.meta.env.DEV`) uses `tracker-dev.db` in the same
  folder; the sidebar shows a DEV badge. Test migrations and data scripts against
  `tracker-dev.db` (or a copy of `tracker.db`), never the real file.
- Settings are `settings.json` (`settings-dev.json` for dev) in the same folder, read/written by
  Rust (`src-tauri/src/settings.rs`). `src/lib/settings.svelte.ts` owns the fields and loads them in
  `+layout.ts` before any page renders; Rust only acts on `close_to_tray`, `start_minimized`,
  `quick_capture_keys`. The color theme alone stays in localStorage (`theme.ts`, applied in `app.html`).
- Backups (`src/lib/backup.svelte.ts`) use `VACUUM INTO` (the DB is in WAL mode, so copying the file
  can miss changes). Rust (`src-tauri/src/data.rs`) names files, prunes old `milestonespace-backup-*.db`
  files only, and swaps the file on restore after the frontend closes the pool and saves a
  `tracker.db.backup-before-restore-<time>` copy.
- Before editing the user's data directly, close the app and copy `tracker.db` to a
  `tracker.db.backup-<reason>` file next to it. Node 24's built-in `node:sqlite`
  (`DatabaseSync`) works for reading/writing it; there is no sqlite3 CLI.

## Database code

- All SQL lives in `src/lib/db.ts` (typed get/add/update/delete per table). Types in `src/lib/types.ts`.
- Schema changes go in `src/lib/migrations.ts`, tracked with `PRAGMA user_version`.
  `MIGRATIONS[i]` takes the DB to version `i + 1`. **Never edit a migration that has already
  run** — append a new one.
- Each migration runs as ONE `execute()` call via `migrationSql()` (foreign keys OFF, BEGIN,
  SQL, set user_version, COMMIT, foreign keys ON). This is required: the plugin uses a sqlx
  connection pool, so separate calls may hit different connections, and sqlx turns foreign
  keys ON for every connection. With them on, `DROP TABLE projects` cascade-deletes all
  milestones and tasks. sqlx runs multi-statement strings on one connection.
- Rebuilding a table (SQLite can't alter NOT NULL etc.): create `x_new`, copy rows keeping ids,
  drop `x`, rename `x_new` to `x`, recreate its indexes.
- Before shipping a risky migration, test it against a copy of the real `tracker.db` and
  compare row counts before/after.
- Conventions: dates are `"YYYY-MM-DD"` text (from `<input type="date">`; `""` saved as NULL);
  `created_at` is SQLite `datetime('now')`; `is_done` is 0/1 in SQL, mapped to boolean in
  `db.ts`. Tasks also have `status` (todo / in_progress / done, for the Kanban board); `is_done`
  must always equal `status = 'done'`, so write both together (only via `db.ts`).
  `projects.client_id` is only set when `type = 'client'`. Deleting a client cascades
  to its projects; deleting a milestone sets `tasks.milestone_id` to NULL.

## Frontend

- Routes: `/` Today (start page: tasks picked for today via `tasks.planned_for`), `/inbox`,
  `/dashboard`, `/projects`, `/projects/[id]`, `/tasks`, `/clients` (secondary feature), `/settings`.
  `/quick` is the quick capture window: `+layout.svelte` renders it bare (no sidebar/shortcuts).
- Reusable components in `src/lib/components/`. Forms (`ProjectForm`, `TaskForm`, ...) take a
  `$bindable` `values` object; the page owns the draft `$state` and opens it in `Modal`
  (which wraps a `<form>` and calls `onsubmit`). Pages load data in `onMount` and reload
  after each change.
- Friendly deadlines come from `src/lib/dates.ts` via `DeadlineLabel`: overdue red,
  within 3 days orange, otherwise gray. Parse dates as local, not with `new Date("YYYY-MM-DD")` (UTC).
- Keyboard shortcuts live in `src/lib/shortcuts.svelte.ts`: pages register keys with
  `useShortcuts({ n: openNew })`, task rows handle their own keys in `TaskRow`. Add every new
  shortcut to `shortcutGroups()` (the `?` dialog and Settings list it). No delete shortcut: deletes have no confirm.
- Settings that pages must respect: `formatDate`/`formatTime` follow the date/time format, new drafts
  use `emptyProject()` / `emptyTask()` (default type / priority), and `isArchived(project)` hides
  completed projects from lists when "Move to Archive" is on.
- The main window runs reminders (`notifications.ts`, once a minute) and automatic backups
  (every 15 min) from `+layout.svelte`; it keeps running while hidden in the tray.
- Uncaught promise rejections show as an error popup from `+layout.svelte`, so pages don't
  need their own try/catch.

## Desktop shell (`src-tauri/src/lib.rs`)

- Two windows share one capability (`capabilities/default.json`): `main` (starts hidden, shown in
  setup unless launched with `--hidden` by autostart) and `quick` (created on the first quick
  capture, then only hidden/shown).
- Closing `main` hides it to the tray (Quit is in the tray menu), unless "Close to tray" is off.
- Global shortcut for quick capture: Ctrl+Shift+Space, but **Ctrl+Alt+Shift+Space in dev** so the
  dev build can run next to the installed one. Changeable in Settings (`set_quick_capture_keys`).
  Keep `DEFAULT_QUICK_CAPTURE_KEYS` in `lib.rs` and `settings.svelte.ts` in sync.
- `main` has `dragDropEnabled: false` (tauri.conf.json): otherwise WebView2 swallows the HTML5
  drag events the Kanban board (`TaskBoard.svelte`) uses.
- Release-only (`cfg(not(debug_assertions))`): single-instance (dev shares the identifier) and
  turning autostart on at first run (marker file `autostart-configured` in the app data folder).
- Windows talk through the `inbox-changed` event (`src/lib/inbox.svelte.ts`).
- `open_in_vscode` command runs `code.cmd <folder>`; "Open folder" uses the opener plugin (`src/lib/system.ts`).

## Style

- Compact (text-sm), Linear/Notion feel. Write components with `zinc-*` neutrals and `violet-*`
  accent only: 4 color themes (Settings page, `src/lib/theme.ts`) redefine those palette variables in
  `app.css` (light themes reverse the zinc scale). Other hues (indigo, blue...) won't follow the theme.
- No UI libraries, no heavy animations. Icons are inline SVGs in `Icon.svelte`.
- Shared classes (`.btn`, `.btn-primary`, `.input`, `.card`, `.icon-btn`, `.checkbox`) are in
  `src/app.css`; reuse them instead of repeating long class lists.
- Every project has a color; show it with `ProjectDot` next to project names.

## Notes

- The Rust crate is still named `client-tracker` (`client_tracker_lib`) from the original
  scaffold. That's harmless; renaming it is optional and unrelated to the data folder.
- Windows: the Bash tool is Git Bash, PowerShell is also available.
