// Design tokens carried over exactly from the Claude.ai prototype
// (team-ops-prototype.jsx) — do not tweak without checking the brief's
// "Design system" section first, these are the client's approved values.

export const ink = "#6b854A"; // tile foreground text
export const inkSoft = "#8A8F97";
export const bg = "#152825";
export const fill = "#F7F8FB"; // recessed light fill for inputs/pills inside light cards — the app's old `bg` value, kept for anything that sits on `surface`/`panel` rather than directly on the dark canvas
export const panel = "#F7F8FB"; // the light content panel that floats on the dark `bg` canvas
export const surface = "#333333"; // tile background
export const border = "#E7E9F0";
export const good = "#9BC1A8";
export const warn = "#E3C58A";
export const navy = "#1F3A5F";
export const orange = "#FF7A29";
export const navySoft = "#E1E7F0";
export const orangeSoft = "#FDE3CD";
export const navyText = "#f27d16"; // section title colour
export const bgText = "#F4F7F5"; // primary text sitting directly on the dark `bg` canvas (sidebar, page frame)
export const bgTextSoft = "#8FA79D"; // secondary/soft text sitting directly on the dark `bg` canvas

export const FONT_STACK =
  '"Avenir Light", ui-sans-serif, system-ui, -apple-system, sans-serif';
