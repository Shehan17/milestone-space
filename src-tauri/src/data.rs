//! File work for the Settings page's "Data and backup" section. The backups themselves are made
//! by the frontend with SQLite's `VACUUM INTO` (src/lib/backup.ts), which writes a consistent copy
//! even while the app is using the database. These commands pick file names, clean up old
//! backups, and swap a backup in on restore.

use serde::Serialize;
use std::{
    io::Read,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

/// Must match DB_URL in src/lib/db.ts. Never rename: the app would open a new empty database.
const DB_FILE: &str = if cfg!(debug_assertions) { "tracker-dev.db" } else { "tracker.db" };

/// Backups made by the app start with this; only these files are ever cleaned up.
const BACKUP_PREFIX: &str = if cfg!(debug_assertions) { "milestonespace-dev-backup-" } else { "milestonespace-backup-" };

/// The folder that holds the database (the sql plugin resolves "sqlite:tracker.db" against it).
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[derive(Serialize)]
pub struct AppPaths {
    data_dir: String,
    database: String,
    default_backup_dir: String,
}

#[tauri::command]
pub fn app_paths(app: AppHandle) -> Result<AppPaths, String> {
    let dir = data_dir(&app)?;
    Ok(AppPaths {
        database: display(&dir.join(DB_FILE)),
        default_backup_dir: display(&dir.join("backups")),
        data_dir: display(&dir),
    })
}

/// `stamp` is the local time from the frontend, e.g. "2026-10-10_093000".
fn check_stamp(stamp: &str) -> Result<(), String> {
    if stamp.is_empty() || !stamp.chars().all(|c| c.is_ascii_digit() || c == '-' || c == '_') {
        return Err(format!("Invalid backup time: {stamp}"));
    }
    Ok(())
}

/// Creates the folder if needed and returns a free file path for a new backup in it.
#[tauri::command]
pub fn new_backup_path(folder: String, stamp: String) -> Result<String, String> {
    check_stamp(&stamp)?;
    let folder = PathBuf::from(folder);
    std::fs::create_dir_all(&folder).map_err(|e| format!("Couldn't open the backup folder {}: {e}", folder.display()))?;
    let mut path = folder.join(format!("{BACKUP_PREFIX}{stamp}.db"));
    let mut n = 2;
    while path.exists() {
        path = folder.join(format!("{BACKUP_PREFIX}{stamp}-{n}.db"));
        n += 1;
    }
    Ok(display(&path))
}

/// Where the copy of the current data goes before a restore: next to the database, named like
/// the other manual safety copies (tracker.db.backup-<reason>).
#[tauri::command]
pub fn safety_backup_path(app: AppHandle, stamp: String) -> Result<String, String> {
    check_stamp(&stamp)?;
    Ok(display(&data_dir(&app)?.join(format!("{DB_FILE}.backup-before-restore-{stamp}"))))
}

/// Deletes the oldest app-made backups in the folder so that `keep` remain. Other files are
/// never touched. Returns how many were deleted.
#[tauri::command]
pub fn prune_backups(folder: String, keep: usize) -> Result<usize, String> {
    let mut backups: Vec<PathBuf> = std::fs::read_dir(&folder)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| {
            let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            path.is_file() && name.starts_with(BACKUP_PREFIX) && name.ends_with(".db")
        })
        .collect();
    // The names hold the time, so name order is age order. Newest first.
    backups.sort();
    backups.reverse();
    let mut deleted = 0;
    for old in backups.iter().skip(keep.max(1)) {
        if std::fs::remove_file(old).is_ok() {
            deleted += 1;
        }
    }
    Ok(deleted)
}

/// Fails unless the file is an SQLite database.
#[tauri::command]
pub fn check_backup(path: String) -> Result<(), String> {
    let mut header = [0u8; 16];
    std::fs::File::open(&path)
        .and_then(|mut f| f.read_exact(&mut header))
        .map_err(|e| format!("Couldn't read {path}: {e}"))?;
    if &header != b"SQLite format 3\0" {
        return Err(format!("{path} is not a MilestoneSpace backup (not an SQLite database)."));
    }
    Ok(())
}

/// Replaces the database with a backup. The frontend saves a copy of the current data and
/// closes the database connections first, then reloads.
#[tauri::command]
pub fn restore_backup(app: AppHandle, path: String) -> Result<(), String> {
    check_backup(path.clone())?;
    let db = data_dir(&app)?.join(DB_FILE);
    let source = PathBuf::from(&path);
    if source.canonicalize().ok() == db.canonicalize().ok() {
        return Err("That file is the database itself, not a backup.".into());
    }

    // Copy first, so a failure halfway leaves the database as it was.
    let incoming = db.with_extension("db.restoring");
    std::fs::copy(&source, &incoming).map_err(|e| format!("Couldn't copy the backup: {e}"))?;

    // A leftover write-ahead log belongs to the old data and would be applied to the restored
    // file, corrupting it. While a connection is still open Windows refuses the delete, so this
    // also checks that the database is really closed.
    for suffix in ["-wal", "-shm"] {
        let side_file = PathBuf::from(format!("{}{suffix}", db.display()));
        if let Err(e) = std::fs::remove_file(&side_file) {
            if e.kind() != std::io::ErrorKind::NotFound {
                let _ = std::fs::remove_file(&incoming);
                return Err(format!(
                    "The database is still in use, so nothing was changed. Restart MilestoneSpace and try again. ({e})"
                ));
            }
        }
    }

    std::fs::rename(&incoming, &db).map_err(|e| {
        let _ = std::fs::remove_file(&incoming);
        format!("Couldn't replace the database, so nothing was changed: {e}")
    })
}

/// Saves an export (CSV / JSON) to the path picked in the save dialog.
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("Couldn't save {path}: {e}"))
}
