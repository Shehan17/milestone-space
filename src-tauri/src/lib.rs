mod data;
mod settings;
#[cfg(windows)]
mod widget_win;

use settings::{Settings, SettingsState};
use std::sync::Mutex;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

/// Passed by the "start with Windows" entry: start in the tray without showing the window.
const HIDDEN_ARG: &str = "--hidden";

/// Opens the quick capture box from anywhere, unless changed on the Settings page. The dev build
/// uses Ctrl+Alt+Shift+Space so it can run next to the installed app.
/// Keep DEFAULT_QUICK_CAPTURE_KEYS in src/lib/settings.svelte.ts the same.
const DEFAULT_QUICK_CAPTURE_KEYS: &str = if cfg!(debug_assertions) { "Ctrl+Alt+Shift+Space" } else { "Ctrl+Shift+Space" };

/// The registered quick capture shortcut (None if registering failed), and the tray menu item
/// that shows its keys.
struct QuickCapture {
    shortcut: Mutex<Option<Shortcut>>,
    menu_item: MenuItem<Wry>,
}

fn tray_capture_label(keys: &str) -> String {
    format!("Quick capture\t{keys}")
}

/// "Ctrl+Shift+K" style text to a shortcut. Needs Ctrl, Alt or Win, so it can't take over typing.
fn parse_shortcut(keys: &str) -> Result<Shortcut, String> {
    let shortcut: Shortcut = keys.parse().map_err(|_| format!("{keys} isn't a shortcut that can be used."))?;
    let upper = keys.to_uppercase();
    if !upper.split('+').any(|part| ["CTRL", "ALT", "SUPER"].contains(&part.trim())) {
        return Err("Use at least Ctrl, Alt or Win in the shortcut.".into());
    }
    Ok(shortcut)
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Shows the quick capture box (route /quick), or hides it if it's already in front.
/// The window is created on first use and then only hidden, so later opens are instant.
fn toggle_quick_capture(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("quick") {
        if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
        }
        return;
    }
    let built = WebviewWindowBuilder::new(app, "quick", WebviewUrl::App("quick".into()))
        .title("Quick capture")
        .inner_size(680.0, 152.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .focused(true)
        .build();
    if let Err(e) = built {
        eprintln!("Couldn't open the quick capture window: {e}");
    }
}

/// The Today widget: a small window with today's plan (route /widget), shown while the
/// show_widget setting is on. The window-state plugin keeps its position and size.
const WIDGET: &str = "widget";
const WIDGET_STATE: StateFlags = StateFlags::POSITION.union(StateFlags::SIZE);
const WIDGET_WIDTH: f64 = 340.0;
const WIDGET_HEIGHT: f64 = 440.0;

/// The tray menu's "Today widget" check, kept in step with the show_widget setting.
struct WidgetMenu(CheckMenuItem<Wry>);

/// Tells every window about settings changed here (the widget, from the tray or its own menu).
fn broadcast_settings(app: &AppHandle) {
    let _ = app.emit("settings-changed", app.state::<SettingsState>().get());
}

/// Shows the widget, creating it on first use. It doesn't take the focus, so starting the app
/// or turning it on never pulls you out of what you're typing.
fn show_widget(app: &AppHandle, on_top: bool) {
    if let Some(window) = app.get_webview_window(WIDGET) {
        // A minimized widget (widget_win.rs keeps Win+D from leaving it so) needs more than showing.
        let _ = window.unminimize();
        let _ = window.show();
        return;
    }
    let mut builder = WebviewWindowBuilder::new(app, WIDGET, WebviewUrl::App("widget".into()))
        .title("Today")
        .inner_size(WIDGET_WIDTH, WIDGET_HEIGHT)
        .min_inner_size(260.0, 200.0)
        .decorations(false)
        .maximizable(false)
        .minimizable(false)
        .skip_taskbar(true)
        .focused(false)
        .always_on_top(on_top)
        .always_on_bottom(!on_top);
    // The first time: the top right of the main screen. After that the window-state plugin puts
    // it back where it was left (or here again if that screen is gone).
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let area = monitor.work_area();
        let scale = monitor.scale_factor();
        let x = (area.position.x as f64 + area.size.width as f64) / scale - WIDGET_WIDTH - 24.0;
        let y = area.position.y as f64 / scale + 24.0;
        builder = builder.position(x, y);
    }
    match builder.build() {
        #[cfg(windows)]
        Ok(window) => widget_win::track(&window),
        #[cfg(not(windows))]
        Ok(_) => {}
        Err(e) => eprintln!("Couldn't open the Today widget: {e}"),
    }
}

