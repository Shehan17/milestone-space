// Fills the DEVELOPMENT database (tracker-dev.db) with sample clients, projects, milestones,
// tasks and project info, so every screen has something to show. Never touches tracker.db.
//
//   npm run seed:dev            add the samples that aren't there yet (matched by name)
//   npm run seed:dev -- --reset delete everything in tracker-dev.db first, then add them
//
// Dates are relative to today, so overdue / due soon / Today states always look right.
// Safe to run while the dev app is open: reload the page (or switch pages) to see the data.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS, migrationSql } from "../src/lib/migrations.ts";

const DB_FILE = "tracker-dev.db"; // the dev database only, see DB_URL in src/lib/db.ts
const dbPath = join(process.env.APPDATA ?? "", "com.shehan.milestonespace", DB_FILE);
if (!process.env.APPDATA || !dbPath.endsWith(DB_FILE)) throw new Error(`Refusing to open ${dbPath}`);

const reset = process.argv.includes("--reset");
const isNew = !existsSync(dbPath);
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 5000"); // the dev app may be holding the file open

// Bring the schema up to date, the same way the app does on start.
const version = db.prepare("PRAGMA user_version").get().user_version;
for (let i = version; i < MIGRATIONS.length; i++) db.exec(migrationSql(i));
db.exec("PRAGMA foreign_keys = ON");

/** Local "YYYY-MM-DD", `offset` days from today. */
function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const due = (offset) => (offset === null ? null : day(offset));

// ---------- Sample data ----------

const clients = [
  { key: "northwind", name: "Northwind Studio", email: "hello@northwind.example", notes: "Design agency. Feedback comes as Figma comments; weekly call on Mondays." },
  { key: "lankafresh", name: "Lanka Fresh Foods", email: "ops@lankafresh.example", notes: "Grocery delivery startup. Contact: Nimal (operations)." },
  { key: "blueharbor", name: "Blue Harbor Café", email: "owner@blueharbor.example", notes: "Small café, prefers WhatsApp. Invoices at the end of each month." },
];

// pinned: minutes ago it was pinned (older pins are listed first), or null.
const projects = [
  { key: "northwind", client: "northwind", type: "client", name: "Northwind website redesign", status: "active", deadline: 12, color: "#8b5cf6", pinned: 30,
    description: "New marketing site: home, services, case studies and contact pages. SvelteKit + headless CMS." },
  { key: "lankafresh", client: "lankafresh", type: "client", name: "Lanka Fresh delivery app", status: "active", deadline: 30, color: "#10b981", pinned: 20,
    description: "Customer app for ordering groceries, plus a simple admin panel for orders." },
  { key: "blueharbor", client: "blueharbor", type: "client", name: "Blue Harbor menu site", status: "completed", deadline: -10, color: "#f59e0b", pinned: null,
    description: "One-page menu site with QR code for the tables." },
  { key: "portfolio", client: null, type: "personal", name: "Portfolio site v2", status: "active", deadline: 20, color: "#3b82f6", pinned: null,
    description: "Rebuild the portfolio with case studies and a blog." },
  { key: "habits", client: null, type: "personal", name: "Habit tracker app", status: "on_hold", deadline: null, color: "#ec4899", pinned: null,
    description: "Side project: a tiny offline habit tracker. Paused until the client work calms down." },
  { key: "dsa", client: null, type: "study", name: "Data Structures & Algorithms", status: "active", deadline: 45, color: "#06b6d4", pinned: 10,
    description: "University module. Weekly labs and a final exam." },
  { key: "aws", client: null, type: "study", name: "AWS Cloud Practitioner exam", status: "active", deadline: 6, color: "#f97316", pinned: null,
    description: "Certification exam. Practice tests every evening this week." },
  { key: "game", client: null, type: "personal", name: "Pixel Quest (game jam)", status: "active", deadline: 9, color: "#f43f5e", pinned: 5,
    description: "2D platformer in Godot for the game jam. Lots of things in progress at once: use the Board view." },
];

