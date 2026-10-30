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
// A freelance developer's week: two client jobs, a finished one, the app itself, a side game, uni work.

const clients = [
  { key: "goldleaf", name: "Goldleaf Games", email: "studio@goldleaf.example" },
  { key: "spice", name: "Ceylon Spice Co.", email: "orders@ceylonspice.example" },
  { key: "dental", name: "Smile Dental Clinic", email: "frontdesk@smiledental.example" },
];

// pinned: minutes ago it was pinned (older pins are listed first), or null.
const projects = [
  { key: "kingdom", client: "goldleaf", type: "client", name: "Tiny Swords Kingdom", status: "active", deadline: 14, color: "#8b5cf6", pinned: 30,
    description: "Medieval kingdom builder for Android, live on Google Play. Monthly content updates for the studio." },
  { key: "spice", client: "spice", type: "client", name: "Ceylon Spice Co. online store", status: "active", deadline: 21, color: "#10b981", pinned: 20,
    description: "Online shop for a family spice business: catalogue, cart and PayHere checkout, plus a simple orders page." },
  { key: "dental", client: "dental", type: "client", name: "Smile Dental booking site", status: "completed", deadline: -12, color: "#06b6d4", pinned: null,
    description: "Clinic website with online appointment booking and SMS reminders." },
  { key: "milestone", client: null, type: "personal", name: "MilestoneSpace", status: "active", deadline: 44, color: "#3b82f6", pinned: 10,
    description: "This app: an offline workspace for projects, milestones and tasks. Getting it ready for a public release." },
  { key: "campus", client: null, type: "personal", name: "Campus Helper", status: "active", deadline: 32, color: "#f59e0b", pinned: null,
    description: "Deadline manager for university students: timetable, assignments and exam countdowns." },
  { key: "raw", client: null, type: "study", name: "Raw App (final-year project)", status: "active", deadline: 38, color: "#f43f5e", pinned: null,
    description: "Location-based marketplace that connects customers with verified skilled workers." },
  { key: "aws", client: null, type: "study", name: "AWS Cloud Practitioner exam", status: "active", deadline: 6, color: "#f97316", pinned: null,
    description: "Certification exam. Practice tests every evening this week." },
  { key: "wildwood", client: null, type: "personal", name: "Wildwood (survival game)", status: "on_hold", deadline: null, color: "#ec4899", pinned: null,
    description: "Side project: a cosy 2D survival game. Paused until the Tiny Swords update ships." },
];

const milestones = [
  { key: "ts-creatures", project: "kingdom", title: "Creatures & store update", description: "New creatures from the Tiny Swords pack, sold in the store.", due: -9, done: true },
  { key: "ts-boss", project: "kingdom", title: "Boss update", description: "Roaming Troll boss, rewards and balancing.", due: 3, done: false },
  { key: "ts-release", project: "kingdom", title: "v1.4 on Google Play", description: "Release build, store listing and rollout.", due: 14, done: false },
  { key: "sp-design", project: "spice", title: "Design approved", description: "Home, product and checkout pages signed off.", due: -6, done: true },
  { key: "sp-shop", project: "spice", title: "Shop working end to end", description: "Browse, cart and PayHere checkout in the sandbox.", due: 9, done: false },
  { key: "sp-launch", project: "spice", title: "Launch", description: "Live payments, domain and the first orders.", due: 21, done: false },
  { key: "sd-live", project: "dental", title: "Site live", description: "", due: -14, done: true },
  { key: "ms-notes", project: "milestone", title: "Notes & widget", description: "Keep-style notes and the Today widget.", due: -2, done: true },
  { key: "ms-release", project: "milestone", title: "Public release", description: "README, license, privacy policy and a GitHub page.", due: 20, done: false },
  { key: "ch-beta", project: "campus", title: "Beta for classmates", description: "", due: 18, done: false },
  { key: "raw-proposal", project: "raw", title: "Proposal accepted", description: "", due: -20, done: true },
  { key: "raw-demo", project: "raw", title: "Final presentation", description: "Demo and slides for the panel.", due: 38, done: false },
  { key: "aws-exam", project: "aws", title: "Exam day", description: "Online proctored, 9:00 AM.", due: 6, done: false },
];

