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
  /** Corona applicata sopra la cornice (emoji o simbolo). */
  crown?: string;
  crown_size?: number;
  crown_offset?: number;
  crown_tilt?: number;
  crown_animation?: "none" | "bounce" | "pulse" | "wobble";
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

export const CROWN_ANIMATIONS: NonNullable<CosmeticStyle["crown_animation"]>[] = ["none", "bounce", "pulse", "wobble"];

export const CROWN_PRESETS = ["", "👑", "🥇", "⭐", "✨", "🔥", "🎀", "🏆"];

export const DEFAULT_STYLE: CosmeticStyle = {
  border_color: "#FF4D8D",
  border_color_2: "#00C2FF",
  border_style: "solid",
  border_width: 3,
  glow: 8,
  bg: "",
  animation: "rainbow-bounce",
  speed: 2,
  crown: "",
  crown_size: 18,
  crown_offset: 10,
  crown_tilt: -15,
  crown_animation: "none",
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

export function CrownBadge({ style }: { style: CosmeticStyle }) {
  if (!style.crown) return null;
  const anim = style.crown_animation ?? "none";
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-1/2 z-10 leading-none ${anim === "none" ? "" : `cos-${anim}`}`}
      style={{
        top: `-${style.crown_offset ?? 10}px`,
        fontSize: `${style.crown_size ?? 18}px`,
        transform: `translateX(-50%) rotate(${style.crown_tilt ?? 0}deg)`,
        animationDuration: `${style.speed ?? 2}s`,
      }}
    >
      {style.crown}
    </span>
  );
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
    <span className={`relative ${cosmeticAnimClass(dyn)} ${className}`} style={cosmeticCss(dyn)}>
      <CrownBadge style={dyn} />
      {children}
    </span>
  );
}
