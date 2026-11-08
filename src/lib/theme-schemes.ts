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
  {
    key: "sky",
    name: "Sky",
    swatches: [
      { name: "Sky Blue", hex: "#0593C6" },
      { name: "White", hex: "#FCFFFF" },
      { name: "Hot Pink", hex: "#D83995" },
    ],
  },
  {
    // Full two-word name to avoid colliding with the "Midnight" (Navy) scheme.
    key: "midnight-black",
    name: "Midnight Black",
    swatches: [
      { name: "Midnight Black", hex: "#02070A" },
      { name: "Electric Blue", hex: "#0297DE" },
      { name: "Cantaloupe Orange", hex: "#FC734D" },
    ],
  },
  {
    key: "deep",
    name: "Deep",
    swatches: [
      { name: "Deep Blue", hex: "#09318D" },
      { name: "Pure White", hex: "#FFFFFF" },
      { name: "Bubblegum Pink", hex: "#FD91CC" },
    ],
  },
  {
    // Named "Lime" (not "Midnight Black") to avoid colliding with the
    // existing "Midnight Black" scheme's name — different hex, same name.
    key: "lime",
    name: "Lime",
    swatches: [
      { name: "Midnight Black", hex: "#0B0B0C" },
      { name: "Pure White", hex: "#FFFFFF" },
      { name: "Lime Green", hex: "#C6F432" },
    ],
  },
  {
    key: "burgundy",
    name: "Burgundy",
    swatches: [
      { name: "Wine Black", hex: "#1D1015" },
      { name: "Burgundy", hex: "#421B29" },
      { name: "Rosewood", hex: "#702B40" },
    ],
  },
  {
    key: "forest",
    name: "Forest",
    swatches: [
      { name: "Forest Black", hex: "#17251F" },
      { name: "Forest Green", hex: "#344B3A" },
      { name: "Sage", hex: "#65745A" },
    ],
  },
  {
    key: "leather",
    name: "Leather",
    swatches: [
      { name: "Leather Black", hex: "#211713" },
      { name: "Leather Brown", hex: "#493126" },
      { name: "Tan", hex: "#78533B" },
    ],
  },
];
