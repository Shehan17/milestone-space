import Database from "@tauri-apps/plugin-sql";
import type {
  Client,
  ClientInput,
  Milestone,
  MilestoneInput,
  Project,
  ProjectDetail,
  ProjectDetailInput,
  ProjectInput,
  ProjectLink,
  ProjectLinkInput,
  ProjectNote,
  Task,
  TaskInput,
} from "./types";
import { MIGRATIONS, migrationSql } from "./migrations";

let dbPromise: Promise<Database> | null = null;

async function open(): Promise<Database> {
  // Foreign keys are enabled on every connection by default (sqlx).
  const db = await Database.load("sqlite:tracker.db");
  await migrate(db);
  return db;
}

/** Runs the migrations this database hasn't had yet (see migrations.ts). */
async function migrate(db: Database) {
  const [{ user_version: version }] = await db.select<{ user_version: number }[]>("PRAGMA user_version");

  if (version < 1) {
    // The first test page created a "tasks" table with only (id, title).
    // CREATE TABLE IF NOT EXISTS would keep that old shape, so drop it.
    const cols = await db.select<{ name: string }[]>("PRAGMA table_info(tasks)");
    if (cols.length > 0 && !cols.some((c) => c.name === "project_id")) {
      await db.execute("DROP TABLE tasks");
    }
  }

  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.execute(migrationSql(i));
  }
}

function getDb(): Promise<Database> {
  dbPromise ??= open().catch((e) => {
    dbPromise = null; // allow a retry on the next call
    throw e;
  });
  return dbPromise;
}

/** Opens the database and runs any pending migrations. Called once on app start. */
export const initDb = getDb;

// SQLite has no boolean type, so is_done comes back as 0 / 1.
type Raw<T> = Omit<T, "is_done"> & { is_done: number };

function toBool<T extends { is_done: boolean }>(rows: Raw<T>[]): T[] {
  return rows.map((r) => ({ ...r, is_done: r.is_done === 1 }) as unknown as T);
}

/** Empty date inputs give "" — store those as NULL. */
const dateOrNull = (value: string | null) => (value ? value : null);

// ---------- Clients ----------

export async function getClients(): Promise<Client[]> {
  const db = await getDb();
  return db.select<Client[]>(
    `SELECT c.*, COUNT(p.id) AS project_count
     FROM clients c
     LEFT JOIN projects p ON p.client_id = c.id
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE`
  );
}

export async function addClient(input: ClientInput): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO clients (name, email, notes) VALUES ($1, $2, $3)", [
    input.name.trim(),
    input.email.trim(),
    input.notes.trim(),
  ]);
}

export async function updateClient(id: number, input: ClientInput): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE clients SET name = $1, email = $2, notes = $3 WHERE id = $4", [
    input.name.trim(),
    input.email.trim(),
    input.notes.trim(),
    id,
  ]);
}

export async function deleteClient(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM clients WHERE id = $1", [id]);
}

// ---------- Projects ----------

const PROJECT_SELECT = `
  SELECT p.*, c.name AS client_name,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.is_done = 0) AS open_task_count
  FROM projects p
  LEFT JOIN clients c ON c.id = p.client_id`;

export async function getProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>(
    `${PROJECT_SELECT} ORDER BY p.deadline IS NULL, p.deadline, p.name COLLATE NOCASE`
  );
}

