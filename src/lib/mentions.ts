// Shared between the Noticeboard's @mention autocomplete (client), its
// rendered post/comment text (client), and the push-notification routes
// (server) — mentions aren't stored separately, they're parsed back out of
// the saved text by matching "@Full Name" against the current staff
// roster, same spirit as the guest-survey roster matching.
export type MentionablePerson = { id: string; name: string };

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One capturing group around the name only, so `.split()` on this hands
// back the bare matched name (without the "@") at each match position.
// Longest names first so "Will Carr" matches before a bare "Will" would.
export function buildMentionRegex(people: MentionablePerson[]): RegExp | null {
  const names = Array.from(new Set(people.map((p) => p.name))).sort((a, b) => b.length - a.length);
  if (!names.length) return null;
  return new RegExp(`@(${names.map(escapeRegExp).join("|")})\\b`, "g");
}

/** Every staff id mentioned ("@Full Name") in this text — a name shared by more than one person notifies all of them, since the text alone can't disambiguate. */
export function extractMentionedIds(text: string | null | undefined, people: MentionablePerson[]): string[] {
  if (!text) return [];
  const re = buildMentionRegex(people);
  if (!re) return [];
  const idsByName = new Map<string, string[]>();
  for (const p of people) idsByName.set(p.name, [...(idsByName.get(p.name) ?? []), p.id]);
  const ids = new Set<string>();
  for (const m of text.matchAll(re)) {
    for (const id of idsByName.get(m[1]) ?? []) ids.add(id);
  }
  return Array.from(ids);
}
