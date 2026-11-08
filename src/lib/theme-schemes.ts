// Registry of colour schemes offered by the owner-only picker
// (theme-scheme-toggle.tsx). Each scheme supplies exactly 3 swatches —
// dark base / light text / accent — which design-tokens.ts's CSS vars
// (--to-bg / --to-fg / --to-accent) resolve to. To add a scheme: append it
// here, then add a matching `html[data-scheme="<key>"] { ... }` override
// block in globals.css.
export type ThemeSwatch = { name: string; hex: string };
export type ThemeScheme = { key: string; name: string; swatches: ThemeSwatch[] };

export const THEME_SCHEMES: ThemeScheme[] = [
  {
    key: "obsidian",
    name: "Obsidian",
    swatches: [
      { name: "Obsidian Black", hex: "#111217" },
      { name: "Ice Grey", hex: "#DFE5EB" },
      { name: "Racing Red", hex: "#EF233C" },
    ],
  },
];
