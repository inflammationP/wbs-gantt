mod toast;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::Duration;

use chrono::Datelike;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

/// The name Windows knows the reminder task by.
///
/// Also the string `remove_reminder_task` deletes, which is why it is a constant
/// rather than written twice: a rename that missed one of them would leave a task
/// nobody could remove from inside the app.
const REMINDER_TASK: &str = "WBS Gantt Reminder";

/// Where a digest is posted.
const PUSHPLUS_URL: &str = "https://www.pushplus.plus/send";

/// How long to wait before calling the network unreachable.
///
/// A ceiling on the whole request here, unlike `notify.ts`, which only bounds the
/// connection: this process exists solely to send the message and has nothing else
/// to do if the reply never comes, so there is no reason to sit in Task Scheduler
/// waiting on it either.
const SEND_TIMEOUT: Duration = Duration::from_secs(30);

/// Run a console program without flashing a console window.
///
/// Launched from a GUI process, a console program gets a console of its own that
/// appears on screen. `schtasks` takes well under a second, and that flash would
/// be the only thing the user ever sees of this whole code path.
pub(crate) fn run_hidden(program: &str, args: &[&str]) -> Result<Output, String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output().map_err(|e| format!("{program}: {e}"))
}

/// Where the reminder file and the sender script live.
fn reminder_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data directory: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    Ok(dir)
}

/// Write the rendered digests where the scheduled task will find them.
///
/// Returns the path so the caller can tell the user where it went — the file is
/// readable JSON, and being able to look at it is how a "why did I get that
/// message" question gets answered without a debugger.
#[tauri::command]
fn write_reminder_file(app: tauri::AppHandle, contents: String) -> Result<String, String> {
    let path = reminder_dir(&app)?.join("reminders.json");
    fs::write(&path, contents).map_err(|e| format!("{}: {e}", path.display()))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Raise one toast on demand, for the settings page's test button.
///
/// The same two lines the sender runs. Not a debug hook: the test button's whole
/// job is to answer "will this reach me?", and for the toast channel the honest
/// answer is a real notification — not a green tick beside a switch.
#[tauri::command]
fn show_toast(title: String, body: String, ack: String) -> Result<(), String> {
    toast::ensure_registered()?;
    toast::show(&title, &body, &ack)
}

/// Whether Windows currently has the task registered.
///
/// Asked rather than remembered. The task can be deleted from Task Scheduler, and
/// a stored flag would then hide the button that puts it back.
#[tauri::command]
fn reminder_task_installed() -> Result<bool, String> {
    Ok(run_hidden("schtasks", &["/Query", "/TN", REMINDER_TASK])?.status.success())
}

/// Register this executable with Windows, to be run every fifteen minutes.
///
/// The task runs *this program* with `--send-reminder`, not a script. The first
/// version of this shipped a PowerShell sender, which cannot work on a default
/// Windows machine: the client execution policy is `Restricted`, so the task has
/// to pass `-ExecutionPolicy Bypass` to run a `.ps1` at all — an override of a
/// security control, arriving quietly inside an installer, in order to deliver a
/// to-do list. Running our own binary asks for no such thing, and it deletes the
/// PowerShell encoding trap along with the script: `reqwest` sends UTF-8 because
/// that is what JSON is, with no `[Text.Encoding]::UTF8.GetBytes` to forget.
///
/// Registered at the current user's level, so no elevation prompt: the task runs
/// as this user, which is also what it needs to be — the reminder file is in this
/// user's profile and the network is this user's.
#[tauri::command]
fn install_reminder_task(app: tauri::AppHandle) -> Result<(), String> {
    // Never from a debug build, and the frontend's own `import.meta.env.DEV`
    // check is not enough on its own: `tauri build --debug` has that flag false
    // and `debug_assertions` true, so the frontend would happily register a task
    // pointing at a binary that only exists while someone is developing.
    //
    // The damage is a console window. The subsystem attribute in `main.rs` is
    // `cfg_attr(not(debug_assertions), windows_subsystem = "windows")`, so a
    // debug `app.exe` is a *console* program — Task Scheduler launches it and a
    // black window appears and vanishes, every fifteen minutes, forever. There
    // was one of these on this machine, pointing at `target\debug\app.exe`.
    if cfg!(debug_assertions) {
        return Err("this is a debug build; the reminder task is only registered by an installed copy".into());
    }
    let dir = reminder_dir(&app)?;
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;

    // Both paths are quoted because both routinely contain spaces — "Program
    // Files", and a Windows account named after a person. `schtasks` takes the
    // whole action as one argument, so the inner quotes survive into the task.
    let action = format!(
        "\"{}\" --send-reminder --dir \"{}\"",
        exe.display(),
        dir.display()
    );
    let out = run_hidden(
        "schtasks",
        &[
            "/Create", "/F", "/SC", "MINUTE", "/MO", "15", "/TN", REMINDER_TASK, "/TR", &action,
        ],
    )?;
    if out.status.success() {
        return Ok(());
    }
    // The reason is worth surfacing rather than swallowing: on a managed machine
    // `schtasks` is refused by policy, and "access is denied" tells the user
    // something an invented message would not. A greatly over-long `/TR` shows up
    // here too, as the command line has a ceiling of its own.
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if err.is_empty() {
        format!("schtasks exited with {}", out.status)
    } else {
        err
    })
}

