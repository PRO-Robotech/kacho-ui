import { CheckCircle2, XCircle, Info, Loader2, X } from "lucide-react";
import { useToasts, toast as toastApi } from "@/lib/toast";
import { cn } from "@/lib/utils";

const VARIANT_STYLES = {
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  error: "bg-rose-50 text-rose-900 border-rose-200",
  info: "bg-sky-50 text-sky-900 border-sky-200",
  loading: "bg-zinc-50 text-zinc-900 border-zinc-200",
} as const;

const VARIANT_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  loading: Loader2,
} as const;

const VARIANT_ICON_COLORS = {
  success: "text-emerald-500",
  error: "text-rose-500",
  info: "text-sky-500",
  loading: "text-zinc-500 animate-spin",
} as const;

export function Toaster() {
  const items = useToasts();
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-md pointer-events-none">
      {items.map((t) => {
        const Icon = VARIANT_ICONS[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-lg border shadow-md px-3 py-2.5 animate-in slide-in-from-right-4 fade-in-0",
              VARIANT_STYLES[t.variant],
            )}
            role={t.variant === "error" ? "alert" : "status"}
          >
            <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", VARIANT_ICON_COLORS[t.variant])} />
            <div className="text-sm flex-1 leading-snug">{t.message}</div>
            <button
              onClick={() => toastApi.dismiss(t.id)}
              className="text-current/60 hover:text-current shrink-0"
              aria-label="Закрыть"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
