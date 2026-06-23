; Kill Aurora and its backend sidecar before installing files.
; Without this, the frozen Python backend locks .pyd files and the
; installer hits "Error opening file for writing" on every reinstall.

!macro NSIS_HOOK_PREINSTALL
  ; Kill the main app first — this triggers Rust's on_window_event cleanup
  ; which sends SIGKILL to the sidecar, but we kill both defensively.
  nsExec::Exec 'taskkill /F /IM Aurora.exe'
  nsExec::Exec 'taskkill /F /IM aurora-backend.exe'
  ; Give processes time to release file locks
  Sleep 1500
!macroend
