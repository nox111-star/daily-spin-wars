import type { CSSProperties, ReactNode } from "react";
import { frameClass } from "@/lib/api";

/**
 * Stili cosmetici dinamici: i parametri grafici arrivano dal database
 * (tabella cosmetic_styles) e vengono renderizzati senza codice statico.
 */
export type CosmeticStyle = {
  border_color?: string;
  border_color_2?: string;
  border_style?: "solid" | "dashed" | "dotted" | "double";
  border_width?: number;
  glow?: number;
  bg?: string;
  animation?: "none" | "rainbow" | "bounce" | "pulse" | "spin" | "rainbow-bounce" | "wobble";
  speed?: number;
};

export type StyleMap = Record<string, CosmeticStyle>;

export const ANIMATIONS: CosmeticStyle["animation"][] = [
  "none",
  "rainbow",
  "bounce",
  "pulse",
  "spin",
  "rainbow-bounce",
  "wobble",
];

export const DEFAULT_STYLE: CosmeticStyle = {
  border_color: "#FF4D8D",
  border_color_2: "#00C2FF",
  border_style: "solid",
  border_width: 3,
  glow: 8,
  bg: "",
  animation: "rainbow-bounce",
  speed: 2,
};

export function cosmeticCss(style: CosmeticStyle): CSSProperties {
  const width = style.border_width ?? 3;
  const color = style.border_color || "#FF4D8D";
  const glow = style.glow ?? 0;
  return {
    borderStyle: style.border_style || "solid",
    borderWidth: `${width}px`,
    borderColor: color,
    ...(style.bg ? { backgroundImage: `linear-gradient(135deg, ${color}, ${style.border_color_2 || color})` } : {}),
    ...(glow > 0 ? { boxShadow: `0 0 ${glow}px ${glow / 2}px ${style.border_color_2 || color}66` } : {}),
    animationDuration: `${style.speed ?? 2}s`,
    ["--cos-a" as string]: color,
    ["--cos-b" as string]: style.border_color_2 || color,
  };
}

export function cosmeticAnimClass(style: CosmeticStyle) {
  const a = style.animation ?? "none";
  return a === "none" ? "" : `cos-${a}`;
}

export function Cosmetic({
  value,
  styles,
  className = "",
  children,
}: {
  value: string;
  styles?: StyleMap;
  className?: string;
  children: ReactNode;
}) {
  const dyn = styles?.[value];
  if (!dyn) return <span className={`${frameClass(value)} ${className}`}>{children}</span>;
  return (
    <span className={`${cosmeticAnimClass(dyn)} ${className}`} style={cosmeticCss(dyn)}>
      {children}
    </span>
  );
}