/// Post today's digest, if the settings say it is due. Returns a process exit code.
///
/// Reached only through `--send-reminder`, from the scheduled task, in a process
/// that never builds a window. Everything it needs is in `reminders.json`, which
/// the app renders while it is open — the rules behind the digest stay in
/// TypeScript and are not re-implemented here.
///
/// Failures are written to `send-error.txt` as well as returned, because in a
/// release build this is a GUI-subsystem process with no console attached: an
/// `eprintln!` would go nowhere, and "my reminders stopped arriving" is exactly
/// the question that needs an answer on disk.
pub fn send_due_reminder(dir: &Path) -> i32 {
    match try_send_due_reminder(dir) {
        Ok(()) => 0,
        Err(why) => {
            let _ = fs::write(dir.join("send-error.txt"), format!("{why}\n"));
            1
        }
    }
}

fn try_send_due_reminder(dir: &Path) -> Result<(), String> {
    let raw = match fs::read_to_string(dir.join("reminders.json")) {
        Ok(r) => r,
        // No file yet is the ordinary state before the app has ever run, not a
        // failure worth recording.
        Err(_) => return Ok(()),
    };
    let data: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("reminders.json is not JSON: {e}"))?;

    // The one thing this reader insists on. Everything below reaches into a
    // shape, and a shape it does not recognise is not empty, it is *wrong*: the
    // v1 file held one message per day where this one holds a list per rule, so
    // reading v1 here would find no window to match, call every rule empty, and
    // silently mark the day done without anything ever being shown.
    if data["version"].as_u64() != Some(2) {
        return Err(format!(
            "reminders.json is version {}, which this build cannot read",
            data["version"]
        ));
    }

    // The desktop notification is what the app does, not something it offers, so
    // it is not conditional on anything here. The WeChat copy is the optional
    // half, and it needs both the switch and a token: asked for without one, it
    // is not a destination, and counting it as one would mark the day sent having
    // sent nothing.
    let token = data["settings"]["token"].as_str().unwrap_or("").trim().to_owned();
    let wants_pushplus = data["settings"]["wechat"].as_bool() == Some(true) && !token.is_empty();
    // The button's label, written by the app in whatever language it is in. This
    // process has no dictionary, which is the same reason the tray's two labels
    // are pushed down from the frontend rather than looked up here.
    let ack = data["settings"]["ack"].as_str().unwrap_or(toast::ACK_FALLBACK);

    let now = chrono::Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let clock = now.format("%H:%M").to_string();
    // 0 = Monday, the convention `Habit.weekdays` and this file both use.
    let weekday = now.weekday().num_days_from_monday() as u64;

    let mut sent = read_sent(dir, &today);
    let mut failures: Vec<String> = Vec::new();
    let mut added = false;

    // Every rule whose time has come and which has not gone out yet.
    let rules = data["rules"].as_array().cloned().unwrap_or_default();
    let mut due: Vec<(String, String)> = Vec::new();
    for rule in &rules {
        let id = rule["id"].as_str().unwrap_or("").to_owned();
        let at = rule["time"].as_str().unwrap_or("").to_owned();
        if id.is_empty() || at.is_empty() {
            continue;
        }
        let runs_today = rule["weekdays"]
            .as_array()
            .is_some_and(|d| d.iter().any(|x| x.as_u64() == Some(weekday)));
        // Not yet its time. Compared as strings, which is what zero-padded
        // `HH:mm` is for: "07:00" < "12:30" holds without parsing either. A
        // machine that was off at seven fires on the next tick rather than
        // losing the send, because by then the comparison has turned over — and
        // it then picks its wording from the clock, not from this time.
        if !runs_today || clock.as_str() < at.as_str() || sent.iter().any(|r| r == &id) {
            continue;
        }
        due.push((id, at));
    }
    due.sort_by(|a, b| a.1.cmp(&b.1));

    // Only the last of them fires.
    //
    // A machine that was off across two send times has two — or three — rules
    // due at once, and all of them would pick the *same* window, so all of them
    // would say the same thing. Three copies of one notification is how this was
    // reported. The earlier ones are marked as missed rather than sent: they were
    // opportunities to speak at a moment that has passed, and the day has moved
    // on from them.
    let missed = due.pop();
    for (id, _) in due {
        sent.push(id);
        added = true;
    }

    if let Some((id, _)) = missed {
        // Which message this minute falls in. The window travels with each
        // message, so nothing here knows what a slot is — see `SlotDigest`.
        let found = data["digests"]
            .get(&today)
            .and_then(|d| d.get(&id))
            .and_then(|m| m.as_array())
            .and_then(|list| {
                list.iter().find(|m| {
                    let from = m["from"].as_str().unwrap_or("");
                    let to = m["to"].as_str().unwrap_or("");
                    let t = clock.as_str();
                    !from.is_empty() && t >= from && t < to
                })
            });

        // Due, and this hour has nothing to say — a quiet noon is the ordinary
        // case, not a failure. Marked rather than skipped: the task fires every
        // fifteen minutes and this is the branch that would otherwise re-open
        // the same empty question for the rest of the day.
        let title = found.and_then(|m| m["title"].as_str()).unwrap_or("");
        let body = found.and_then(|m| m["body"].as_str()).unwrap_or("");

        if found.is_none() {
            sent.push(id);
            added = true;
        } else {
            // Each destination is attempted independently and neither can stop
            // the other. A phone message and a desktop notification are two
            // chances to be reminded, and losing one is no reason to lose the
            // other — but if *nothing* lands this rule must not be marked, or a
            // dead network would silently eat that send with no retry.
            let mut delivered = false;
            // Registered every time rather than once at install: this is the one
            // failure that produces no error anywhere — Windows just accepts
            // nothing from an identity it does not know — so it is cheaper to
            // re-assert the key than to debug a notification that never appeared.
            match toast::ensure_registered().and_then(|()| toast::show(title, body, ack)) {
                Ok(()) => delivered = true,
                Err(e) => failures.push(format!("toast: {e}")),
            }
            if wants_pushplus {
                match push_pushplus(&token, title, body) {
                    Ok(()) => delivered = true,
                    Err(e) => failures.push(format!("pushplus: {e}")),
                }
            }
            if delivered {
                sent.push(id);
                added = true;
            }
        }
    }

    // Written only once something was settled, so a failure is retried on the
    // next tick instead of being swallowed for the rest of the day.
    if added {
        let payload = serde_json::json!({ "day": today, "rules": sent });
        fs::write(dir.join("sent.json"), payload.to_string()).map_err(|e| format!("sent.json: {e}"))?;
    }

    // A partial delivery still counts, but the channel that failed is worth
    // leaving on disk — the user only sees half of what they asked for, and
    // nothing else in the app would ever tell them which half.
    if failures.is_empty() {
        if added {
            let _ = fs::remove_file(dir.join("send-error.txt"));
        }
        Ok(())
    } else {
        let message = failures.join("\n") + "\n";
        let _ = fs::write(dir.join("send-error.txt"), &message);
        Err(message)
    }
}

