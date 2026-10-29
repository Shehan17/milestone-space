import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Database from "@tauri-apps/plugin-sql";
import type {
  Client,
  ClientInput,
  InboxItem,
  Milestone,
  MilestoneInput,
  Note,
  NoteInput,
  NoteOwner,
  Project,
  ProjectDetail,
  ProjectDetailInput,
  ProjectInput,
  ProjectLink,
  ProjectLinkInput,
  ProjectTemplate,
  ProjectTemplateInput,
  Priority,
  Task,
  TaskInput,
  TaskStatus,
} from "./types";
import { MIGRATIONS, migrationSql } from "./migrations";
import type { Outline } from "./templates";

/**
 * `npm run tauri dev` uses its own database so development never touches real data.
 * Installed builds (`npm run tauri build`) use tracker.db. Never rename tracker.db:
 * the installed app would open a new empty database.
 */
const DB_URL = import.meta.env.DEV ? "sqlite:tracker-dev.db" : "sqlite:tracker.db";

let dbPromise: Promise<Database> | null = null;

/** Sent to every window shortly after any write, from any window. The Today widget follows it. */
export const DB_CHANGED = "db-changed";
let changedTimer: ReturnType<typeof setTimeout> | undefined;

/** One db-changed for a burst of writes (an action often runs several). */
function announceChange() {
  clearTimeout(changedTimer);
  changedTimer = setTimeout(() => emit(DB_CHANGED).catch((e) => console.error("db-changed:", e)), 200);
}

async function open(): Promise<Database> {
  // Foreign keys are enabled on every connection by default (sqlx).
  const db = await Database.load(DB_URL);
  if (getCurrentWindow().label === "main") await migrate(db);
  else await waitForMigrations(db);
  const execute = db.execute.bind(db);
  db.execute = async (...args) => {
    const result = await execute(...args);
    announceChange();
    return result;
  };
  // The other windows reload too, e.g. the widget after a restore (the main window opens the database again).
  announceChange();
  return db;
}

/**
 * The other windows (quick capture, the Today widget) often open the database at the same moment as
 * the main window, at startup. Two windows running the same migration would apply it twice, so only
 * the main window migrates and the others wait until it's done.
 */
