// KAC-246: бренд-знак Kachō (花鳥 — «цветы и птицы»).
//
// Геометрический минимализм: стилизованная птица/журавль, собранная из трёх
// пересекающихся лепестко-крыльев (восходящий взмах), залитая brand-gradient
// blue→violet. Читается в 20px, не «K-бокс». variant="full" добавляет вордмарк
// «Kachō» (Inter 600).

import { useId } from "react";

export interface KachoLogoProps {
  size?: number;
  variant?: "mark" | "full";
  /** Цвет вордмарка. По умолчанию currentColor (наследует от хедера). */
  wordmarkColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Чистый SVG-знак (без вордмарка). */
function Mark({ size, gradId }: { size: number; gradId: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Kachō"
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D8DF5" />
          <stop offset="1" stopColor="#6E56CF" />
        </linearGradient>
      </defs>
      {/*
        Три лепестко-крыла, исходящих из нижней точки (тело журавля) и
        раскрывающихся вверх — взмах. Каждое крыло — лист-форма (две дуги),
        пересечения дают глубину. Нижняя точка — «грудь» птицы.
      */}
      {/* Левое крыло */}
      <path
        d="M16 27 C 9 21, 4.5 15, 6.5 7.5 C 12 10.5, 15 16, 16 23 Z"
        fill={`url(#${gradId})`}
        opacity="0.72"
      />
      {/* Правое крыло */}
      <path
        d="M16 27 C 23 21, 27.5 15, 25.5 7.5 C 20 10.5, 17 16, 16 23 Z"
        fill={`url(#${gradId})`}
        opacity="0.72"
      />
      {/* Центральное перо/шея — поднятая вверх, поверх крыльев */}
      <path
        d="M16 28 C 13.5 20, 13.5 11, 16 3 C 18.5 11, 18.5 20, 16 28 Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
}

export function KachoLogo({
  size = 24,
  variant = "mark",
  wordmarkColor = "currentColor",
  className,
  style,
}: KachoLogoProps) {
  const gradId = useId();

  if (variant === "mark") {
    return (
      <span
        className={className}
        style={{ display: "inline-flex", alignItems: "center", lineHeight: 0, ...style }}
      >
        <Mark size={size} gradId={gradId} />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, lineHeight: 0, ...style }}
    >
      <Mark size={size} gradId={gradId} />
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