/// Shows or hides the widget and remembers the choice for the next start.
fn set_widget(app: &AppHandle, shown: bool) -> Result<(), String> {
    let settings = app.state::<SettingsState>();
    if shown {
        show_widget(app, settings.get().widget_on_top);
    } else if let Some(window) = app.get_webview_window(WIDGET) {
        let _ = app.save_window_state(WIDGET_STATE);
        let _ = window.hide();
    }
    let _ = app.state::<WidgetMenu>().0.set_checked(shown);
    settings.update(|s| s.show_widget = shown)?;
    broadcast_settings(app);
    Ok(())
}

// The widget commands are async on purpose: a command without `async` runs on the main thread, and
// creating a window there deadlocks on Windows (WebView2 needs that thread). The app freezes with a
// white widget.

#[tauri::command]
async fn set_widget_shown(app: AppHandle, shown: bool) -> Result<(), String> {
    set_widget(&app, shown)
}

/// Keeps the widget above other windows, or puts it on the desktop behind them.
#[tauri::command]
async fn set_widget_on_top(app: AppHandle, on_top: bool) -> Result<(), String> {
    let settings = app.state::<SettingsState>();
    if let Some(window) = app.get_webview_window(WIDGET) {
        // Clear the old layer first: a window can't be on top and at the bottom at once.
        if on_top {
            let _ = window.set_always_on_bottom(false);
            let _ = window.set_always_on_top(true);
        } else {
            let _ = window.set_always_on_top(false);
            let _ = window.set_always_on_bottom(true);
        }
    }
    settings.update(|s| s.widget_on_top = on_top)?;
    broadcast_settings(&app);
    Ok(())
}

/// Saves the widget's position and size (the widget calls it after being moved or resized), so
/// they're kept even if Windows ends the app without a normal exit.
#[tauri::command]
async fn save_widget_state(app: AppHandle) -> Result<(), String> {
    app.save_window_state(WIDGET_STATE).map_err(|e| e.to_string())
}

/// Brings the main window to the front, on `path` if given (the widget opens a task's project).
#[tauri::command]
async fn open_main(app: AppHandle, path: Option<String>) {
    show_main(&app);
    if let Some(path) = path {
        let _ = app.emit_to("main", "navigate", path);
    }
}

/// Opens a folder in VS Code through its `code` command (installed on PATH by VS Code's setup).
#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).is_dir() {
        return Err(format!("Folder not found: {path}"));
    }
    let mut command = std::process::Command::new(if cfg!(windows) { "code.cmd" } else { "code" });
    command.arg(&path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000; // no console window flashing up
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command.spawn().map(|_| ()).map_err(|e| {
        format!("Couldn't start VS Code ({e}). Make sure the `code` command is installed: in VS Code, run \"Shell Command: Install 'code' command in PATH\".")
    })
}

#[tauri::command]
fn get_settings(state: State<SettingsState>) -> Settings {
    state.get()
}

/// Saves the settings sent by the frontend. The quick capture keys and the widget settings only
/// change through their own commands (which also act on them), so a window with an older copy
/// can't undo them.
#[tauri::command]
fn save_settings(state: State<SettingsState>, settings: Settings) -> Result<(), String> {
    state.update(|current| {
        let keys = current.quick_capture_keys.take();
        let (show_widget, widget_on_top) = (current.show_widget, current.widget_on_top);
        *current = settings;
        current.quick_capture_keys = keys;
        current.show_widget = show_widget;
        current.widget_on_top = widget_on_top;
    })
}

/// Changes the quick capture keys (None: back to the default). If the new keys can't be
/// registered (usually because another app uses them) the old ones stay. Returns the keys in use.
#[tauri::command]
fn set_quick_capture_keys(
    app: AppHandle,
    quick: State<QuickCapture>,
    settings: State<SettingsState>,
    keys: Option<String>,
) -> Result<String, String> {
    let text = keys.clone().unwrap_or_else(|| DEFAULT_QUICK_CAPTURE_KEYS.to_string());
    let new = parse_shortcut(&text)?;
    let mut current = quick.shortcut.lock().unwrap();
    if *current != Some(new) {
        let shortcuts = app.global_shortcut();
        if let Some(old) = *current {
            let _ = shortcuts.unregister(old);
        }
        if let Err(e) = shortcuts.register(new) {
            if let Some(old) = *current {
                let _ = shortcuts.register(old);
            }
            return Err(format!("Couldn't use {text}. Another app may already use it. ({e})"));
        }
        *current = Some(new);
        let _ = quick.menu_item.set_text(tray_capture_label(&text));
    }
    settings.update(|s| s.quick_capture_keys = keys)?;
    Ok(text)
}

