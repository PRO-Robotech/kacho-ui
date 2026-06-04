// Бренд-знак — PRO Robotech (paws). SVG лежит в public/paws-logo.svg, рендерится
// через <img> (самодостаточный, цветной, с собственными градиентами; пропорции
// сохраняются — height=size, width=auto). variant="full" добавляет вордмарк.

export interface KachoLogoProps {
  size?: number;
  variant?: "mark" | "full";
  /** Цвет вордмарка. По умолчанию currentColor (наследует от хедера). */
  wordmarkColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Чистый знак (без вордмарка) — paws-логотип из public/. */
function Mark({ size }: { size: number }) {
  return (
    <img
      src="/paws-logo.svg"
      alt="PRO Robotech"
      style={{ height: size, width: "auto", display: "block" }}
      draggable={false}
    />
  );
}

export function KachoLogo({
  size = 24,
  variant = "mark",
  wordmarkColor = "currentColor",
  className,
  style,
}: KachoLogoProps) {
  if (variant === "mark") {
    return (
      <span
        className={className}
        style={{ display: "inline-flex", alignItems: "center", lineHeight: 0, ...style }}
      >
        <Mark size={size} />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, lineHeight: 0, ...style }}
    >
      <Mark size={size} />
      <span
        style={{
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 600,
          fontSize: Math.round(size * 0.66),
          letterSpacing: "-0.01em",
          color: wordmarkColor,
          lineHeight: 1,
        }}
      >
        Kachō
      </span>
    </span>
  );
}

export default KachoLogo;