export async function getProject(id: number): Promise<Project | null> {
  const db = await getDb();
  const rows = await db.select<Project[]>(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Values in column order: type, client_id, name, description, status, deadline, color. */
function projectValues(input: ProjectInput) {
  return [
    input.type,
    input.type === "client" ? input.client_id : null, // only client projects have a client
    input.name.trim(),
    input.description.trim(),
    input.status,
    dateOrNull(input.deadline),
    input.color,
  ];
}

export async function addProject(input: ProjectInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO projects (type, client_id, name, description, status, deadline, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    projectValues(input)
  );
}

export async function updateProject(id: number, input: ProjectInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE projects SET type = $1, client_id = $2, name = $3, description = $4, status = $5,
       deadline = $6, color = $7
     WHERE id = $8`,
    [...projectValues(input), id]
  );
}

/** Pins a project to the dashboard (pinned_at = now) or unpins it (NULL). */
export async function setProjectPinned(id: number, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    pinned
      ? "UPDATE projects SET pinned_at = datetime('now') WHERE id = $1"
      : "UPDATE projects SET pinned_at = NULL WHERE id = $1",
    [id]
  );
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
}

// ---------- Milestones ----------

const MILESTONE_SELECT = `
  SELECT m.*, p.name AS project_name, p.color AS project_color
  FROM milestones m
  JOIN projects p ON p.id = m.project_id`;

/** All milestones, or only one project's when projectId is given. */
export async function getMilestones(projectId?: number): Promise<Milestone[]> {
  const db = await getDb();
  const where = projectId === undefined ? "" : "WHERE m.project_id = $1";
  const rows = await db.select<Raw<Milestone>[]>(
    `${MILESTONE_SELECT} ${where} ORDER BY m.due_date IS NULL, m.due_date, m.id`,
    projectId === undefined ? [] : [projectId]
  );
  return toBool(rows);
}

export async function addMilestone(input: MilestoneInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO milestones (project_id, title, description, due_date) VALUES ($1, $2, $3, $4)",
    [input.project_id, input.title.trim(), input.description.trim(), dateOrNull(input.due_date)]
  );
}

export async function updateMilestone(id: number, input: MilestoneInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE milestones SET project_id = $1, title = $2, description = $3, due_date = $4 WHERE id = $5",
    [input.project_id, input.title.trim(), input.description.trim(), dateOrNull(input.due_date), id]
  );
}

export async function setMilestoneDone(id: number, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE milestones SET is_done = $1 WHERE id = $2", [done ? 1 : 0, id]);
}

export async function deleteMilestone(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM milestones WHERE id = $1", [id]);
}

// ---------- Tasks ----------

const TASK_SELECT = `
  SELECT t.*, p.name AS project_name, p.color AS project_color, m.title AS milestone_title
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN milestones m ON m.id = t.milestone_id`;

/** All tasks, or only one project's when projectId is given. Open first, then by due date. */
export async function getTasks(projectId?: number): Promise<Task[]> {
  const db = await getDb();
  const where = projectId === undefined ? "" : "WHERE t.project_id = $1";
  const rows = await db.select<Raw<Task>[]>(
    `${TASK_SELECT} ${where}
     ORDER BY t.is_done, t.due_date IS NULL, t.due_date,
       CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.id`,
    projectId === undefined ? [] : [projectId]
  );
  return toBool(rows);
}

export async function addTask(input: TaskInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO tasks (project_id, milestone_id, title, priority, due_date) VALUES ($1, $2, $3, $4, $5)",
    [input.project_id, input.milestone_id, input.title.trim(), input.priority, dateOrNull(input.due_date)]
  );
}

export async function updateTask(id: number, input: TaskInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET project_id = $1, milestone_id = $2, title = $3, priority = $4, due_date = $5
     WHERE id = $6`,
    [input.project_id, input.milestone_id, input.title.trim(), input.priority, dateOrNull(input.due_date), id]
  );
}

export async function setTaskDone(id: number, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET is_done = $1 WHERE id = $2", [done ? 1 : 0, id]);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

// ---------- Project info: notes, links, details ----------

/** The project's note, or null if none has been written yet. */
export async function getProjectNote(projectId: number): Promise<ProjectNote | null> {
  const db = await getDb();
  const rows = await db.select<ProjectNote[]>("SELECT * FROM project_notes WHERE project_id = $1", [projectId]);
  return rows[0] ?? null;
}

/** Creates or replaces the project's single note. */
export async function saveProjectNote(projectId: number, content: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO project_notes (project_id, content, updated_at) VALUES ($1, $2, datetime('now'))
     ON CONFLICT(project_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    [projectId, content]
  );
}

type OrderedTable = "project_links" | "project_details";

/** Next sort_order for a new row: after the last one. */
async function nextSortOrder(db: Database, table: OrderedTable, projectId: number): Promise<number> {
  const [{ next }] = await db.select<{ next: number }[]>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${table} WHERE project_id = $1`,
    [projectId]
  );
  return next;
}

/** Moves a row one place up (-1) or down (+1) within its project, renumbering the list. */
async function moveRow(table: OrderedTable, id: number, direction: -1 | 1): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    `SELECT id FROM ${table}
     WHERE project_id = (SELECT project_id FROM ${table} WHERE id = $1)
     ORDER BY sort_order, id`,
    [id]
  );
  const from = rows.findIndex((r) => r.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= rows.length) return;
  [rows[from], rows[to]] = [rows[to], rows[from]];
  for (let i = 0; i < rows.length; i++) {
    await db.execute(`UPDATE ${table} SET sort_order = $1 WHERE id = $2`, [i, rows[i].id]);
  }
}

export async function getProjectLinks(projectId: number): Promise<ProjectLink[]> {
  const db = await getDb();
  return db.select<ProjectLink[]>(
    "SELECT * FROM project_links WHERE project_id = $1 ORDER BY sort_order, id",
    [projectId]
  );
}

export async function addProjectLink(input: ProjectLinkInput): Promise<void> {
  const db = await getDb();
  const order = await nextSortOrder(db, "project_links", input.project_id);
  await db.execute(
    "INSERT INTO project_links (project_id, title, url, type, sort_order) VALUES ($1, $2, $3, $4, $5)",
    [input.project_id, input.title.trim(), input.url.trim(), input.type, order]
  );
}

export async function updateProjectLink(id: number, input: ProjectLinkInput): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE project_links SET title = $1, url = $2, type = $3 WHERE id = $4", [
    input.title.trim(),
    input.url.trim(),
    input.type,
    id,
  ]);
}

export async function deleteProjectLink(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM project_links WHERE id = $1", [id]);
}

export const moveProjectLink = (id: number, direction: -1 | 1) => moveRow("project_links", id, direction);

export async function getProjectDetails(projectId: number): Promise<ProjectDetail[]> {
  const db = await getDb();
  return db.select<ProjectDetail[]>(
    "SELECT * FROM project_details WHERE project_id = $1 ORDER BY sort_order, id",
    [projectId]
  );
}

export async function addProjectDetail(input: ProjectDetailInput): Promise<void> {
  const db = await getDb();
  const order = await nextSortOrder(db, "project_details", input.project_id);
  await db.execute(
    "INSERT INTO project_details (project_id, label, value, sort_order) VALUES ($1, $2, $3, $4)",
    [input.project_id, input.label.trim(), input.value.trim(), order]
  );
}

/** Updates one field, so saving the label never overwrites a value edited at the same time. */
export async function updateProjectDetail(id: number, field: "label" | "value", text: string): Promise<void> {
  const db = await getDb();
  const sql =
    field === "label"
      ? "UPDATE project_details SET label = $1 WHERE id = $2"
      : "UPDATE project_details SET value = $1 WHERE id = $2";
  await db.execute(sql, [text.trim(), id]);
}

export async function deleteProjectDetail(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM project_details WHERE id = $1", [id]);
}

export const moveProjectDetail = (id: number, direction: -1 | 1) => moveRow("project_details", id, direction);
