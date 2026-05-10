// StatusBadge — YC-style плотный pill для статуса ресурса.
// Поддерживает оба naming convention: STATUS_* (1.0 flat) и STATE_* (legacy 0.x).
// Тема — dark only (под AntD darkAlgorithm). Светлые палитры из 0.x удалены.

import { cn } from "@/lib/utils";

type Tone = "ok" | "info" | "warn" | "muted" | "error" | "violet";

const TONE_CLASS: Record<Tone, string> = {
  ok:    "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
  info:  "bg-sky-900/40 text-sky-300 border-sky-800/60",
  warn:  "bg-amber-900/40 text-amber-300 border-amber-800/60",
  muted: "bg-zinc-700/30 text-zinc-300 border-zinc-700/50",
  error: "bg-rose-900/40 text-rose-300 border-rose-800/60",
  violet:"bg-violet-900/40 text-violet-300 border-violet-800/60",
};

const TONE_BY_STATUS: Record<string, Tone> = {
  ACTIVE: "ok", READY: "ok", RUNNING: "ok", RESERVED: "ok",
  CREATING: "info", PROVISIONING: "info", STARTING: "info",
  ATTACHING: "info", UPDATING: "info",
  STOPPING: "warn", DETACHING: "warn", DELETING: "warn",
  STOPPED: "muted", RELEASED: "muted",
  ERROR: "error",
  IN_USE: "violet",
};

/** Нормализует label: STATUS_RUNNING → RUNNING, STATE_RUNNING → RUNNING, RUNNING → RUNNING. */
function displayLabel(raw: string): string {
  if (raw.startsWith("STATUS_")) return raw.slice(7);
  if (raw.startsWith("STATE_")) return raw.slice(6);
  return raw;
}

export function StatusBadge({ state }: { state?: string }) {
  if (!state) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const display = displayLabel(state);
  const tone = TONE_BY_STATUS[display] ?? "muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 h-[20px] text-[11px] font-medium leading-none border",
        TONE_CLASS[tone],
      )}
    >
      {display.charAt(0) + display.slice(1).toLowerCase()}
    </span>
  );
}
