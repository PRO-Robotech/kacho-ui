import { cn } from "@/lib/utils";

const STATE_STYLES: Record<string, string> = {
  // active / ready
  ACTIVE: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  STATE_RUNNING: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  STATE_READY: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",
  RESERVED: "bg-emerald-100 text-emerald-800 ring-emerald-300/70",

  // creating / provisioning / starting
  CREATING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_CREATING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_PROVISIONING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_STARTING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_ATTACHING: "bg-sky-100 text-sky-800 ring-sky-300/70",
  STATE_UPDATING: "bg-sky-100 text-sky-800 ring-sky-300/70",

  // stopping / deleting
  STATE_STOPPING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  STATE_DETACHING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  DELETING: "bg-amber-100 text-amber-800 ring-amber-300/70",
  STATE_DELETING: "bg-amber-100 text-amber-800 ring-amber-300/70",

  // stopped
  STATE_STOPPED: "bg-zinc-100 text-zinc-700 ring-zinc-300/70",
  RELEASED: "bg-zinc-100 text-zinc-700 ring-zinc-300/70",

  // error
  ERROR: "bg-rose-100 text-rose-800 ring-rose-300/70",
  STATE_ERROR: "bg-rose-100 text-rose-800 ring-rose-300/70",

  // in use
  IN_USE: "bg-violet-100 text-violet-800 ring-violet-300/70",
};

const DOT_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  STATE_RUNNING: "bg-emerald-500",
  STATE_READY: "bg-emerald-500",
  RESERVED: "bg-emerald-500",

  CREATING: "bg-sky-500 animate-pulse",
  STATE_CREATING: "bg-sky-500 animate-pulse",
  STATE_PROVISIONING: "bg-sky-500 animate-pulse",
  STATE_STARTING: "bg-sky-500 animate-pulse",
  STATE_ATTACHING: "bg-sky-500 animate-pulse",
  STATE_UPDATING: "bg-sky-500 animate-pulse",

  STATE_STOPPING: "bg-amber-500 animate-pulse",
  STATE_DETACHING: "bg-amber-500 animate-pulse",
  DELETING: "bg-amber-500 animate-pulse",
  STATE_DELETING: "bg-amber-500 animate-pulse",

  STATE_STOPPED: "bg-zinc-400",
  RELEASED: "bg-zinc-400",

  ERROR: "bg-rose-500",
  STATE_ERROR: "bg-rose-500",

  IN_USE: "bg-violet-500",
};

const DEFAULT_BADGE = "bg-zinc-100 text-zinc-700 ring-zinc-300/70";
const DEFAULT_DOT = "bg-zinc-400";

export function StatusBadge({ state }: { state?: string }) {
  const label = state ?? "—";
  const cls = STATE_STYLES[label] ?? DEFAULT_BADGE;
  const dot = DOT_STYLES[label] ?? DEFAULT_DOT;
  // STATE_X → X для UI
  const display = label.startsWith("STATE_") ? label.slice(6) : label;
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
