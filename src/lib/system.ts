import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";

/** Opens a project folder in Explorer. */
export function openFolder(path: string): Promise<void> {
  return openPath(path);
}

/** Opens a project folder in VS Code (the open_in_vscode command in src-tauri/src/lib.rs). */
export function openInVsCode(path: string): Promise<void> {
  return invoke("open_in_vscode", { path });
}