/// Which rules have already gone out today.
///
/// The file holds one day and nothing else, so a date that is not today is a
/// clean slate rather than something to prune: there is no history worth keeping
/// and no way for yesterday's list to suppress today's send.
fn read_sent(dir: &Path, today: &str) -> Vec<String> {
    let Ok(raw) = fs::read_to_string(dir.join("sent.json")) else {
        return Vec::new();
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return Vec::new();
    };
    if v["day"].as_str() != Some(today) {
        return Vec::new();
    }
    v["rules"]
        .as_array()
        .map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_owned)).collect())
        .unwrap_or_default()
}

/// Post one digest to PushPlus.
fn push_pushplus(token: &str, title: &str, body: &str) -> Result<(), String> {
    let payload = serde_json::json!({
        "token": token,
        "title": title,
        "content": body,
        "template": "txt",
    });
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(SEND_TIMEOUT)
        .build()
        .map_err(|e| format!("http client: {e}"))?;

    let res = client
        .post(PUSHPLUS_URL)
        .json(&payload)
        .send()
        .map_err(|e| format!("send: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("pushplus answered HTTP {}", res.status()));
    }

    // PushPlus answers 200 at the transport level and puts the real outcome in
    // `code`, so a rejected token arrives as a *successful* HTTP response.
    let reply: serde_json::Value = res.json().map_err(|e| format!("unreadable reply: {e}"))?;
    if reply["code"].as_i64() != Some(200) {
        let msg = reply["msg"].as_str().unwrap_or("no message");
        return Err(format!("pushplus code {}: {msg}", reply["code"]));
    }
    Ok(())
}

#[tauri::command]
fn remove_reminder_task() -> Result<(), String> {
    let out = run_hidden("schtasks", &["/Delete", "/F", "/TN", REMINDER_TASK])?;
    if out.status.success() {
        return Ok(());
    }
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if err.is_empty() {
        format!("schtasks exited with {}", out.status)
    } else {
        err
    })
}