const milestones = [
  { key: "nw-design", project: "northwind", title: "Design approved", description: "Client signs off on all page designs.", due: -5, done: true },
  { key: "nw-build", project: "northwind", title: "Pages built", description: "All pages built and responsive.", due: 5, done: false },
  { key: "nw-launch", project: "northwind", title: "Launch", description: "DNS switch and announcement.", due: 12, done: false },
  { key: "lf-mvp", project: "lankafresh", title: "MVP for testers", description: "Browse, cart and checkout working end to end.", due: 9, done: false },
  { key: "lf-admin", project: "lankafresh", title: "Admin panel", description: "", due: 24, done: false },
  { key: "bh-live", project: "blueharbor", title: "Site live", description: "", due: -12, done: true },
  { key: "pf-content", project: "portfolio", title: "Content written", description: "Three case studies and the about page.", due: 7, done: false },
  { key: "dsa-mid", project: "dsa", title: "Midterm", description: "Covers weeks 1–6.", due: -3, done: true },
  { key: "dsa-final", project: "dsa", title: "Final exam", description: "", due: 45, done: false },
  { key: "aws-exam", project: "aws", title: "Exam day", description: "Online proctored, 9:00 AM.", due: 6, done: false },
  { key: "game-proto", project: "game", title: "Playable prototype", description: "Run, jump, one level.", due: -6, done: true },
  { key: "game-alpha", project: "game", title: "Alpha", description: "Two levels, enemies, sound.", due: 4, done: false },
  { key: "game-jam", project: "game", title: "Jam submission", description: "Web build uploaded to itch.io.", due: 9, done: false },
];

