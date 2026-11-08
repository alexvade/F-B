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
  {
    key: "midnight",
    name: "Midnight",
    swatches: [
      { name: "Midnight Navy", hex: "#002941" },
      { name: "Soft Blue", hex: "#B6DFED" },
      { name: "Coral Orange", hex: "#FD6E6E" },
    ],
  },
  {
    key: "raven",
    name: "Raven",
    swatches: [
      { name: "Raven Black", hex: "#0D0D0D" },
      { name: "Powder Blue", hex: "#B0E0E6" },
      { name: "Poppy Red", hex: "#E63946" },
    ],
  },
  {
    key: "electric",
    name: "Electric",
    swatches: [
      { name: "Electric Blue", hex: "#004AFD" },
      { name: "Flamingo Pink", hex: "#FAC7E1" },
      { name: "Plum Pink", hex: "#A5467C" },
    ],
  },
  {
    key: "mocha",
    name: "Mocha",
    swatches: [
      { name: "Mocha Green", hex: "#474329" },
      { name: "Soft Sand", hex: "#F0E5DB" },
      { name: "Watermelon Pink", hex: "#FC75B4" },
    ],
  },
];
