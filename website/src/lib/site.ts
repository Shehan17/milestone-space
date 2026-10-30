// Site-wide settings: name, links and the header navigation. Add a page by creating
// src/routes/<name>/+page.svelte and, if it belongs in the header, an entry in `nav`.

export const site = {
  name: "MilestoneSpace",
  tagline: "A personal desktop workspace for projects, milestones, tasks and deadlines.",
  description:
    "Offline, private project tracking for freelancers who juggle client work, side projects and study. " +
    "Plan your day, track milestones and capture ideas from anywhere. For Windows.",
  repo: "https://github.com/Shehan17/milestone-space",
  // Installers are published as GitHub Releases.
  download: "https://github.com/Shehan17/milestone-space/releases/latest",
  platform: "Windows 10 and 11",
};

// `href` starting with "#" is a section on the home page.
export const nav: { label: string; href: string }[] = [
  { label: "Features", href: "#features" },
  { label: "Tour", href: "#tour" },
  { label: "Download", href: "#download" },
];
