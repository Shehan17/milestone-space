/**
 * Database migrations, tracked with PRAGMA user_version.
 *
 * MIGRATIONS[0] brings the database to version 1, MIGRATIONS[1] to version 2, and so on.
 * Each one runs once. Never edit a migration that has already run — add a new one instead.
 *
 * Each migration is sent as ONE execute() call (see migrationSql), so it runs on a single
 * connection, inside a transaction, with foreign keys switched off. This matters for table
 * rebuilds: with foreign keys on, "DROP TABLE projects" would cascade-delete every
 * milestone and task.
 */
export const MIGRATIONS: string[] = [
  // v1: the original client-tracker schema. Uses IF NOT EXISTS because databases
  // created before migrations existed already have these tables.
  `
  CREATE TABLE IF NOT EXISTS clients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed')),
    deadline    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS milestones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_date    TEXT,
    is_done     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Deleting a milestone keeps its tasks and just unlinks them (SET NULL).
  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date     TEXT,
    is_done      INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
  CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);
  `,

  // v2: MilestoneSpace. Projects get a type and a color, and client_id becomes optional.
  // SQLite can't drop NOT NULL in place, so the table is rebuilt (ids are kept).
  // Existing projects all have a client, so they become type 'client'.
  `
  CREATE TABLE projects_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'personal' CHECK (type IN ('client', 'personal', 'study')),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed')),
    deadline    TEXT,
    color       TEXT NOT NULL DEFAULT '#8b5cf6',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT INTO projects_new (id, client_id, type, name, description, status, deadline, color, created_at)
  SELECT id, client_id,
    CASE WHEN client_id IS NULL THEN 'personal' ELSE 'client' END,
    name, description, status, deadline,
    -- Spread the preset colors over existing projects so they're easy to tell apart.
    CASE id % 8
      WHEN 1 THEN '#8b5cf6' WHEN 2 THEN '#3b82f6' WHEN 3 THEN '#10b981' WHEN 4 THEN '#f59e0b'
      WHEN 5 THEN '#f43f5e' WHEN 6 THEN '#06b6d4' WHEN 7 THEN '#f97316' ELSE '#ec4899'
    END,
    created_at
  FROM projects;
  DROP TABLE projects;
  ALTER TABLE projects_new RENAME TO projects;
  CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
  CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
  `,

  // v3: per-project info — one markdown note, a list of links, and custom label/value details.
  // Only new tables, so existing data is untouched.
  `
  CREATE TABLE IF NOT EXISTS project_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    content    TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS project_links (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    url        TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'other'
      CHECK (type IN ('github', 'figma', 'drive', 'store', 'website', 'docs', 'other')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS project_details (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,
    value      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_project_links_project ON project_links(project_id);
  CREATE INDEX IF NOT EXISTS idx_project_details_project ON project_details(project_id);
  `,

  // v4: pinned projects for quick access on the dashboard. pinned_at is NULL when not pinned;
  // pinned projects are listed in the order they were pinned. A new nullable column keeps all rows.
  `
  ALTER TABLE projects ADD COLUMN pinned_at TEXT;
  `,
];

/** The full SQL for one migration: one transaction, foreign keys off, bumps user_version. */
export function migrationSql(index: number): string {
  return `PRAGMA foreign_keys = OFF;
BEGIN;
${MIGRATIONS[index]}
PRAGMA user_version = ${index + 1};
COMMIT;
PRAGMA foreign_keys = ON;`;
}