/// Rebuild the tray menu in the interface's language.
///
/// Two strings, passed from the frontend rather than looked up here: the
/// dictionaries live in TypeScript and the language is a preference, so the Rust
/// side has no way to know either. Without this the menu would be the one part of
/// the app that stayed English whatever the user chose.
#[tauri::command]
fn set_tray_labels(app: tauri::AppHandle, open: String, quit: String) -> Result<(), String> {
    let tray = app.tray_by_id("main").ok_or("tray icon is not mounted")?;
    let menu = tray_menu(&app, &open, &quit).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

/// Bring the main window back to the front.
///
/// `show` alone does not undo a minimize — Windows restores a minimized window
/// only when asked to — so a window sitting minimized in the taskbar would stay
/// there while this appeared to do nothing. Both callers below are "the user is
/// asking for the window again", so they both need the unminimize.
fn reveal_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn tray_menu(app: &tauri::AppHandle, open: &str, quit: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let open_item = MenuItem::with_id(app, "open", open, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", quit, true, None::<&str>)?;
    Menu::with_items(app, &[&open_item, &quit_item])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // First, and it has to be first: this plugin has to claim the instance
        // before anything else in the builder starts up, and its whole job is to
        // keep a second copy of the app from starting at all. Without it,
        // clicking the desktop shortcut while the app was already running —
        // minimized, or hidden in the tray from a `--hidden` boot — started a
        // *second* process, which dutifully showed its own window. Two windows,
        // two copies of the same file, and the one already on screen never came
        // back. Now the second launch hands its arguments to the first and exits;
        // the callback below is the first one being told to come forward.
        //
        // `--send-reminder` is untouched by this: it exits from `main` before
        // `run` is ever called, so the scheduled task has no window to raise and
        // no first instance to talk to.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            reveal_main_window(app);
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Hands external links to the system browser. Without it an <a href> in the
        // webview goes nowhere, which matters here because the settings page offers
        // a download link to a tool that exists precisely for users whose GitHub
        // access is blocked — telling them to copy a URL by hand would be a joke.
        .plugin(tauri_plugin_opener::init())
        // Launched with `--hidden` when Windows starts it, so a boot does not put
        // a Gantt chart in front of someone who was on their way to their mail.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        // Requests leave through Rust rather than the webview. PushPlus returns no
        // CORS headers, so a cross-origin POST from the webview is refused by
        // origin policy before it is ever sent — which no amount of retrying fixes.
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            write_reminder_file,
            show_toast,
            reminder_task_installed,
            install_reminder_task,
            remove_reminder_task,
            set_tray_labels,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // The window is built hidden (see tauri.conf.json) so that the boot
            // case never flashes one. Every other launch shows it immediately.
            let hidden = std::env::args().any(|a| a == "--hidden");
            if let Some(window) = app.get_webview_window("main") {
                if !hidden {
                    window.show()?;
                }
            }

            // The tray is the way back to a window that is not on screen: the
            // `--hidden` boot case, and every close while "close to tray" is on.
            // The reminders do not depend on this process either way — Task
            // Scheduler has its own copy of the sender, so nothing here has to
            // stay alive for them.
            //
            // No `.unwrap()` on the icon: it reads the build's own `bundle.icon`
            // list, so a missing or renamed entry would panic here and the app
            // would fail to start — a cosmetic tray icon taking the whole program
            // down with it. Failed, the tray is simply absent, and a `--hidden`
            // launch is recovered by relaunching from the Start menu instead.
            if let Some(icon) = app.default_window_icon() {
                TrayIconBuilder::with_id("main")
                    .icon(icon.clone())
                    // English until the frontend says otherwise, which happens on
                    // the first render — `set_tray_labels` is what makes it follow
                    // the language setting.
                    .menu(&tray_menu(app.handle(), "Open WBS Gantt", "Quit")?)
                    // The menu moves to the right button; the left one opens the
                    // window, which is what a tray icon is expected to do.
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        // The release, not the press: Windows sends both, and
                        // acting on both would reveal twice per click.
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            reveal_main_window(tray.app_handle());
                        }
                    })
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => reveal_main_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
