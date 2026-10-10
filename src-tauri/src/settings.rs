//! App settings, saved as JSON next to the database (settings.json, or settings-dev.json for the
//! dev build so the two never share settings). The frontend (src/lib/settings.svelte.ts) owns
//! almost every field; Rust only reads the ones it acts on and keeps the rest as they are.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{path::PathBuf, sync::Mutex};

const FILE_NAME: &str = if cfg!(debug_assertions) { "settings-dev.json" } else { "settings.json" };

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Closing the main window hides it to the tray. Off: closing it quits the app.
    pub close_to_tray: bool,
    /// When started with Windows, stay in the tray instead of showing the window.
    pub start_minimized: bool,
    /// Custom quick capture keys, e.g. "Ctrl+Shift+K". None: the build's default.
    pub quick_capture_keys: Option<String>,
    /// Every other setting, kept as the frontend sent it.
    #[serde(flatten)]
    pub other: Map<String, Value>,
}

impl Default for Settings {
    fn default() -> Self {
        Self { close_to_tray: true, start_minimized: true, quick_capture_keys: None, other: Map::new() }
    }
}

pub struct SettingsState {
    path: PathBuf,
    current: Mutex<Settings>,
}

impl SettingsState {
    /// Reads the settings file in `dir`. A missing or unreadable file gives the defaults.
    pub fn load(dir: PathBuf) -> Self {
        let path = dir.join(FILE_NAME);
        let current = std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| match serde_json::from_str(&text) {
                Ok(settings) => Some(settings),
                Err(e) => {
                    eprintln!("Couldn't read {}: {e}. Using the default settings.", path.display());
                    None
                }
            })
            .unwrap_or_default();
        Self { path, current: Mutex::new(current) }
    }

    pub fn get(&self) -> Settings {
        self.current.lock().unwrap().clone()
    }

    /// Changes the settings and writes the file (to a temporary file first, so a crash
    /// halfway through never leaves a broken settings file).
    pub fn update(&self, change: impl FnOnce(&mut Settings)) -> Result<(), String> {
        let mut current = self.current.lock().unwrap();
        change(&mut current);
        let text = serde_json::to_string_pretty(&*current).map_err(|e| e.to_string())?;
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, text).map_err(|e| format!("Couldn't save the settings: {e}"))?;
        std::fs::rename(&tmp, &self.path).map_err(|e| format!("Couldn't save the settings: {e}"))
    }
}
