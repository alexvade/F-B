// Design tokens carried over exactly from the Claude.ai prototype
// (team-ops-prototype.jsx) — do not tweak without checking the brief's
// "Design system" section first, these are the client's approved values.

// Black-and-white only, per request — every token below resolves to
// either #000000 or #FFFFFF depending on whether it plays a
// foreground/text/border role or a background/fill role.
export const ink = "#000000";
export const inkSoft = "#000000";
export const bg = "#FFFFFF";
export const fill = "#FFFFFF";
export const panel = "#FFFFFF";
export const surface = "#FFFFFF";
export const border = "#000000";
export const good = "#000000";
export const warn = "#000000";
export const navy = "#000000";
export const orange = "#000000";
export const navySoft = "#FFFFFF";
export const orangeSoft = "#FFFFFF";
export const navyText = "#000000";
export const bgText = "#000000";
export const bgTextSoft = "#000000";

export const FONT_STACK =
  '"Avenir Light", ui-sans-serif, system-ui, -apple-system, sans-serif';

// Icon accent colours — text, panels, and borders stay strictly black/white
// per the tokens above, but icons get colour so they're easier to tell
// apart at a glance. One colour per semantic area, reused everywhere that
// area's icon shows up (nav, page headers, stat cards, etc).
export const iconColors = {
  blue: "#2563EB",
  sky: "#0284C7",
  teal: "#0D9488",
  green: "#16A34A",
  lime: "#65A30D",
  amber: "#D97706",
  orange: "#EA580C",
  red: "#DC2626",
  rose: "#E11D48",
  pink: "#DB2777",
  purple: "#7C3AED",
  indigo: "#4F46E5",
  slate: "#475569",
  gold: "#CA8A04",
} as const;
