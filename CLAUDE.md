# MilestoneSpace

Personal desktop workspace for tracking projects (client, personal, study), their milestones,
tasks, and deadlines. Single user, local SQLite, Windows.

Stack: Tauri 2 + SvelteKit (Svelte 5 runes, TypeScript) + Tailwind CSS v4 + tauri-plugin-sql (SQLite).
SPA mode: `src/routes/+layout.ts` sets `ssr = false`, adapter-static with `fallback: "index.html"`.

## Commands

- `npm run check` — svelte-check (types + Svelte warnings). Must show 0 errors, 0 warnings.
- `npm run build` — frontend production build; catches Tailwind `@apply` / routing problems.
- `cargo check` in `src-tauri/` — Rust side (only needed after Rust/Cargo/tauri.conf changes).
- **Do not run `npm run tauri dev`** — the user runs the app themselves.

## Data: do not lose it

- The database is `%APPDATA%\com.shehan.milestonespace\tracker.db`. The folder comes from
  `identifier` in `src-tauri/tauri.conf.json`. **Never change the identifier** (or the
  `sqlite:tracker.db` name in `db.ts`): the app would open a new empty database.
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
  `db.ts`. `projects.client_id` is only set when `type = 'client'`. Deleting a client cascades
  to its projects; deleting a milestone sets `tasks.milestone_id` to NULL.

## Frontend

- Routes: `/` dashboard, `/projects`, `/projects/[id]`, `/tasks`, `/clients` (secondary feature).
- Reusable components in `src/lib/components/`. Forms (`ProjectForm`, `TaskForm`, ...) take a
  `$bindable` `values` object; the page owns the draft `$state` and opens it in `Modal`
  (which wraps a `<form>` and calls `onsubmit`). Pages load data in `onMount` and reload
  after each change.
- Friendly deadlines come from `src/lib/dates.ts` via `DeadlineLabel`: overdue red,
  within 3 days orange, otherwise gray. Parse dates as local, not with `new Date("YYYY-MM-DD")` (UTC).
- Uncaught promise rejections show as an error popup from `+layout.svelte`, so pages don't
  need their own try/catch.

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