// due / plan: days from today, or null. plan = the day it was picked for the Today list.
// status: "todo" (default), "in_progress" or "done"; done: true is short for status "done".
const tasks = [
  // Tiny Swords Kingdom: lots in progress at once, the Board view shows it best
  { project: "kingdom", milestone: "ts-creatures", title: "Add more creatures from the Tiny Swords pack", priority: "high", due: -15, done: true },
  { project: "kingdom", milestone: "ts-creatures", title: "Sell the Troll and the Hammer Guy in the store", priority: "high", due: -13, done: true },
  { project: "kingdom", milestone: "ts-creatures", title: "Show bought creatures in the garrison panel when building squads", priority: "high", due: -10, done: true },
  { project: "kingdom", milestone: null, title: "Fix issues from the Google Play review", priority: "high", due: -16, done: true },
  { project: "kingdom", milestone: "ts-boss", title: "Roaming boss: the Troll walks the world map and attacks", priority: "high", due: 0, plan: 0, status: "in_progress" },
  { project: "kingdom", milestone: "ts-boss", title: "Boss fight rewards and difficulty balancing", priority: "medium", due: 2, status: "in_progress" },
  { project: "kingdom", milestone: "ts-boss", title: "Camera shake and hit force on the Troll's attack", priority: "medium", due: 2, status: "in_progress" },
  { project: "kingdom", milestone: "ts-boss", title: "Fix: tooltips stop working after a battle", priority: "high", due: -1, plan: -1 },
  { project: "kingdom", milestone: "ts-release", title: "Equipment shop paid with gems", priority: "medium", due: 6, status: "in_progress" },
  { project: "kingdom", milestone: "ts-release", title: "Weather and seasonal effects (rain, clouds)", priority: "low", due: 8, status: "in_progress" },
  { project: "kingdom", milestone: "ts-release", title: "Add the horse", priority: "low", due: 9 },
  { project: "kingdom", milestone: "ts-release", title: "Unit and building selection", priority: "medium", due: 10 },
  { project: "kingdom", milestone: "ts-release", title: "Night vignette effect", priority: "low", due: 10 },
  { project: "kingdom", milestone: "ts-release", title: "Squad banner effects", priority: "low", due: 11 },
  { project: "kingdom", milestone: "ts-release", title: "Fix: troops get stuck on walls", priority: "high", due: 4 },
  { project: "kingdom", milestone: "ts-release", title: "Fix: no sound after loading a save", priority: "medium", due: 5 },
  { project: "kingdom", milestone: "ts-release", title: "Tweak the main menu and market visuals", priority: "medium", due: 12 },
  { project: "kingdom", milestone: "ts-release", title: "Update the store listing screenshots", priority: "medium", due: 13 },
  // Ceylon Spice Co.
  { project: "spice", milestone: "sp-design", title: "Home and product page designs", priority: "high", due: -9, done: true },
  { project: "spice", milestone: "sp-shop", title: "Product catalogue with categories and search", priority: "high", due: 1, plan: 0, status: "in_progress" },
  { project: "spice", milestone: "sp-shop", title: "Cart with pack sizes (100 g / 250 g / 1 kg)", priority: "high", due: 4 },
  { project: "spice", milestone: "sp-shop", title: "PayHere checkout in sandbox mode", priority: "high", due: 7 },
  { project: "spice", milestone: "sp-shop", title: "Order confirmation email", priority: "medium", due: 8 },
  { project: "spice", milestone: "sp-launch", title: "Product photos: crop and compress", priority: "medium", due: 15 },
  { project: "spice", milestone: "sp-launch", title: "Point the domain and set up SSL", priority: "medium", due: 20 },
  { project: "spice", milestone: null, title: "Send invoice for the design phase", priority: "high", due: -2 },
  // Smile Dental (completed)
  { project: "dental", milestone: "sd-live", title: "Appointment booking form", priority: "high", due: -18, done: true },
  { project: "dental", milestone: "sd-live", title: "SMS reminders a day before", priority: "medium", due: -15, done: true },
  { project: "dental", milestone: null, title: "Hand over the hosting login", priority: "low", due: -12, done: true },
  // MilestoneSpace
  { project: "milestone", milestone: "ms-notes", title: "Keep-style notes for projects and clients", priority: "high", due: -3, done: true },
  { project: "milestone", milestone: "ms-notes", title: "Today widget on the desktop", priority: "medium", due: -5, done: true },
  { project: "milestone", milestone: "ms-release", title: "Add screenshots to the README", priority: "high", due: 0, plan: 0, status: "in_progress" },
  { project: "milestone", milestone: "ms-release", title: "Update the license", priority: "medium", due: 5 },
  { project: "milestone", milestone: "ms-release", title: "Write a privacy policy", priority: "low", due: 12 },
  { project: "milestone", milestone: "ms-release", title: "GitHub page with downloads", priority: "medium", due: 15 },
  { project: "milestone", milestone: null, title: "Recurring tasks", priority: "high", due: null },
  { project: "milestone", milestone: null, title: "Fix the scrollbar in the project tabs", priority: "medium", due: null },
  { project: "milestone", milestone: null, title: "Share it on LinkedIn", priority: "low", due: null },
  // Campus Helper
  { project: "campus", milestone: "ch-beta", title: "Import the timetable from a CSV", priority: "high", due: 5 },
  { project: "campus", milestone: "ch-beta", title: "Assignment reminders a day before", priority: "medium", due: 10 },
  { project: "campus", milestone: "ch-beta", title: "Exam countdown on the home screen", priority: "medium", due: 14, status: "in_progress" },
  { project: "campus", milestone: null, title: "Ask classmates for feedback", priority: "low", due: null },
  // Raw App
  { project: "raw", milestone: "raw-proposal", title: "Write the project proposal", priority: "high", due: -24, done: true },
  { project: "raw", milestone: "raw-demo", title: "Worker verification flow (NIC + photo)", priority: "high", due: 9, status: "in_progress" },
  { project: "raw", milestone: "raw-demo", title: "Map search for nearby workers", priority: "high", due: 16 },
  { project: "raw", milestone: "raw-demo", title: "Ratings and reviews", priority: "medium", due: 24 },
  { project: "raw", milestone: "raw-demo", title: "Presentation slides (soft copy)", priority: "medium", due: 34 },
  { project: "raw", milestone: null, title: "Weekly progress report to the supervisor", priority: "high", due: -3, plan: -3 },
  // AWS
  { project: "aws", milestone: "aws-exam", title: "Practice test 1", priority: "high", due: -1, done: true },
  { project: "aws", milestone: "aws-exam", title: "Practice test 2", priority: "high", due: 0, plan: 0 },
  { project: "aws", milestone: "aws-exam", title: "Review billing and pricing questions", priority: "medium", due: 3 },
  { project: "aws", milestone: "aws-exam", title: "Book the exam slot", priority: "high", due: -2 },
  // Wildwood (on hold)
  { project: "wildwood", milestone: null, title: "Wood only from trees grown from seeds", priority: "medium", due: null, done: true },
  { project: "wildwood", milestone: null, title: "Dialog system for villagers", priority: "medium", due: null },
  { project: "wildwood", milestone: null, title: "Day and night cycle", priority: "low", due: null },
];

