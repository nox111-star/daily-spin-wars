import { useEffect, useRef, useState } from "react";
import type { WheelPrize } from "@/lib/api";

const COLORS = [
  "hsl(330 90% 62%)",
  "hsl(196 100% 50%)",
  "hsl(268 80% 65%)",
  "hsl(42 96% 58%)",
  "hsl(160 70% 45%)",
  "hsl(12 90% 62%)",
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
}

function slicePath(index: number, count: number) {
  const seg = 360 / count;
  const start = index * seg;
  const end = start + seg;
  const [x1, y1] = polar(100, 100, 98, start);
  const [x2, y2] = polar(100, 100, 98, end);
  const large = seg > 180 ? 1 : 0;
  return `M100 100 L${x1} ${y1} A98 98 0 ${large} 1 ${x2} ${y2} Z`;
}

/**
 * Ruota animata con spicchi generati dai premi della giornata.
 * L'indice vincente arriva dal server: l'animazione si ferma esattamente
 * sullo spicchio corrispondente al premio realmente assegnato.
 */
export function SpinWheel({
  prizes,
  target,
  onSettled,
  size = 260,
}: {
  prizes: WheelPrize[];
  target: number | null;
  onSettled?: () => void;
  size?: number;
}) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const lastTarget = useRef<number | null>(null);
  const count = Math.max(prizes.length, 1);

  useEffect(() => {
    if (target === null || target === lastTarget.current) return;
    lastTarget.current = target;
    const seg = 360 / count;
    const base = Math.ceil(angle / 360) * 360;
    const final = base + 360 * 5 - (target * seg + seg / 2);
    setSpinning(true);
    setAngle(final);
    const t = window.setTimeout(() => {
      setSpinning(false);
      onSettled?.();
    }, 4200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, count]);

  useEffect(() => {
    if (target === null) lastTarget.current = null;
  }, [target]);

  const seg = 360 / count;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size, maxWidth: "100%" }}>
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-2xl drop-shadow">▼</div>
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full rounded-full shadow-lg"
        style={{
          transform: `rotate(${angle}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.15, 0.9, 0.15, 1)" : "none",
        }}
      >
        <circle cx="100" cy="100" r="99" fill="hsl(var(--muted))" />
        {prizes.map((p, i) => {
          const mid = i * seg + seg / 2;
          const [tx, ty] = polar(100, 100, 62, mid);
          return (
            <g key={`${p.label}-${i}`}>
              <path d={slicePath(i, count)} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth="1" />
              <text
                x={tx}
                y={ty}
                fill="white"
                fontSize={count > 8 ? 7 : 9}
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid} ${tx} ${ty})`}
              >
                {p.label.length > 18 ? `${p.label.slice(0, 17)}…` : p.label}
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="16" fill="white" stroke="hsl(var(--border))" strokeWidth="2" />
        <text x="100" y="101" fontSize="14" textAnchor="middle" dominantBaseline="middle">
          🎡
        </text>
      </svg>
    </div>
  );
}