async function waitForMigrations(db: Database) {
  const STEP_MS = 250;
  for (let waited = 0; ; waited += STEP_MS) {
    const [{ user_version: version }] = await db.select<{ user_version: number }[]>("PRAGMA user_version");
    if (version >= MIGRATIONS.length) return;
    if (waited >= 60_000) throw new Error("The database is still being updated. Open MilestoneSpace and try again.");
    await new Promise((resolve) => setTimeout(resolve, STEP_MS));
  }
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

// ---------- Undo for deletes ----------

/** Tables whose rows can be deleted with Undo: nothing else points at them. */
type UndoableTable = "tasks" | "inbox_items" | "project_links" | "project_details" | "project_templates" | "notes";

/** Puts a deleted row back. Returned by the delete functions below, for the Undo button. */
export type Undo = () => Promise<void>;

/**
 * Deletes one row and returns a function that inserts it again exactly as it was: same id,
 * created_at, sort order, Today plan... Nothing about the table changes.
 */
async function deleteWithUndo(table: UndoableTable, id: number): Promise<Undo> {
  const db = await getDb();
  const [row] = await db.select<Record<string, unknown>[]>(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return async () => {
    if (!row) return;
    const restored = { ...row };
    // The task's milestone may have been deleted in the meantime: keep the task, unlinked.
    if (table === "tasks" && restored.milestone_id != null) {
      const found = await db.select<unknown[]>("SELECT 1 FROM milestones WHERE id = $1", [restored.milestone_id]);
      if (found.length === 0) restored.milestone_id = null;
    }
    const columns = Object.keys(restored);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    await db.execute(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      columns.map((c) => restored[c])
    );
  };
}

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

export async function getClient(id: number): Promise<Client | null> {
  const db = await getDb();
  const rows = await db.select<Client[]>(
    `SELECT c.*, (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS project_count
     FROM clients c WHERE c.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/** Returns the new client's id. Notes are note cards now (see Notes below), not a column. */
export async function addClient(input: ClientInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute("INSERT INTO clients (name, email) VALUES ($1, $2)", [
    input.name.trim(),
    input.email.trim(),
  ]);
  return result.lastInsertId!;
}

export async function updateClient(id: number, input: ClientInput): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE clients SET name = $1, email = $2 WHERE id = $3", [input.name.trim(), input.email.trim(), id]);
}

export async function deleteClient(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM clients WHERE id = $1", [id]);
}

// ---------- Projects ----------

const PROJECT_SELECT = `
  SELECT p.*, c.name AS client_name,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.stashed_at IS NULL) AS task_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.stashed_at IS NULL AND t.is_done = 0) AS open_task_count
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

/** Values in column order: type, client_id, name, description, status, deadline, color, local_path. */
function projectValues(input: ProjectInput) {
  return [
    input.type,
    input.type === "client" ? input.client_id : null, // only client projects have a client
    input.name.trim(),
    input.description.trim(),
    input.status,
    dateOrNull(input.deadline),
    input.color,
    input.local_path?.trim() || null,
  ];
}

/** Returns the new project's id. */
export async function addProject(input: ProjectInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO projects (type, client_id, name, description, status, deadline, color, local_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    projectValues(input)
  );
  return result.lastInsertId!;
}

export async function updateProject(id: number, input: ProjectInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE projects SET type = $1, client_id = $2, name = $3, description = $4, status = $5,
       deadline = $6, color = $7, local_path = $8
     WHERE id = $9`,
    [...projectValues(input), id]
  );
}

/** Pins a project to the Today page (pinned_at = now) or unpins it (NULL). */
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
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN milestones m ON m.id = t.milestone_id`;

/**
 * All tasks, or only one project's when projectId is given. Open first, then by due date.
 * Stashed tasks are left out (see getStashedTasks).
 */
export async function getTasks(projectId?: number): Promise<Task[]> {
  const db = await getDb();
  const where = projectId === undefined ? "WHERE t.stashed_at IS NULL" : "WHERE t.stashed_at IS NULL AND t.project_id = $1";
  const rows = await db.select<Raw<Task>[]>(
    `${TASK_SELECT} ${where}
     ORDER BY t.is_done, t.due_date IS NULL, t.due_date,
       CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.id`,
    projectId === undefined ? [] : [projectId]
  );
  return toBool(rows);
}

/**
 * Values in column order: project_id, milestone_id, title, priority, due_date, status, is_done.
 * A Misc task (no project) keeps only its title, priority and done state.
 */
function taskValues(input: TaskInput) {
  const misc = input.project_id === null;
  const status = misc && input.status === "in_progress" ? "todo" : input.status;
  return [
    input.project_id,
    misc ? null : input.milestone_id,
    input.title.trim(),
    input.priority,
    misc ? null : dateOrNull(input.due_date),
    status,
    status === "done" ? 1 : 0, // is_done always follows status
  ];
}

/** Adds a task, optionally already planned for a day (the Today page's "New task"). */
export async function addTask(input: TaskInput, plannedFor: string | null = null): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO tasks (project_id, milestone_id, title, priority, due_date, status, is_done, planned_for)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [...taskValues(input), plannedFor]
  );
}

export async function updateTask(id: number, input: TaskInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET project_id = $1, milestone_id = $2, title = $3, priority = $4, due_date = $5,
       status = $6, is_done = $7
     WHERE id = $8`,
    [...taskValues(input), id]
  );
}

/** The checkbox: done, or back to To do. */
export async function setTaskDone(id: number, done: boolean): Promise<void> {
  await setTaskStatus(id, done ? "done" : "todo");
}

/** Sets the status (and is_done with it), e.g. to undo a checkbox click on an In progress task. */
export async function setTaskStatus(id: number, status: TaskStatus): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET is_done = $1, status = $2 WHERE id = $3", [status === "done" ? 1 : 0, status, id]);
}

/**
 * Drops a task into a board column. orderedIds is that column's tasks, top to bottom, with the
 * moved task in its new place; their board_order is renumbered to match.
 */
export async function moveTaskOnBoard(id: number, status: TaskStatus, orderedIds: number[]): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET status = $1, is_done = $2 WHERE id = $3", [status, status === "done" ? 1 : 0, id]);
  if (orderedIds.length === 0) return;
  const n = orderedIds.length;
  const cases = orderedIds.map((_, i) => `WHEN $${2 * i + 1} THEN $${2 * i + 2}`).join(" ");
  const inList = orderedIds.map((_, i) => `$${2 * n + i + 1}`).join(", ");
  await db.execute(`UPDATE tasks SET board_order = CASE id ${cases} END WHERE id IN (${inList})`, [
    ...orderedIds.flatMap((taskId, i) => [taskId, i]),
    ...orderedIds,
  ]);
}

/** Plans tasks for a day ("YYYY-MM-DD"), or takes them off any day's list (null). */
export async function setTasksPlanned(ids: number[], day: string | null): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
  await db.execute(`UPDATE tasks SET planned_for = $1 WHERE id IN (${placeholders})`, [day, ...ids]);
}

export const deleteTask = (id: number) => deleteWithUndo("tasks", id);

// ---------- Stash: tasks parked for later, hidden everywhere but their project's Stash section ----------

/** Stashed tasks, all or one project's, the most recently stashed first. */
export async function getStashedTasks(projectId?: number): Promise<Task[]> {
  const db = await getDb();
  const where = projectId === undefined ? "WHERE t.stashed_at IS NOT NULL" : "WHERE t.stashed_at IS NOT NULL AND t.project_id = $1";
  const rows = await db.select<Raw<Task>[]>(
    `${TASK_SELECT} ${where} ORDER BY t.stashed_at DESC, t.id DESC`,
    projectId === undefined ? [] : [projectId]
  );
  return toBool(rows);
}

/** Moves a task to the stash and off any day's plan. Undo brings it back, plan included. */
export async function stashTask(id: number): Promise<Undo> {
  const db = await getDb();
  const [row] = await db.select<{ planned_for: string | null }[]>("SELECT planned_for FROM tasks WHERE id = $1", [id]);
  await db.execute("UPDATE tasks SET stashed_at = datetime('now'), planned_for = NULL WHERE id = $1", [id]);
  return async () => {
    await db.execute("UPDATE tasks SET stashed_at = NULL, planned_for = $1 WHERE id = $2", [row?.planned_for ?? null, id]);
  };
}

/** Takes a task out of the stash, back into its project's tasks as it was (not planned for a day). */
export async function unstashTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET stashed_at = NULL WHERE id = $1", [id]);
}

// ---------- Inbox ----------

/** Newest first. */
export async function getInboxItems(): Promise<InboxItem[]> {
  const db = await getDb();
  return db.select<InboxItem[]>("SELECT * FROM inbox_items ORDER BY created_at DESC, id DESC");
}

export async function countInboxItems(): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM inbox_items");
  return n;
}

export async function addInboxItem(text: string): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO inbox_items (text) VALUES ($1)", [text.trim()]);
}

export const deleteInboxItem = (id: number) => deleteWithUndo("inbox_items", id);

// ---------- Project info: links, details ----------

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

export const deleteProjectLink = (id: number) => deleteWithUndo("project_links", id);

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

export const deleteProjectDetail = (id: number) => deleteWithUndo("project_details", id);

export const moveProjectDetail = (id: number, direction: -1 | 1) => moveRow("project_details", id, direction);

// ---------- Notes: Keep-style cards on a project or a client ----------

/** The owner's column. Only these two fixed names ever go into the SQL. */
const ownerColumn = (owner: NoteOwner) => (owner.type === "project" ? "project_id" : "client_id");

/** Pinned first; within each group the order they were arranged in (sort_order). */
export async function getNotes(owner: NoteOwner): Promise<Note[]> {
  const db = await getDb();
  return db.select<Note[]>(
    `SELECT * FROM notes WHERE ${ownerColumn(owner)} = $1 ORDER BY pinned_at IS NULL, sort_order, id`,
    [owner.id]
  );
}

function noteValues(input: NoteInput) {
  return [input.title.trim(), input.content.replace(/s+$/, ""), input.color];
}

/** Adds a note in front of the others, like Keep. Returns its id. */
export async function addNote(owner: NoteOwner, input: NoteInput): Promise<number> {
  const db = await getDb();
  const column = ownerColumn(owner);
  const [{ first }] = await db.select<{ first: number }[]>(
    `SELECT COALESCE(MIN(sort_order), 1) - 1 AS first FROM notes WHERE ${column} = $1`,
    [owner.id]
  );
  const result = await db.execute(
    `INSERT INTO notes (${column}, title, content, color, sort_order) VALUES ($1, $2, $3, $4, $5)`,
    [owner.id, ...noteValues(input), first]
  );
  return result.lastInsertId!;
}

export async function updateNote(id: number, input: NoteInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE notes SET title = $1, content = $2, color = $3, updated_at = datetime('now') WHERE id = $4",
    [...noteValues(input), id]
  );
}

/** Pins a note to the top of its board (pinned_at = now) or unpins it (NULL). */
export async function setNotePinned(id: number, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    pinned
      ? "UPDATE notes SET pinned_at = datetime('now') WHERE id = $1"
      : "UPDATE notes SET pinned_at = NULL WHERE id = $1",
    [id]
  );
}

/** Saves a dragged order: orderedIds get sort_order 0, 1, 2... */
export async function reorderNotes(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const db = await getDb();
  const n = orderedIds.length;
  const cases = orderedIds.map((_, i) => `WHEN ${2 * i + 1} THEN ${2 * i + 2}`).join(" ");
  const inList = orderedIds.map((_, i) => `${2 * n + i + 1}`).join(", ");
  await db.execute(`UPDATE notes SET sort_order = CASE id ${cases} END WHERE id IN (${inList})`, [
    ...orderedIds.flatMap((noteId, i) => [noteId, i]),
    ...orderedIds,
  ]);
}

export const deleteNote = (id: number) => deleteWithUndo("notes", id);

// ---------- Project templates ----------

export async function getProjectTemplates(): Promise<ProjectTemplate[]> {
  const db = await getDb();
  return db.select<ProjectTemplate[]>("SELECT * FROM project_templates ORDER BY name COLLATE NOCASE");
}

function templateValues(input: ProjectTemplateInput) {
  return [input.name.trim(), input.type, input.color, input.description.trim(), input.outline.trim()];
}

export async function addProjectTemplate(input: ProjectTemplateInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO project_templates (name, type, color, description, outline) VALUES ($1, $2, $3, $4, $5)",
    templateValues(input)
  );
}

export async function updateProjectTemplate(id: number, input: ProjectTemplateInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE project_templates SET name = $1, type = $2, color = $3, description = $4, outline = $5 WHERE id = $6",
    [...templateValues(input), id]
  );
}

export const deleteProjectTemplate = (id: number) => deleteWithUndo("project_templates", id);

/** Adds a template's milestones and tasks to a (new) project. */
export async function addOutlineToProject(projectId: number, outline: Outline, priority: Priority): Promise<void> {
  const db = await getDb();
  const addTasks = async (titles: string[], milestoneId: number | null) => {
    for (const title of titles) {
      await addTask({ project_id: projectId, milestone_id: milestoneId, title, priority, due_date: null, status: "todo" });
    }
  };
  await addTasks(outline.tasks, null);
  for (const milestone of outline.milestones) {
    const result = await db.execute("INSERT INTO milestones (project_id, title) VALUES ($1, $2)", [projectId, milestone.title]);
    await addTasks(milestone.tasks, result.lastInsertId!);
  }
}

// ---------- Backup and export ----------

/**
 * Writes a complete copy of the database to a new file. VACUUM INTO gives a consistent snapshot
 * even while the app is running (the database uses a write-ahead log, so copying the file
 * itself could miss recent changes).
 */
export async function backupDatabaseTo(path: string): Promise<void> {
  const db = await getDb();
  await db.execute("VACUUM INTO $1", [path]);
}

/** Closes every connection, so a restore can replace the file. Reload the page afterwards. */
export async function closeDatabase(): Promise<void> {
  const db = await getDb();
  await db.close();
  dbPromise = null;
}

export const EXPORT_TABLES = [
  "clients",
  "projects",
  "milestones",
  "tasks",
  "inbox_items",
  "project_notes",
  "notes",
  "project_links",
  "project_details",
  "project_templates",
] as const;

/** Every row of every table, as stored, for the JSON export. */
export async function getAllData(): Promise<Record<(typeof EXPORT_TABLES)[number], Record<string, unknown>[]>> {
  const db = await getDb();
  const entries = await Promise.all(
    EXPORT_TABLES.map(async (table) => [table, await db.select<Record<string, unknown>[]>(`SELECT * FROM ${table} ORDER BY id`)])
  );
  return Object.fromEntries(entries);
}