// Note cards, in board order. A client's notes use `client` instead of `project`.
const notes = [
  { project: "kingdom", title: "Update plan", pinned: true, content: `- Boss update first, then **v1.4** with the shop
- Studio reviews a build every **Friday**` },
  { project: "kingdom", title: "Before release", color: "#10b981", content: `- [x] Privacy policy link in settings
- [x] New store icon
- [ ] Test on a low-end phone
- [ ] Store listing screenshots
- [ ] Staged rollout at 20%` },
  { project: "kingdom", title: "Balancing", color: "#f59e0b", content: `- Troll: **900 HP**, 45 damage
- Hammer Guy: 260 HP, 18 damage
- Boss reward: 150 gems` },
  { project: "kingdom", title: "", content: "> Ideas for later: WebGL build, co-op raids." },
  { project: "spice", title: "Brief", pinned: true, content: `- Warm, simple look with **real product photos**
- Most buyers order on phones` },
  { project: "spice", title: "Payments", color: "#3b82f6", content: "PayHere sandbox first. Live keys only after the client signs the merchant form." },
  { project: "milestone", title: "Release checklist", pinned: true, content: `- [x] App icon
- [x] Color themes
- [ ] README with screenshots
- [ ] License and privacy policy` },
  { project: "milestone", title: "Ideas", color: "#8b5cf6", content: `- Recurring tasks
- Time tracking per project` },
  { project: "raw", title: "Supervisor feedback", color: "#f43f5e", content: "Focus the demo on **verification** and **search**; payments can be mocked." },
  { client: "goldleaf", title: "How they work", content: "Small indie studio. Feedback comes as Trello cards; build review every **Friday**." },
  { client: "spice", title: "Contact", color: "#10b981", content: "Nimali (owner). Prefers WhatsApp, calls before noon." },
  { client: "dental", title: "", content: `Paid in full.
- [ ] Ask for a testimonial` },
];