// due / plan: days from today, or null. plan = the day it was picked for the Today list.
// status: "todo" (default), "in_progress" or "done"; done: true is short for status "done".
const tasks = [
  // Northwind
  { project: "northwind", milestone: "nw-design", title: "Moodboard and style tiles", priority: "medium", due: -15, done: true },
  { project: "northwind", milestone: "nw-design", title: "Home page design", priority: "high", due: -8, done: true },
  { project: "northwind", milestone: "nw-build", title: "Build home page hero and sections", priority: "high", due: 0, plan: 0, status: "in_progress" },
  { project: "northwind", milestone: "nw-build", title: "Services page", priority: "high", due: 2, plan: 0 },
  { project: "northwind", milestone: "nw-build", title: "Case study template", priority: "medium", due: 4 },
  { project: "northwind", milestone: "nw-build", title: "Contact form with spam protection", priority: "medium", due: -1, plan: -1 },
  { project: "northwind", milestone: "nw-launch", title: "Set up redirects from old URLs", priority: "low", due: 10 },
  { project: "northwind", milestone: "nw-launch", title: "Lighthouse pass (90+ on mobile)", priority: "medium", due: 11 },
  { project: "northwind", milestone: null, title: "Send invoice for design phase", priority: "high", due: -2 },
  // Lanka Fresh
  { project: "lankafresh", milestone: "lf-mvp", title: "Product list with categories", priority: "high", due: -4, done: true },
  { project: "lankafresh", milestone: "lf-mvp", title: "Cart and quantity controls", priority: "high", due: 1, plan: 0, done: true },
  { project: "lankafresh", milestone: "lf-mvp", title: "Checkout with cash on delivery", priority: "high", due: 3, status: "in_progress" },
  { project: "lankafresh", milestone: "lf-mvp", title: "Order confirmation SMS", priority: "medium", due: 8 },
  { project: "lankafresh", milestone: "lf-admin", title: "Orders table with status filter", priority: "medium", due: 18 },
  { project: "lankafresh", milestone: "lf-admin", title: "Daily sales export (CSV)", priority: "low", due: 22 },
  { project: "lankafresh", milestone: null, title: "Ask Nimal for the delivery zones list", priority: "medium", due: null, plan: -1 },
  // Blue Harbor (completed project)
  { project: "blueharbor", milestone: "bh-live", title: "Menu page with prices", priority: "high", due: -14, done: true },
  { project: "blueharbor", milestone: "bh-live", title: "QR code for tables", priority: "medium", due: -13, done: true },
  { project: "blueharbor", milestone: null, title: "Hand over hosting login", priority: "low", due: -10, done: true },
  // Portfolio
  { project: "portfolio", milestone: "pf-content", title: "Write Northwind case study", priority: "medium", due: 6 },
  { project: "portfolio", milestone: "pf-content", title: "Rewrite the about page", priority: "low", due: 7 },
  { project: "portfolio", milestone: null, title: "Pick a new font pairing", priority: "low", due: null, done: true },
  { project: "portfolio", milestone: null, title: "Add a blog with markdown posts", priority: "low", due: 19 },
  // Habit tracker (on hold)
  { project: "habits", milestone: null, title: "Sketch the streak screen", priority: "low", due: null },
  { project: "habits", milestone: null, title: "Try local notifications on Android", priority: "low", due: null },
  // DSA
  { project: "dsa", milestone: "dsa-mid", title: "Revise sorting algorithms", priority: "high", due: -5, done: true },
  { project: "dsa", milestone: null, title: "Lab 7: binary search trees", priority: "high", due: 1, plan: 0 },
  { project: "dsa", milestone: null, title: "Read chapter 9 (graphs)", priority: "medium", due: 5, status: "in_progress" },
  { project: "dsa", milestone: null, title: "Lab 6 report", priority: "high", due: -3, plan: -3 },
  { project: "dsa", milestone: "dsa-final", title: "Make a summary sheet for each topic", priority: "medium", due: 35 },
  // AWS
  { project: "aws", milestone: "aws-exam", title: "Practice test 1", priority: "high", due: -1, done: true },
  { project: "aws", milestone: "aws-exam", title: "Practice test 2", priority: "high", due: 0, plan: 0 },
  { project: "aws", milestone: "aws-exam", title: "Review billing and pricing questions", priority: "medium", due: 3 },
  { project: "aws", milestone: "aws-exam", title: "Book the exam slot", priority: "high", due: -2 },
  // Pixel Quest: a game project with many tasks in progress at once
  { project: "game", milestone: "game-proto", title: "Player movement and jumping", priority: "high", due: -9, done: true },
  { project: "game", milestone: "game-proto", title: "Tilemap and first level layout", priority: "high", due: -7, done: true },
  { project: "game", milestone: "game-proto", title: "Camera follow with smoothing", priority: "medium", due: -6, done: true },
  { project: "game", milestone: "game-alpha", title: "Enemy AI: patrol and chase", priority: "high", due: 2, status: "in_progress" },
  { project: "game", milestone: "game-alpha", title: "Health and damage system", priority: "high", due: 1, plan: 0, status: "in_progress" },
  { project: "game", milestone: "game-alpha", title: "Pixel art: player run cycle", priority: "medium", due: 3, status: "in_progress" },
  { project: "game", milestone: "game-alpha", title: "Collectible coins and score UI", priority: "medium", due: 3, status: "in_progress" },
  { project: "game", milestone: "game-alpha", title: "Sound effects: jump, coin, hit", priority: "low", due: 4, status: "in_progress" },
  { project: "game", milestone: "game-alpha", title: "Level 2: cave theme", priority: "medium", due: 4 },
  { project: "game", milestone: "game-alpha", title: "Checkpoints", priority: "medium", due: 4 },
  { project: "game", milestone: "game-alpha", title: "Pause menu", priority: "low", due: null },
  { project: "game", milestone: null, title: "Bug: player clips through moving platforms", priority: "high", due: 0, plan: 0 },
  { project: "game", milestone: "game-jam", title: "Boss fight design doc", priority: "medium", due: 6, status: "in_progress" },
  { project: "game", milestone: "game-jam", title: "Main menu and title screen", priority: "medium", due: 7 },
  { project: "game", milestone: "game-jam", title: "Web (HTML5) build and test", priority: "high", due: 8 },
  { project: "game", milestone: "game-jam", title: "itch.io page: screenshots and description", priority: "medium", due: 9 },
  { project: "game", milestone: null, title: "Background music loop", priority: "low", due: null },
];

