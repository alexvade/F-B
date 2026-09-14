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
  events: { time: string; what: string; where?: string; note?: string }[];
};

export type EventContent = {
  eyebrow?: string;
  venueLine?: string;
  stats?: { label: string; value: string; sub?: string }[];
  contacts?: {
    heading: string;
    people: { name: string; role: string; detail?: string }[];
  }[];
  timeline?: TimelineDay[];
  menu?: { title: string; when?: string; items: string[]; flags?: string[] }[];
  drinks?: { title: string; when?: string; items: string[]; flags?: string[] }[];
  providedBy?: { heading: string; items: string[] }[];
  notes?: { heading: string; body: string }[];
  footer?: string;
};