const links = [
  { project: "kingdom", title: "Repository", url: "https://github.com/example/tiny-swords-kingdom", type: "github" },
  { project: "kingdom", title: "Google Play", url: "https://play.google.com/store/apps/details?id=com.example.tinyswords", type: "store" },
  { project: "kingdom", title: "Shared assets", url: "https://drive.google.com/drive/folders/example", type: "drive" },
  { project: "spice", title: "Repository", url: "https://github.com/example/ceylon-spice-store", type: "github" },
  { project: "spice", title: "Designs", url: "https://www.figma.com/file/example/ceylon-spice", type: "figma" },
  { project: "spice", title: "Staging", url: "https://ceylonspice-staging.example.com", type: "website" },
  { project: "dental", title: "Live site", url: "https://smiledental.example.com", type: "website" },
  { project: "milestone", title: "Repository", url: "https://github.com/example/milestone-space", type: "github" },
  { project: "raw", title: "Project report", url: "https://docs.google.com/document/d/example", type: "docs" },
  { project: "aws", title: "Exam guide", url: "https://aws.amazon.com/certification/certified-cloud-practitioner/", type: "docs" },
];

const details = [
  { project: "kingdom", label: "Package name", value: "com.example.tinyswords" },
  { project: "kingdom", label: "Rate", value: "USD 20 / hour" },
  { project: "spice", label: "Fixed price", value: "LKR 180,000 (50% paid)" },
  { project: "spice", label: "Contact", value: "Nimali, +94 77 000 0000" },
  { project: "raw", label: "Supervisor", value: "Dr. Perera" },
  { project: "aws", label: "Exam code", value: "CLF-C02" },
];

// Misc tasks: small everyday jobs with no project (just a title and a priority; no due date).
const miscTasks = [
  { title: "Renew the domain for the portfolio", priority: "high" },
  { title: "Pay the internet bill", priority: "medium", plan: 0 },
  { title: "Update Windows and restart", priority: "low" },
  { title: "Back up the phone photos", priority: "low", done: true },
];

const inboxItems = [
  { text: "Try a WebGL build of Tiny Swords Kingdom", minutesAgo: 25 },
  { text: "Ask Ceylon Spice if they want a wholesale price list page", minutesAgo: 180 },
  { text: "Blog post: building a desktop app with Tauri 2 and Svelte 5", minutesAgo: 60 * 26 },
];

// This repository (the MilestoneSpace sample project), so "Open folder" / "Open in VS Code" have a real folder to open.
const sampleFolder = process.cwd();

// ---------- Write ----------

const has = (sql, ...args) => db.prepare(sql).get(...args) !== undefined;
const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);

db.exec("BEGIN");
try {
  if (reset) {
    // Children first; the plugin's tables only.
    for (const t of ["inbox_items", "project_details", "project_links", "project_notes", "notes", "tasks", "milestones", "projects", "clients"]) {
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
    db.prepare("UPDATE projects SET local_path = ? WHERE name = ?").run(sampleFolder, "MilestoneSpace");
  }
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}

/**
 * Adds every sample project whose name isn't in the database yet, with its milestones, tasks,
 * notes, links and details, and the notes of clients added now. Clients are matched by name too. Returns the names added.
 */
function seedProjects() {
  const ids = { client: {}, project: {}, milestone: {} };
  const idByName = (table, name) => db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name)?.id;

  const newClients = new Set();
  for (const c of clients) {
    ids.client[c.key] = idByName("clients", c.name);
    if (ids.client[c.key] !== undefined) continue;
    ids.client[c.key] = insert("INSERT INTO clients (name, email) VALUES (?, ?)", c.name, c.email);
    newClients.add(c.key);
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
  // Notes of the projects and clients added just now, in board order (sort_order counts up).
  let noteOrder = 0;
  for (const n of notes) {
    const isNew = n.project ? isNewProject(n) : newClients.has(n.client);
    if (!isNew) continue;
    insert(
      `INSERT INTO notes (project_id, client_id, title, content, color, pinned_at, sort_order)
       VALUES (?, ?, ?, ?, ?, CASE WHEN ? THEN datetime('now') END, ?)`,
      n.project ? ids.project[n.project] : null, n.client ? ids.client[n.client] : null, n.title, n.content,
      n.color ?? null, n.pinned ? 1 : 0, noteOrder++
    );
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
  ["clients", "projects", "milestones", "tasks", "inbox_items", "notes", "project_links", "project_details"]
    .map((t) => `${t}: ${count(t)}`)
    .join(", ")
);