/// The installed app turns "start with Windows" on the first time it runs. After that the
/// Settings page owns the choice, so turning it off sticks.
#[cfg(not(debug_assertions))]
fn enable_autostart_once(app: &AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    let Ok(dir) = app.path().app_data_dir() else { return };
    let marker = dir.join("autostart-configured");
    if !marker.exists() && app.autolaunch().enable().is_ok() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(marker, "");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Opening the app again (Start menu, autostart) focuses the running one instead of starting a
    // second copy. Release only: the dev build shares the identifier and must run next to it.
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)));

    builder
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().args([HIDDEN_ARG]).build())
        // Only the widget's position and size are kept. The dev build has its own file.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(WIDGET_STATE)
                .with_denylist(&["main", "quick"])
                .with_filename(if cfg!(debug_assertions) { "window-state-dev.json" } else { "window-state.json" })
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_quick_capture(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            open_in_vscode,
            get_settings,
            save_settings,
            set_quick_capture_keys,
            set_widget_shown,
            set_widget_on_top,
            save_widget_state,
            open_main,
            data::app_paths,
            data::new_backup_path,
            data::safety_backup_path,
            data::prune_backups,
            data::check_backup,
            data::restore_backup,
            data::write_text_file,
        ])
        .setup(|app| {
            let handle = app.handle();
            let settings = SettingsState::load(app.path().app_config_dir()?);
            let current = settings.get();
            app.manage(settings);

            // Another program (or the other build) may already own the keys: log it and carry on.
            // The Settings page can pick other keys.
            let keys = current.quick_capture_keys.clone().unwrap_or_else(|| DEFAULT_QUICK_CAPTURE_KEYS.to_string());
            let shortcut = parse_shortcut(&keys).and_then(|shortcut| {
                app.global_shortcut().register(shortcut).map(|()| shortcut).map_err(|e| e.to_string())
            });
            if let Err(e) = &shortcut {
                eprintln!("Couldn't register the quick capture shortcut {keys}: {e}");
            }

            // Tray icon: click to open the window, right-click for the menu.
            let open = MenuItem::with_id(app, "open", "Open MilestoneSpace", true, None::<&str>)?;
            let capture = MenuItem::with_id(app, "capture", tray_capture_label(&keys), true, None::<&str>)?;
            let widget = CheckMenuItem::with_id(app, "widget", "Today widget", true, current.show_widget, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &capture, &widget, &quit])?;
            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip(if cfg!(debug_assertions) { "MilestoneSpace (dev)" } else { "MilestoneSpace" })
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "capture" => toggle_quick_capture(app),
                    "widget" => {
                        let shown = !app.state::<SettingsState>().get().show_widget;
                        if let Err(e) = set_widget(app, shown) {
                            eprintln!("Couldn't change the Today widget: {e}");
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            app.manage(QuickCapture { shortcut: Mutex::new(shortcut.ok()), menu_item: capture });
            app.manage(WidgetMenu(widget));

            // Keeps the widget on screen through Win+D.
            #[cfg(windows)]
            widget_win::install(handle);

            // The widget comes back if it was on, also when started with Windows into the tray.
            if current.show_widget {
                show_widget(handle, current.widget_on_top);
            }

            #[cfg(not(debug_assertions))]
            enable_autostart_once(handle);

            // The main window starts hidden (tauri.conf.json). Started with Windows, it stays in the
            // tray unless "Start minimized" is turned off.
            let started_with_windows = std::env::args().any(|arg| arg == HIDDEN_ARG);
            if !(started_with_windows && current.start_minimized) {
                show_main(handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Alt+F4 on the widget turns it off like "Hide widget" (it stays a hidden window), so the
            // setting, the tray check and the Today button stay right.
            if window.label() == WIDGET {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Err(e) = set_widget(window.app_handle(), false) {
                        eprintln!("Couldn't hide the Today widget: {e}");
                    }
                }
            }
            // Closing the main window hides it to the tray (Quit is in the tray menu), or quits
            // when "Close to tray" is off on the Settings page.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if window.state::<SettingsState>().get().close_to_tray {
                        let _ = window.hide();
                    } else {
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
