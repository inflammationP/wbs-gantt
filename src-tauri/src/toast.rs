//! Windows toast notifications for the reminder digest.
//!
//! A channel alongside PushPlus, and the only one that needs no account, no
//! network and no third party. It is also the one with a trap in it.
//!
//! An unpackaged Win32 program cannot raise a toast under its own name. Windows
//! decides what a notification is *from* by its AppUserModelID, and for a program
//! with no installer-registered identity that lookup fails — `CreateToastNotifier`
//! then does nothing at all, silently, with no error to catch. The fix is a single
//! registry key, which `ensure_registered` writes.
//!
//! `notify-rust` will fall back to PowerShell's AppUserModelID when none is given,
//! which does work — and would put every reminder on screen signed
//! "Windows PowerShell". That is why the fallback is never used here.

use crate::run_hidden;

/// The identity the toast is raised under. The bundle identifier, so the thing
/// Windows shows the user is the same string the app is installed as.
const APP_ID: &str = "com.wbsgantt.app";

/// What Windows displays as the sender. Written per-user, so no elevation.
const DISPLAY_NAME: &str = "WBS Gantt";

const KEY: &str = r"HKCU\SOFTWARE\Classes\AppUserModelId\com.wbsgantt.app";

/// Give the app an identity Windows will accept a toast from.
///
/// Idempotent — `reg add /f` overwrites — and cheap enough to call on every
/// launch rather than only at install time. That is deliberate: the reminder is
/// sent by `--send-reminder`, a process that never goes through the installer's
/// steps, and a notification that silently does nothing because a key went
/// missing is the failure mode this whole module exists to avoid.
pub fn ensure_registered() -> Result<(), String> {
    let out = run_hidden(
        "reg",
        &[
            "add", KEY, "/v", "DisplayName", "/t", "REG_SZ", "/d", DISPLAY_NAME, "/f",
        ],
    )?;
    if out.status.success() {
        return Ok(());
    }
    Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
}

/// The label on the acknowledgement button, for the one caller that has no
/// dictionary to ask.
///
/// `--send-reminder` is a separate process with no frontend, so it cannot look
/// this up the way the settings page does. It will come out of `reminders.json`
/// once that file is read at v2; until then this is what a scheduled
/// notification says, and the preview — which does have the dictionary — already
/// passes the right one for whatever language the app is in.
pub const ACK_FALLBACK: &str = "我知道了";

/// Raise one toast, with a button to acknowledge it.
///
/// `Urgency::Critical` is doing the real work here: `notify-rust` maps it to
/// Windows' *reminder* scenario, which is the difference between a banner that
/// slides away after five seconds and one that stays on screen until it is dealt
/// with. The button is the other half of the same idea — a notification you are
/// meant to acknowledge should have something to acknowledge it with, rather
/// than leaving dismissal to the small × that Windows draws in the corner.
///
/// Returns once Windows has been handed it, not once it is seen. Nothing waits
/// for the click: the shell owns the toast from here, and there is no state on
/// this side that a click would change.
pub fn show(title: &str, body: &str, ack: &str) -> Result<(), String> {
    notify_rust::Notification::new()
        .app_id(APP_ID)
        .summary(title)
        .body(body)
        .urgency(notify_rust::Urgency::Critical)
        .timeout(notify_rust::Timeout::Never)
        .action("ack", ack)
        .show()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
