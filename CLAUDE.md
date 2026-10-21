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
  `quick_capture_keys`, `show_widget`, `widget_on_top`. The last three change only through their own
  commands (`save_settings` keeps Rust's values), and Rust emits `settings-changed` when the tray changes them. The color theme alone stays in localStorage (`theme.ts`, applied in `app.html`).
- Backups (`src/lib/backup.svelte.ts`) use `VACUUM INTO` (the DB is in WAL mode, so copying the file
  can miss changes). Rust (`src-tauri/src/data.rs`) names files, prunes old `milestonespace-backup-*.db`
  files only, and swaps the file on restore after the frontend closes the pool and saves a
  `tracker.db.backup-before-restore-<time>` copy.
- Before editing the user's data directly, close the app and copy `tracker.db` to a
  `tracker.db.backup-<reason>` file next to it. Node 24's built-in `node:sqlite`
  (`DatabaseSync`) works for reading/writing it; there is no sqlite3 CLI.

## Database code

- All SQL lives in `src/lib/db.ts` (typed get/add/update/delete per table). Types in `src/lib/types.ts`.
- Schema changes go in `src/lib/migrations.ts`, tracked with `PRAGMA user_version`. Only the `main` window
  migrates; the other windows (quick capture, the widget) wait in `db.ts` until it's done, so a migration never
  runs twice when they open at the same time.
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
  `projects.client_id` is only set when `type = 'client'`. `tasks.project_id` is NULL for a **Misc task**
  (small everyday jobs like "update Windows", migration v10). A Misc task is just a title, priority and
  done state: `taskValues()` in `db.ts` drops its milestone and due date and turns `in_progress` into
  `todo`, and `TaskForm` hides those fields. It lives on the Misc page only (not in All tasks), can be
  planned for Today, and shows as `MISC_LABEL` / `MISC_COLOR` (`types.ts`) where a project name would;
  `inShownProject()` keeps it in lists that leave out archived/completed projects. Deleting a client cascades
  to its projects; deleting a milestone sets `tasks.milestone_id` to NULL.
  `tasks.stashed_at` (v11) parks a task in its project's **Stash** (a section under the Tasks tab): `getTasks()`
  and the project counts leave stashed tasks out, so they vanish from every list, Today, reminders and the widget;
  `getStashedTasks()` lists them. `stashTask()` also clears `planned_for` (its Undo puts it back).

## Frontend

- Routes: `/` Today (start page: tasks picked for today via `tasks.planned_for`, plus Needs attention,
  stats, pinned projects, Coming up and the Getting started checklist), `/inbox`, `/projects`,
  `/projects/[id]`, `/tasks` (All tasks, grouped by project), `/misc` (Misc tasks). Under "More" in the sidebar: `/clients`
  (secondary feature), `/settings`. There is no Dashboard any more (Today replaced it); a saved
  `start_page` that isn't in `START_PAGES` falls back to Today.
  `/quick` is the quick capture window: `+layout.svelte` renders it bare (no sidebar/shortcuts).
  It works like the New dialog: in the text field ←/→ pick what to add (`kindStep()`) and ↑/↓ the task's project
  (`projectStep()`; Misc → each project for Today, projects only for Project task). Kinds, labels and the cycling
  are shared in `quickadd.svelte.ts`. Quick capture cycles Inbox → Today → Project task → Misc (no New project);
  the New dialog Today → Project task → Inbox → Misc → New project. For a task quick capture tells the main
  window with `notifyDataChangedEverywhere()`.
  `/widget` is the Today widget (also bare): today's plan in a small window on the desktop. You can check tasks off,
  add a task for today (↑/↓ project) and click a task to open it in the main window (`openInMain()` in `system.ts` →
  `open_main` → `navigate` event, which `+layout.svelte` turns into `goto`). It reloads on `db-changed`: `db.ts` wraps
  `execute` so every write from any window sends it (debounced). The pages in the main window keep listening to
  `data-changed` (`onDataChanged`) only. Today's `/?plan=1` opens the task picker.
- Reusable components in `src/lib/components/`. Forms (`ProjectForm`, `TaskForm`, ...) take a
  `$bindable` `values` object; the page owns the draft `$state` and opens it in `Modal`
  (which wraps a `<form>` and calls `onsubmit`). Pages load data in `onMount` and reload
  after each change; until the first load they show `Skeleton`, never the empty state.
- Validation: wrap inputs in `Field` with an `error` (string or null, worked out from the values).
  `Modal` won't submit while a field has one, shows the messages after the first Save, and
  focuses the first bad field. Mark the field to focus first with `data-autofocus`. Edit dialogs
  pass `ondelete` for the Delete button in the footer. Date fields use `DateInput` (quick choices).
- The sidebar's New button (and N on pages without their own N) opens `QuickAdd.svelte` (state in `src/lib/quickadd.svelte.ts`): a task
  for today (in a project or Misc), a task for a project, an idea for the Inbox, a Misc task, or a project. It lives in the layout, so after adding it calls
  `notifyDataChanged()`; pages that list tasks or projects reload with `onDataChanged(load)`.
- Feedback: `toast.success("Task added")` etc. (`src/lib/toast.svelte.ts`, shown by `Toaster` in
  `+layout.svelte`) after every action whose result isn't visible on the page.
- Deletes: single rows (task, inbox item, link, detail, template) delete at once and offer Undo:
  their `db.ts` delete returns an `undo` function (re-inserts the exact row) for `toast.undo(...)`,
  which Ctrl+Z also runs. Deletes that cascade (project, client, milestone) keep a confirm dialog.
- Empty lists use `EmptyState` with a message, a hint and the button that fixes it.
- Today's Overdue / This week / Coming up come from `dueItems()` in `src/lib/due.ts`.
- Friendly deadlines come from `src/lib/dates.ts` via `DeadlineLabel`: overdue red,
  within 3 days orange, otherwise gray; relative within a week, the date after that; nothing when
  there is no date. Parse dates as local, not with `new Date("YYYY-MM-DD")` (UTC).
- Keyboard shortcuts live in `src/lib/shortcuts.svelte.ts`: pages register keys with
  `useShortcuts({ n: openNew })`, task rows handle their own keys in `TaskRow`. Add every new
  shortcut to `shortcutGroups()` (the `?` dialog and Settings list it). Delete on a focused task
  deletes it with Undo.
- The project page keeps its tab in the URL (`/projects/5?tab=tasks`); link straight to a tab. Settings
  likewise shows one section at a time (`/settings?section=data`, `SECTIONS` in its page), each made of
  `SettingsCard`s of `SettingRow`s.
- Settings that pages must respect: `formatDate`/`formatTime` follow the date/time format, new drafts
  use `emptyProject()` / `emptyTask()` (default type / priority), `isArchived(project)` hides
  completed projects from lists when "Move to Archive" is on, and the Today greeting uses `display_name`.
- The main window runs reminders (`notifications.ts`, once a minute) and automatic backups
  (every 15 min) from `+layout.svelte`; it keeps running while hidden in the tray.
- Uncaught promise rejections show as an error toast from `+layout.svelte`, so pages don't
  need their own try/catch.
- `+layout.svelte` blocks WebView2's right-click menu in every window except in text fields (Cut / Copy /
  Paste stay). A custom right-click menu has to handle `contextmenu` itself.

