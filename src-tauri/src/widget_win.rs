//! Keeps the Today widget on screen through "Show desktop" (Win+D, or the far end of the taskbar).
//! Windows minimizes every window then, the widget too, and brings the desktop to the front. Two
//! system event hooks undo that, the way desktop widget apps (Rainmeter) do: a minimized widget comes
//! straight back without taking the focus, and while the desktop is in front the widget is raised
//! above it. When another app comes to the front, the widget goes back to its own layer.
//! The hooks only get events (no polling), on the main thread's message loop.

use crate::{settings::SettingsState, WIDGET};
use std::sync::{
    atomic::{AtomicBool, AtomicIsize, Ordering},
    OnceLock,
};
use tauri::{AppHandle, Manager, WebviewWindow};
use windows::Win32::{
    Foundation::HWND,
    System::Threading::GetCurrentProcessId,
    UI::{
        Accessibility::{SetWinEventHook, HWINEVENTHOOK},
        WindowsAndMessaging::{
            GetClassNameW, IsWindowVisible, ShowWindowAsync, EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZESTART,
            OBJID_WINDOW, SW_SHOWNOACTIVATE, WINEVENT_OUTOFCONTEXT,
        },
    },
};

static APP: OnceLock<AppHandle> = OnceLock::new();
/// The widget's window handle, 0 until it's first built (it's never destroyed after that, only hidden).
static WIDGET_HWND: AtomicIsize = AtomicIsize::new(0);
/// The desktop is in front, so the widget is raised above it.
static RAISED: AtomicBool = AtomicBool::new(false);

/// Starts listening. Call once from setup (the main thread, whose message loop delivers the events).
pub fn install(app: &AppHandle) {
    let _ = APP.set(app.clone());
    unsafe {
        // Any app coming to the front, and minimizes in this app only.
        SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, None, Some(on_event), 0, 0, WINEVENT_OUTOFCONTEXT);
        let pid = GetCurrentProcessId();
        SetWinEventHook(EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZESTART, None, Some(on_event), pid, 0, WINEVENT_OUTOFCONTEXT);
    }
}

/// Remembers the widget's window once it's built.
pub fn track(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        WIDGET_HWND.store(hwnd.0 as isize, Ordering::Relaxed);
    }
}

fn class_name(hwnd: HWND) -> String {
    let mut buf = [0u16; 64];
    let len = unsafe { GetClassNameW(hwnd, &mut buf) };
    String::from_utf16_lossy(&buf[..len.max(0) as usize])
}

unsafe extern "system" fn on_event(_: HWINEVENTHOOK, event: u32, hwnd: HWND, id_object: i32, _: i32, _: u32, _: u32) {
    let widget = HWND(WIDGET_HWND.load(Ordering::Relaxed) as _);
    // Nothing to do while the widget is off (hidden). A minimized window still counts as visible.
    if id_object != OBJID_WINDOW.0 || widget.is_invalid() || !unsafe { IsWindowVisible(widget) }.as_bool() {
        return;
    }
    if event == EVENT_SYSTEM_MINIMIZESTART {
        if hwnd == widget {
            unsafe {
                let _ = ShowWindowAsync(widget, SW_SHOWNOACTIVATE);
            }
        }
        return;
    }
    // The desktop is WorkerW or Progman; the taskbar and the widget itself (clicked while the
    // desktop is shown) leave the widget where it is.
    let raise = match class_name(hwnd).as_str() {
        "WorkerW" | "Progman" => true,
        "Shell_TrayWnd" | "Shell_SecondaryTrayWnd" => return,
        _ if hwnd == widget => return,
        _ => false,
    };
    if RAISED.swap(raise, Ordering::Relaxed) == raise {
        return;
    }
    if raise {
        unsafe {
            let _ = ShowWindowAsync(widget, SW_SHOWNOACTIVATE);
        }
    }
    // Changing the layer goes through Tauri: its window code keeps an "always on bottom" window at
    // the bottom. Done off this callback so Tauri queues it on the event loop, and it applies
    // whatever RAISED is by then, so quick changes can't end in the wrong layer.
    if let Some(app) = APP.get().cloned() {
        tauri::async_runtime::spawn(async move { apply_layer(&app) });
    }
}

fn apply_layer(app: &AppHandle) {
    let Some(window) = app.get_webview_window(WIDGET) else { return };
    if RAISED.load(Ordering::Relaxed) {
        let _ = window.set_always_on_bottom(false);
        let _ = window.set_always_on_top(true);
    } else if !app.state::<SettingsState>().get().widget_on_top {
        let _ = window.set_always_on_top(false);
        let _ = window.set_always_on_bottom(true);
    }
}
