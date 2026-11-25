// The latest release's setup .exe, looked up in the browser so the download buttons start the
// download directly. Until the lookup is done, or if it fails, `url` is the releases page.

import { site } from "./site";

type Asset = { name: string; size: number; browser_download_url: string };

export const release = $state<{ url: string; version: string | null; size: number | null }>({
  url: site.download,
  version: null,
  size: null,
});

let started = false;

export async function loadLatestRelease() {
  if (started) return;
  started = true;
  try {
    const res = await fetch(site.releasesApi, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return;
    const data: { tag_name: string; assets: Asset[] } = await res.json();
    const exe = data.assets.find((a) => a.name.endsWith("-setup.exe"));
    if (!exe) return;
    release.url = exe.browser_download_url;
    release.version = data.tag_name.replace(/^v/, "");
    release.size = exe.size;
  } catch {
    // Offline or rate-limited: keep the releases page link.
  }
}

export function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