## Desktop shell (`src-tauri/src/lib.rs`)

- Three windows share one capability (`capabilities/default.json`): `main` (starts hidden, shown in
  setup unless launched with `--hidden` by autostart), `quick` (created on the first quick
  capture, then only hidden/shown) and `widget` (the Today widget, shown at startup while `show_widget` is on,
  also with `--hidden`; toggled from the tray, Settings and the Today page with `set_widget_shown`). The widget
  never takes focus, has no taskbar entry, and is `always_on_bottom` (on the desktop) unless `widget_on_top`.
  `widget_win.rs` (Windows only) keeps it on screen through Win+D: Win32 event hooks undo its minimize and raise it
  while the desktop is in front (through Tauri's on-top/bottom setters, since tao forces a bottom window back down).
  `tauri-plugin-window-state` keeps only its position and size (`window-state.json` / `window-state-dev.json`
  in the app config folder); the widget calls `save_widget_state` after a move or resize.
- Closing `main` hides it to the tray (Quit is in the tray menu), unless "Close to tray" is off.
- Global shortcut for quick capture: Ctrl+Shift+Space, but **Ctrl+Alt+Shift+Space in dev** so the
  dev build can run next to the installed one. Changeable in Settings (`set_quick_capture_keys`).
  Keep `DEFAULT_QUICK_CAPTURE_KEYS` in `lib.rs` and `settings.svelte.ts` in sync.
- `main` has `dragDropEnabled: false` (tauri.conf.json): otherwise WebView2 swallows the HTML5
  drag events the Kanban board (`TaskBoard.svelte`) uses.
- `main` has `decorations: false`: `TitleBar.svelte` (in `+layout.svelte`) draws the title bar with the date and time in the middle and
  minimize / maximize / close (`data-tauri-drag-region` drags; the window permissions are in the
  capability). Its close goes through `CloseRequested`, so "Close to tray" still applies.
- Release-only (`cfg(not(debug_assertions))`): single-instance (dev shares the identifier) and
  turning autostart on at first run (marker file `autostart-configured` in the app data folder).
- Windows talk through the `inbox-changed` event (`src/lib/inbox.svelte.ts`).
- `open_in_vscode` command runs `code.cmd <folder>`; "Open folder" uses the opener plugin (`src/lib/system.ts`).

## Style

- The "Aurora" redesign (claude.ai/design project "MilestoneSpace Redesign", file "Redesign v2"): roomy and
  friendly, Onest font (bundled via `@fontsource-variable/onest`, imported in `+layout.svelte`; no web font
  to load), 15px body text, large page titles. The window is a dark chrome with a title bar, and the sidebar
  and the page sit on it as two bordered panels. The default theme (Aurora) is neutral graphite with a blue
  accent (#2870e6: the design's #2f7bf5, darkened so white button text passes AA); red/orange only mean
  overdue, due soon, high priority or delete.
- Task rows: title and meta, priority, due date, and the round done toggle (`.check-round`) at the end, or at
  the start with `done_toggle_side: "left"` (Settings → Appearance; then `.row-actions-end`; the widget follows it too). Sun (Today; accent icon
  when planned), edit and delete float over the end of the row on hover or focus (`.row-actions` in app.css), so the details keep that space otherwise. Done tasks are dimmed to 50%
  until the row is hovered or focused.
- Type scale (app.css): `text-2xs` 12px badges/eyebrows, `text-xs` 13px meta, `text-ui` 14px buttons and
  subtitles, `text-sm` 15px body, `text-base` 16px section titles, `text-title` 28px page titles.
  Radii: `rounded-control` 6px, `rounded-item` 8px, `rounded-card` 10px, `rounded-dialog` 12px.
- Colors are semantic tokens defined per theme in `app.css` (see the comment at its top): surfaces
  `chrome canvas sidebar surface raised field hover selected` (chrome: the window frame and wells), lines `line line-strong`, text
  `strong fg muted faint`, `accent accent-hover accent-text accent-text-strong on-accent` (text on accent
  buttons),
  `danger danger-solid warning success`. Use only these (`bg-surface`, `text-faint`, `border-line`...),
  never Tailwind palette colors (`zinc-*`, `red-*`...), which don't follow the 5 themes or the accent
  picker (`theme.ts`). Every text token passes WCAG AA on every surface; keep it that way.
- No UI libraries, no heavy animations: transitions are 150 ms (`ms()` in `src/lib/motion.ts`, 0 with
  reduced motion). Icons are inline Lucide SVGs in `Icon.svelte`; add new ones from Lucide.
- Shared classes in `src/app.css`: `.page` (+ `.page-narrow`; page width and padding, header and content),
  `.btn` + `.btn-primary/-secondary/-soft/-ghost/-danger/-danger-ghost/-sm/-lg` (`-lg` = a page header's
  main action), `.icon-btn(-danger)`, `.input(-sm)`, `.card`, `.card-header`, `.card-title`, `.count`,
  `.list-row`, `.eyebrow`, `.kbd`, `.badge`, `.chip`, `.pill(-on)` (filters, via `FilterPills`),
  `.checkbox`, `.check-round` (task/milestone done toggle), `.switch`, `.link`. Reuse them instead of
  repeating long class lists.
  The global `:focus-visible` ring is the accent; don't remove outlines without a replacement.
- Narrow windows (< 960 px) collapse the sidebar to icons (`sidebar.svelte.ts`, also `[`);
  use `lg:`/`xl:` to hide secondary columns and button labels when space is short.
- Every project has a color; show it with `ProjectDot` (small rounded square) next to project names, or
  `ProjectAvatar` (first letter on a tint) on cards and headers. `Tabs` is a segmented control
  (`variant="underline"` for the project page tabs); `PageHeader` takes `eyebrow`, `back` and `narrow`.

## Notes

- The Rust crate is still named `client-tracker` (`client_tracker_lib`) from the original
  scaffold. That's harmless; renaming it is optional and unrelated to the data folder.
- Windows: the Bash tool is Git Bash, PowerShell is also available.
