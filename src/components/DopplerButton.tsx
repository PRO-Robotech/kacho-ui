// DopplerButton — antd Button с радиальной "doppler" пульсацией (как
// loading-state в YC console). Используется на submit-кнопках Create-форм:
// после клика анимация идёт пока async Operation в pending-состоянии и
// гаснет когда op.done.
//
// Цвета — primary (синий ant-token), пульсация = два concentric expanding
// box-shadow-кольца (цвет-token + opacity-fade).

import { Button } from "antd";
import type { ButtonProps } from "antd";

interface Props extends ButtonProps {
  /** Внешнее состояние ожидания (pending Operation). Анимация активна
   *  пока true. Заменяет/дополняет antd loading. */
  pulsing?: boolean;
}

export function DopplerButton({ pulsing, children, danger, ...rest }: Props) {
  // danger → красная пульсация (delete-flow); иначе синяя (primary).
  const ringStyle = danger
    ? ({ "--doppler-c": "rgba(255, 77, 79, 0.6)", "--doppler-c0": "rgba(255, 77, 79, 0)" } as React.CSSProperties)
    : ({ "--doppler-c": "rgba(22, 119, 255, 0.55)", "--doppler-c0": "rgba(22, 119, 255, 0)" } as React.CSSProperties);
  return (
    <>
      <style>{`
        @keyframes doppler-ring {
          0%   { box-shadow: 0 0 0 0   var(--doppler-c, rgba(22, 119, 255, 0.55)); }
          100% { box-shadow: 0 0 0 14px var(--doppler-c0, rgba(22, 119, 255, 0));  }
        }
        @keyframes doppler-shimmer {
          0%   { background-position: -120% 0; }
          100% { background-position: 220% 0; }
        }
        .doppler-btn {
          position: relative;
          overflow: hidden;
        }
        .doppler-btn.is-pulsing {
          animation: doppler-ring 1.4s ease-out infinite;
        }
        .doppler-btn.is-pulsing::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(255, 255, 255, 0.18) 45%,
            rgba(255, 255, 255, 0.34) 50%,
            rgba(255, 255, 255, 0.18) 55%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: doppler-shimmer 1.4s linear infinite;
          pointer-events: none;
        }
      `}</style>
      <Button
        {...rest}
        danger={danger}
        loading={pulsing || rest.loading}
        style={pulsing ? { ...rest.style, ...ringStyle } : rest.style}
        className={[rest.className, "doppler-btn", pulsing && "is-pulsing"]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </Button>
    </>
  );
}
