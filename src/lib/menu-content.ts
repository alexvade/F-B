/**
 * Flexible shape for a rendered menu (Afternoon Tea, Dinner, etc.) — mirrors
 * the "flexible blob, not a normalized schema" choice made for events'
 * EventContent (see src/lib/event-content.ts), since menus vary a lot in
 * shape: a wine-style tea list vs. priced dinner courses vs. a cheese board
 * with tasting notes.
 *
 * Populated by Claude reading the menu PDF and writing it back directly,
 * same as events — see docs/events-extraction.md.
 */
export type MenuItem = {
  name: string;
  description?: string;
  price?: string;
  flags?: string[]; // e.g. "GF", "Plant-based", "Add £4"
};

export type MenuSection = {
  heading: string;
  intro?: string;
  items: MenuItem[];
};

export type MenuContent = {
  eyebrow?: string;
  venueLine?: string;
  intro?: { heading: string; body: string }[];
  sections: MenuSection[];
  footer?: string;
};