const notes = {
  northwind: `## Brief
- Clean, editorial look. **No stock photos.**
- Must be editable by the client (CMS).

## Decisions
1. SvelteKit + Sanity
2. Hosting on Netlify, client pays

> Next call: go through the services copy.`,
  dsa: `## Exam topics
- Arrays, linked lists, stacks, queues
- Trees: BST, AVL, heaps
- Graphs: BFS, DFS, Dijkstra

Lab submissions go to the course page by **Friday 11:59 PM**.`,
  game: `## Jam
- Theme: **"One more try"**
- Engine: Godot 4, 320x180 pixel art, scaled x4

## Scope
Two levels and a boss. Anything else goes in the Inbox for after the jam.`,
};

const links = [
  { project: "northwind", title: "Repository", url: "https://github.com/example/northwind-site", type: "github" },
  { project: "northwind", title: "Designs", url: "https://www.figma.com/file/example/northwind", type: "figma" },
  { project: "northwind", title: "Staging", url: "https://northwind-staging.example.com", type: "website" },
  { project: "lankafresh", title: "Repository", url: "https://github.com/example/lankafresh-app", type: "github" },
  { project: "lankafresh", title: "Shared folder", url: "https://drive.google.com/drive/folders/example", type: "drive" },
  { project: "blueharbor", title: "Live site", url: "https://blueharbor.example.com", type: "website" },
  { project: "dsa", title: "Course notes", url: "https://docs.google.com/document/d/example", type: "docs" },
  { project: "aws", title: "Exam guide", url: "https://aws.amazon.com/certification/certified-cloud-practitioner/", type: "docs" },
  { project: "game", title: "Repository", url: "https://github.com/example/pixel-quest", type: "github" },
  { project: "game", title: "itch.io page", url: "https://example.itch.io/pixel-quest", type: "store" },
];

const details = [
  { project: "northwind", label: "Hourly rate", value: "USD 25" },
  { project: "northwind", label: "Staging login", value: "preview / northwind2026" },
  { project: "lankafresh", label: "Contact", value: "Nimal — +94 77 000 0000" },
  { project: "lankafresh", label: "Fixed price", value: "LKR 450,000 (50% paid)" },
  { project: "dsa", label: "Module code", value: "CS2012" },
  { project: "aws", label: "Exam code", value: "CLF-C02" },
  { project: "game", label: "Engine", value: "Godot 4.3" },
  { project: "game", label: "Jam deadline", value: "Sunday 23:59 (UTC)" },
];

// Misc tasks: small everyday jobs with no project (just a title and a priority; no due date).
const miscTasks = [
  { title: "Renew the domain for the portfolio", priority: "high" },
  { title: "Reply to the recruiter email", priority: "medium", plan: 0 },
  { title: "Update Node and npm on the laptop", priority: "low" },
  { title: "Back up the phone photos", priority: "low", done: true },
];

const inboxItems = [
  { text: "Blog post idea: what I learned moving to Svelte 5 runes", minutesAgo: 25 },
  { text: "Ask Northwind if they want a newsletter signup", minutesAgo: 180 },
  { text: "Look into Tauri auto-updater", minutesAgo: 60 * 26 },
];

// This repository, so "Open folder" / "Open in VS Code" have a real folder to open.
const sampleFolder = process.cwd();

// ---------- Write ----------

const has = (sql, ...args) => db.prepare(sql).get(...args) !== undefined;
const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);

