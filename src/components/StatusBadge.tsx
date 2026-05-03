// StatusBadge — отображает статус ресурса.
// Поддерживает оба naming convention:
//   STATUS_* (sub-phase 1.0 flat API)
//   STATE_*  (legacy 0.x envelope API)

import { cn } from "@/lib/utils";

const STATE_STYLES: Record<string, string> = {
  // ===== STATUS_* (1.0) =====
  // active / ready / running
  STATUS_ACTIVE: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  STATUS_READY: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  STATUS_RUNNING: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  STATUS_RESERVED: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",

  // creating / provisioning / starting
  STATUS_CREATING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATUS_PROVISIONING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATUS_STARTING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATUS_ATTACHING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATUS_UPDATING: "bg-sky-100 text-sky-800 ring-sky-300/70",

  // stopping / deleting
  STATUS_STOPPING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  STATUS_DETACHING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  STATUS_DELETING: "bg-amber-100 text-amber-800 ring-amber-300/70",

  // stopped
  STATUS_STOPPED: "bg-zinc-100 text-zinc-700 ring-zinc-300/70",
  STATUS_RELEASED: "bg-zinc-100 text-zinc-700 ring-zinc-300/70",

  // error
  STATUS_ERROR: "bg-rose-100 text-rose-800 ring-rose-300/70",

  // in use
  STATUS_IN_USE: "bg-violet-100 text-violet-800 ring-violet-300/70",

  // ===== Bare status names (без префикса, для совместимости) =====
  ACTIVE: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  READY: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  RUNNING: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  RESERVED: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",

  CREATING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  PROVISIONING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STARTING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  ATTACHING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  UPDATING: "bg-sky-100 text-sky-800 ring-sky-300/70",

  STOPPING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  DETACHING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  DELETING: "bg-amber-100 text-amber-800 ring-amber-300/70",

  STOPPED: "bg-zinc-100 text-zinc-700 ring-zinc-300/70",
  RELEASED: "bg-zinc-100 text-zinc-700 ring-zinc-300/70",

  ERROR: "bg-rose-100 text-rose-800 ring-rose-300/70",
  IN_USE: "bg-violet-100 text-violet-800 ring-violet-300/70",

  // ===== STATE_* (legacy 0.x) =====
  STATE_RUNNING: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  STATE_READY: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  STATE_CREATING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_PROVISIONING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_STARTING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_ATTACHING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_UPDATING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_STOPPING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  STATE_DETACHING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  STATE_DELETING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  STATE_STOPPED: "bg-zinc-100 text-zinc-700 ring-zinc-300/70",
  STATE_ERROR: "bg-rose-100 text-rose-800 ring-rose-300/70",
};

const DOT_STYLES: Record<string, string> = {
  STATUS_ACTIVE: "bg-emerald-500",
  STATUS_READY: "bg-emerald-500",
  STATUS_RUNNING: "bg-emerald-500",
  STATUS_RESERVED: "bg-emerald-500",
  STATUS_CREATING: "bg-sky-500 animate-pulse",
  STATUS_PROVISIONING: "bg-sky-500 animate-pulse",
  STATUS_STARTING: "bg-sky-500 animate-pulse",
  STATUS_ATTACHING: "bg-sky-500 animate-pulse",
  STATUS_UPDATING: "bg-sky-500 animate-pulse",
  STATUS_STOPPING: "bg-amber-500 animate-pulse",
  STATUS_DETACHING: "bg-amber-500 animate-pulse",
  STATUS_DELETING: "bg-amber-500 animate-pulse",
  STATUS_STOPPED: "bg-zinc-400",
  STATUS_RELEASED: "bg-zinc-400",
  STATUS_ERROR: "bg-rose-500",
  STATUS_IN_USE: "bg-violet-500",

  ACTIVE: "bg-emerald-500",
  READY: "bg-emerald-500",
  RUNNING: "bg-emerald-500",
  RESERVED: "bg-emerald-500",
  CREATING: "bg-sky-500 animate-pulse",
  PROVISIONING: "bg-sky-500 animate-pulse",
  STARTING: "bg-sky-500 animate-pulse",
  ATTACHING: "bg-sky-500 animate-pulse",
  UPDATING: "bg-sky-500 animate-pulse",
  STOPPING: "bg-amber-500 animate-pulse",
  DETACHING: "bg-amber-500 animate-pulse",
  DELETING: "bg-amber-500 animate-pulse",
  STOPPED: "bg-zinc-400",
  RELEASED: "bg-zinc-400",
  ERROR: "bg-rose-500",
  IN_USE: "bg-violet-500",

  STATE_RUNNING: "bg-emerald-500",
  STATE_READY: "bg-emerald-500",
  STATE_CREATING: "bg-sky-500 animate-pulse",
  STATE_PROVISIONING: "bg-sky-500 animate-pulse",
  STATE_STARTING: "bg-sky-500 animate-pulse",
  STATE_ATTACHING: "bg-sky-500 animate-pulse",
  STATE_UPDATING: "bg-sky-500 animate-pulse",
  STATE_STOPPING: "bg-amber-500 animate-pulse",
  STATE_DETACHING: "bg-amber-500 animate-pulse",
  STATE_DELETING: "bg-amber-500 animate-pulse",
  STATE_STOPPED: "bg-zinc-400",
  STATE_ERROR: "bg-rose-500",
};

const DEFAULT_BADGE = "bg-zinc-100 text-zinc-700 ring-zinc-300/70";
const DEFAULT_DOT = "bg-zinc-400";

/** Нормализует label для отображения:
 *  STATUS_RUNNING → RUNNING
 *  STATE_RUNNING  → RUNNING
 *  RUNNING        → RUNNING
 */
function displayLabel(raw: string): string {
  if (raw.startsWith("STATUS_")) return raw.slice(7);
  if (raw.startsWith("STATE_")) return raw.slice(6);
  return raw;
}

export function StatusBadge({ state }: { state?: string }) {
  const label = state ?? "—";
  const cls = STATE_STYLES[label] ?? DEFAULT_BADGE;
  const dot = DOT_STYLES[label] ?? DEFAULT_DOT;
  const display = label === "—" ? "—" : displayLabel(label);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        cls,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {display}
    </span>
  );
}
