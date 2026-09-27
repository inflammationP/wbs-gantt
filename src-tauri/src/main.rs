// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // The scheduled task's entry point, handled before Tauri is built at all.
  // Sending one message should cost a few milliseconds and never touch a window,
  // a webview or the frontend bundle — so this branch is above `run` rather than
  // inside `setup`, where it would boot the whole application to post a to-do list.
  let args: Vec<String> = std::env::args().collect();
  if args.iter().any(|a| a == "--send-reminder") {
    // The directory is passed in by the task rather than derived here, because
    // only a running Tauri app can ask for the app data directory — and asking
    // would mean starting one. `install_reminder_task` captures it once, from
    // Tauri's own answer, and writes it into the task.
    let dir = args
      .iter()
      .position(|a| a == "--dir")
      .and_then(|i| args.get(i + 1));
    match dir {
      Some(d) => std::process::exit(app_lib::send_due_reminder(std::path::Path::new(d))),
      None => {
        eprintln!("--send-reminder requires --dir");
        std::process::exit(2)
      }
    }
  }



  app_lib::run();
}