db.exec("BEGIN");
try {
  if (reset) {
    // Children first; the plugin's tables only.
    for (const t of ["inbox_items", "project_details", "project_links", "project_notes", "tasks", "milestones", "projects", "clients"]) {
      db.exec(`DELETE FROM ${t}`);
    }
  }
  // Databases seeded before the board existed: mark the sample "in progress" tasks. Runs before
  // adding projects, which bring their own in-progress tasks.
  if (!has("SELECT 1 FROM tasks WHERE status = 'in_progress'")) {
    for (const t of tasks.filter((t) => t.status === "in_progress")) {
      db.prepare("UPDATE tasks SET status = 'in_progress', is_done = 0 WHERE title = ?").run(t.title);
    }
  }
  const added = seedProjects();
  if (added.length > 0) console.log(`Added projects: ${added.join(", ")}`);
  else console.log(`All sample projects are already in ${DB_FILE} (use "npm run seed:dev -- --reset" to start over).`);

  for (const t of miscTasks) {
    if (has("SELECT 1 FROM tasks WHERE project_id IS NULL AND title = ?", t.title)) continue;
    const status = t.done ? "done" : "todo";
    insert(
      `INSERT INTO tasks (project_id, title, priority, status, is_done, planned_for) VALUES (NULL, ?, ?, ?, ?, ?)`,
      t.title, t.priority, status, status === "done" ? 1 : 0, due(t.plan ?? null)
    );
  }
  for (const item of inboxItems) {
    if (has("SELECT 1 FROM inbox_items WHERE text = ?", item.text)) continue;
    insert("INSERT INTO inbox_items (text, created_at) VALUES (?, datetime('now', ?))", item.text, `-${item.minutesAgo} minutes`);
  }
  if (!has("SELECT 1 FROM projects WHERE local_path IS NOT NULL")) {
    db.prepare("UPDATE projects SET local_path = ? WHERE name = ?").run(sampleFolder, projects[0].name);
  }
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}

/**
 * Adds every sample project whose name isn't in the database yet, with its milestones, tasks,
 * note, links and details. Clients are matched by name too. Returns the names added.
 */
function seedProjects() {
  const ids = { client: {}, project: {}, milestone: {} };
  const idByName = (table, name) => db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name)?.id;

  for (const c of clients) {
    ids.client[c.key] =
      idByName("clients", c.name) ?? insert("INSERT INTO clients (name, email, notes) VALUES (?, ?, ?)", c.name, c.email, c.notes);
  }
  const added = [];
  for (const p of projects) {
    if (idByName("projects", p.name) !== undefined) continue;
    ids.project[p.key] = insert(
      `INSERT INTO projects (client_id, type, name, description, status, deadline, color, pinned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', '-' || ? || ' minutes') END)`,
      p.client ? ids.client[p.client] : null, p.type, p.name, p.description, p.status, due(p.deadline), p.color,
      p.pinned, p.pinned
    );
    added.push(p.name);
  }
  // Only the children of projects added just now.
  const isNewProject = (item) => item.project in ids.project;

  for (const m of milestones.filter(isNewProject)) {
    ids.milestone[m.key] = insert(
      "INSERT INTO milestones (project_id, title, description, due_date, is_done) VALUES (?, ?, ?, ?, ?)",
      ids.project[m.project], m.title, m.description, due(m.due), m.done ? 1 : 0
    );
  }
  for (const t of tasks.filter(isNewProject)) {
    const status = t.done ? "done" : (t.status ?? "todo");
    insert(
      `INSERT INTO tasks (project_id, milestone_id, title, priority, due_date, status, is_done, planned_for)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ids.project[t.project], t.milestone ? ids.milestone[t.milestone] : null, t.title, t.priority,
      due(t.due), status, status === "done" ? 1 : 0, due(t.plan ?? null)
    );
  }
  for (const [project, content] of Object.entries(notes)) {
    if (!(project in ids.project)) continue;
    insert("INSERT INTO project_notes (project_id, content) VALUES (?, ?)", ids.project[project], content);
  }
  // sort_order counts up within each project, like addProjectLink / addProjectDetail.
  const order = {};
  const next = (table, project) => (order[`${table}${project}`] = (order[`${table}${project}`] ?? -1) + 1);
  for (const l of links.filter(isNewProject)) {
    insert(
      "INSERT INTO project_links (project_id, title, url, type, sort_order) VALUES (?, ?, ?, ?, ?)",
      ids.project[l.project], l.title, l.url, l.type, next("links", l.project)
    );
  }
  for (const d of details.filter(isNewProject)) {
    insert(
      "INSERT INTO project_details (project_id, label, value, sort_order) VALUES (?, ?, ?, ?)",
      ids.project[d.project], d.label, d.value, next("details", d.project)
    );
  }
  return added;
}

const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(`${isNew ? "Created" : reset ? "Reset" : "Updated"} ${dbPath}`);
console.log(
  ["clients", "projects", "milestones", "tasks", "inbox_items", "project_notes", "project_links", "project_details"]
    .map((t) => `${t}: ${count(t)}`)
    .join(", ")
);
