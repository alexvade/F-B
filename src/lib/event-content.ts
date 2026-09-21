/**
 * Flexible, mostly-optional shape for a rendered event guide. Every section
 * is optional and rendered only if present, so a two-line corporate booking
 * and a full wedding guide both work through the same template —
 * see src/components/event-guide.tsx.
 *
 * Populated by Claude reading the linked function sheet PDF and writing it
 * back via a script (see docs/events-extraction.md), not by any in-app
 * extraction pipeline.
 */
export type TimelineDay = {
  date: string;
  tag?: string;
  core?: boolean;
  // `brief` is a short food/drink summary (e.g. "Tea, coffee, pastries") shown
  // next to this line on the Dashboard's "Events today" — distinct from
  // `note`, which is the fuller operational instruction shown in the guide.
  events: { time: string; what: string; where?: string; note?: string; brief?: string }[];
};

// One ordered item, optionally with the quantity ordered (as printed on the
// function sheet, e.g. "6 Salmon fishcake…") — shown as a leading number in
// the guide so staff can see the split across a plated menu's choices.
export type MenuLine = { qty?: number; text: string };

export type EventContent = {
  eyebrow?: string;
  venueLine?: string;
  stats?: { label: string; value: string; sub?: string }[];
  contacts?: {
    heading: string;
    people: { name: string; role: string; detail?: string }[];
  }[];
  timeline?: TimelineDay[];
  // `courses` groups items into rows separated by a divider — e.g. starters,
  // then a gap, then mains, then a gap, then desserts — matching how a
  // plated function-sheet menu is laid out. A card with a single course
  // (nothing to divide) is just a one-element array.
  menu?: { title: string; when?: string; courses: MenuLine[][]; flags?: string[] }[];
  drinks?: { title: string; when?: string; items: string[]; flags?: string[] }[];
  providedBy?: { heading: string; items: string[] }[];
  notes?: { heading: string; body: string }[];
  footer?: string;
};
