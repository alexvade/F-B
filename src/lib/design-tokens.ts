// Design tokens carried over exactly from the Claude.ai prototype
// (team-ops-prototype.jsx) — do not tweak the *default* values without
// checking the brief's "Design system" section first, these are the
// client's approved values and every signed-in user still sees them.
//
// Each token below resolves through a CSS custom property (defined in
// globals.css) rather than a literal hex string. By default every one of
// those custom properties still resolves to pure black or white, same as
// before — nothing visually changes for anyone. The indirection exists so
// the super-admin-only colour-scheme picker (theme-scheme-toggle.tsx) can
// override the custom properties under `html[data-scheme="…"]`, which
// re-themes every component that already imports these tokens without
// touching the components themselves. See src/lib/theme-schemes.ts for the
// scheme registry and globals.css for the three CSS-var groups each scheme
// fills in: --to-bg (background), --to-fg (text/border), --to-accent
// (buttons/highlights/badges).
export const ink = "var(--to-fg)";
export const inkSoft = "var(--to-fg)";
export const bg = "var(--to-bg)";
export const fill = "var(--to-bg)";
export const panel = "var(--to-bg)";
export const surface = "var(--to-bg)";
export const border = "var(--to-fg)";
export const good = "var(--to-accent)";
export const warn = "var(--to-accent)";
export const navy = "var(--to-accent)";
export const orange = "var(--to-accent)";
export const navySoft = "var(--to-bg)";
export const orangeSoft = "var(--to-bg)";
export const navyText = "var(--to-fg)";
export const bgText = "var(--to-fg)";
export const bgTextSoft = "var(--to-fg)";

export const FONT_STACK =
  '"Avenir Light", ui-sans-serif, system-ui, -apple-system, sans-serif';
