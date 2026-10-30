// The home page's copy. Sections render these lists, so adding a feature or a tour stop is
// one more entry here. Icon names are the keys in components/Icon.svelte.
import type { IconName } from "./components/Icon.svelte";

export type Pillar = { icon: IconName; title: string; text: string };

export const pillars: Pillar[] = [
  {
    icon: "shield",
    title: "Offline and private",
    text:
      "No account, no server, no subscription. Everything lives in one SQLite file on your computer, " +
      "so the app opens instantly and your clients' details never leave your machine.",
  },
  {
    icon: "briefcase",
    title: "Built for freelancers",
    text:
      "Client jobs, your own apps, a side game and a university module, all in one place, " +
      "without turning into a team tool.",
  },
  {
    icon: "zap",
    title: "Always within reach",
    text:
      "It sits in the tray, starts with Windows, captures ideas with a global shortcut and keeps " +
      "today's plan on your desktop.",
  },
];

export type Feature = { icon: IconName; title: string; text: string };

export const features: Feature[] = [
  {
    icon: "sun",
    title: "A plan for today",
    text: "Pick tasks from every project each morning and work down one list. Overdue and due-soon work is flagged.",
  },
  {
    icon: "folder",
    title: "Projects",
    text: "Client, personal and study projects, each with a color, status, progress and deadline. Pin your focus.",
  },
  {
    icon: "board",
    title: "List or Kanban board",
    text: "Tasks with priorities, due dates and milestones. Drag them across To do, In progress and Done.",
  },
  {
    icon: "flag",
    title: "Milestones",
    text: "A timeline of each project's milestones. Expand one to see its tasks.",
  },
  {
    icon: "note",
    title: "Notes and links",
    text: "Keep-style markdown note cards with checklists, plus links and one-click-copy details for every project.",
  },
  {
    icon: "inbox",
    title: "Inbox and quick capture",
    text: "Press Ctrl+Shift+Space in any app, type, press Enter. It waits in the Inbox or goes straight to a project.",
  },
  {
    icon: "monitor",
    title: "Today widget",
    text: "Today's plan in a small window on the desktop. It stays there, even through Win+D.",
  },
  {
    icon: "bell",
    title: "Reminders",
    text: "Windows notifications before deadlines, a daily summary and quiet hours.",
  },
  {
    icon: "database",
    title: "Backups",
    text: "Automatic backups to a folder you choose, plus manual backup and one-click restore.",
  },
  {
    icon: "palette",
    title: "Themes",
    text: "Five color themes, an accent color, text size and spacing to make it yours.",
  },
  {
    icon: "keyboard",
    title: "Keyboard first",
    text: "Shortcuts everywhere (press ?) and Undo with Ctrl+Z after deleting a task, note or link.",
  },
  {
    icon: "users",
    title: "Clients",
    text: "Each client has a page with their projects and notes.",
  },
];

export type TourStop = {
  title: string;
  text: string;
  /** File name in docs/screenshots without the extension. */
  screenshot: string;
  alt: string;
  width?: number;
  height?: number;
};

export const tour: TourStop[] = [
  {
    title: "Plan the day from every project",
    text:
      "Today is the start page: the tasks you picked for today, what needs attention, quick stats, " +
      "pinned projects and what's coming up this week. Press P to pick today's tasks.",
    screenshot: "today",
    alt: "The Today page: today's plan, what needs attention, pinned projects and what's coming up",
  },
  {
    title: "Everything about a job in one project",
    text:
      "Tasks as a list or a Kanban board, filtered by milestone. Tasks you're not ready for go to the " +
      "project's Stash, out of every list until you need them.",
    screenshot: "board",
    alt: "A project's tasks on a Kanban board with To do, In progress and Done columns",
  },
  {
    title: "Milestones on a timeline",
    text: "See what's next and when it's due. Expand a milestone to see and check off its tasks.",
    screenshot: "milestones",
    alt: "A project's milestones on a timeline",
  },
  {
    title: "Notes, links and details",
    text:
      "Markdown note cards with clickable checklists, colors and pinning. Links open in your browser or " +
      "Explorer; details like your rate or a staging login copy in one click.",
    screenshot: "notes",
    alt: "Note cards on a project's Notes and links tab",
  },
  {
    title: "Capture without switching",
    text:
      "A client calls mid-task? Press Ctrl+Shift+Space, type it, press Enter. Use the arrow keys to send it " +
      "to Today, a project or Misc instead of the Inbox.",
    screenshot: "quick-capture",
    alt: "The quick capture window",
    width: 852,
    height: 192,
  },
  {
    title: "Today's plan on your desktop",
    text: "Check tasks off, add one for today, or click a task to open it in the app.",
    screenshot: "widget-desktop",
    alt: "The Today widget on the Windows desktop",
    width: 1920,
    height: 1080,
  },
];
