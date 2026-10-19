// Normalizes the flexible `guest_surveys.answers` JSONB into the fixed
// row shape the reference dashboard (claude.ai/artifact/Lmud4ugsdJd6pGNhf7UjNr)
// computes over, plus the same aggregate helpers it uses (stats, NPS,
// Pearson correlation, staff/theme tallies). Kept separate from the
// component so the shape and the math can be sanity-checked against real
// data with a plain Node script.

export type Answer = { question: string; answer: string | null };
export type SurveyInput = {
  id: number;
  guest_name: string;
  response_date: string | null;
  overall_score: number | null;
  nps_category: string | null;
  room: string | null;
  check_in: string | null;
  check_out: string | null;
  answers: Answer[];
};

// [key, full label, short label, source question] — order matches the
// reference dashboard's QS catalog exactly.
export const QS: [string, string, string, string | null][] = [
  ["overall", "Overall experience", "Overall", null],
  ["nps", "Likelihood to recommend (0–10)", "Recommend", "Recommendation"],
  ["reservation", "Reservation service", "Reservations", "Reservation Service"],
  ["q_checkin", "Check-in", "Check-in", "Check in experience"],
  ["q_checkout", "Check-out", "Check-out", "Check out experience"],
  ["friendly", "Team friendliness", "Friendliness", "Friendliness of our Team members"],
  ["room_clean", "Bedroom cleanliness", "Room clean", "Bedroom Cleanliness"],
  ["room_fac", "Bedroom facilities", "Room facilities", "Bedroom Facilities"],
  ["bk_service", "Breakfast service", "Bkfst service", "Breakfast Service"],
  ["bk_food", "Breakfast food", "Bkfst food", "Breakfast Food Quality"],
  ["rest_service", "Restaurant service", "Rest. service", "Restaurant Service"],
  ["rest_food", "Restaurant food", "Rest. food", "Restaurant Food Quality"],
  ["bar_service", "Bar & lounge service", "Bar service", "Bar or Lounge service"],
  ["bar_quality", "Bar food & drink", "Bar F&D", "Bar or Lounge Food and Drink Quality"],
  ["spa_clean", "Spa cleanliness", "Spa clean", "Health Club and Spa cleanliness"],
  ["spa_fac", "Health club facilities", "Spa facilities", "Health Club Facilities"],
  ["spa_treat", "Spa treatments", "Treatments", "Spa treatment"],
  ["grounds", "Grounds & gardens", "Grounds", "Presentation Grounds and Gardens"],
  ["wed_service", "Wedding service", "Wedding", "How would you rate the standard of service you received at the wedding function you attended?"],
  ["wed_recommend", "Would recommend for a wedding", "Wedding rec.", "Would you choose or recommend this venue for a similar wedding function?"],
  ["meet_delegate", "Meeting delegate experience", "Delegates", "As a delegate at our hotel, how satisfied were you with the running of the event?"],
  ["meet_room", "Meeting room & facilities", "Meeting room", "How satisfied were you with the meeting room and facilities in it?"],
];
export const QL = Object.fromEntries(QS.map((q) => [q[0], q[1]])) as Record<string, string>;
export const QSH = Object.fromEntries(QS.map((q) => [q[0], q[2]])) as Record<string, string>;

export const MONTH_COLS = ["overall", "q_checkin", "friendly", "room_clean", "room_fac", "bk_food", "rest_food", "bar_service", "spa_fac"];

export const DIMS: [string, string][] = [
  ["reason", "Reason for stay"],
  ["channel", "Booking channel"],
  ["room_type", "Room type"],
  ["returning", "First time or returning"],
  ["nightsLabel", "Nights stayed"],
  ["found_us", "How they found us"],
  ["market", "Market code"],
];

// Category -> the dedicated free-text comment question for it, where one
// exists in the export. Categories without one fall back to the general
// "what could be improved" comment for anyone who scored them low.
const NOTE_QUESTIONS: Record<string, string> = {
  q_checkin: "Check in improvements - other comments Comment",
  q_checkout: "Check out comment box Comment",
  friendly: "Friendliness staff improvements Comment",
  room_clean: "Bedroom Cleanliness improvement Comment",
  room_fac: "Bedroom Facilities comment box Comment",
  bk_service: "Breakfast service comment box Comment",
  bk_food: "Breakfast quality comment box Comment",
  rest_service: "Restaurant Service comment box Comment",
  rest_food: "Food Quality comment box Comment",
  bar_service: "Bar or Lounge service comment box Comment",
  bar_quality: "Bar or Lounge Food and Drink Quality comment box Comment",
  spa_clean: "Spa Cleanliness comment box Comment",
  grounds: "Presentation and Gardens improvements Comment",
};

export type StaffMention = { name: string; tone: "praise" | "critical"; dept: string | null; quote: string; field: string };

export type Row = {
  id: number;
  guest: string;
  nps_group: string;
  room: string | null;
  room_type: string | null;
  date: string | null;
  checkin: string | null;
  checkout: string | null;
  nights: number | null;
  nightsLabel: string;
  reason: string;
  channel: string;
  market: string;
  returning: string;
  found_us: string;
  spend: number | null;
  value: string;
  had_issue: string;
  issue_area: string;
  issue_impact: string;
  action_score: number | null;
  sustain_importance: number | null;
  sustain_sat: number | null;
  highlight: string;
  improve: string;
  standout: string;
  issue_text: string;
  additional: string;
  event_comment: string;
  notes: Record<string, string>;
  staff: StaffMention[];
  otherNames: string[];
  themes: string[];
  // Reply tracking — only populated for OTA reviews (Booking/Google/
  // Expedia/etc.), which carry it from ReviewPro. Post-stay surveys don't
  // have it: it was dropped at import time as ReviewPro-internal, so
  // `replied` stays "" for those rows.
  replied: string;
  reply: string;
  reply_date: string | null;
  overall: number | null;
  nps: number | null;
  // every other QS key (reservation, q_checkin, friendly, …) is read
  // generically through this index signature
  [k: string]: unknown;
};

function ans(answers: Answer[], question: string): string | null {
  const a = answers.find((x) => x.question === question)?.answer;
  return a != null && a !== "" ? a : null;
}

function num(answers: Answer[], question: string | null): number | null {
  if (!question) return null;
  const a = ans(answers, question);
  if (a == null) return null;
  const n = parseFloat(a);
  return Number.isFinite(n) ? n : null;
}

function nightsBetween(checkin: string | null, checkout: string | null): number | null {
  if (!checkin || !checkout) return null;
  const a = new Date(checkin + "T00:00:00Z").getTime();
  const b = new Date(checkout + "T00:00:00Z").getTime();
  const n = Math.round((b - a) / 86400000);
  return n >= 0 ? n : null;
}

// ---------- real staff roster (from the F&B rota) ----------

export type RosterPerson = { canonical: string; firstNames: string[]; surname: string; contextKeywords?: RegExp };

// Listed in the rota sheet's row order but not a real person to match —
// shift-label artifacts, not staff.
const ROSTER_EXCLUDE = new Set(["early dm", "late dm", "harrison errais"]);

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Builds the real roster from rota_staff_order names: strips stray
// trailing symbols ("Ellis <3"), drops shift-label placeholders, and
// merges obvious typo/nickname duplicates of the same person (same
// surname, first name a near-match or a prefix of the other — "Dave" /
// "David" Haist, "Peaony" / "Paeony" Richards) into one entry with both
// spellings as accepted first-name aliases.
export function buildRoster(rawNames: string[]): RosterPerson[] {
  const cleaned = rawNames
    .map((n) => n.replace(/[^A-Za-z\s'-]+$/g, "").replace(/\s+/g, " ").trim())
    .filter((n) => n && !ROSTER_EXCLUDE.has(n.toLowerCase()));

  const people: RosterPerson[] = [];
  for (const full of cleaned) {
    const parts = full.split(" ");
    const first = parts[0];
    const surname = parts.slice(1).join(" ");
    const existing = people.find((p) => {
      if (p.surname.toLowerCase() !== surname.toLowerCase()) return false;
      return p.firstNames.some((f) => {
        const fl = f.toLowerCase(), nl = first.toLowerCase();
        // an exact first-name match always merges; a fuzzy/prefix match
        // only merges when there's a surname to confirm it's the same
        // person (two different mononym staff could share a first name)
        return fl === nl || (!!surname && (levenshtein(fl, nl) <= 2 || fl.startsWith(nl) || nl.startsWith(fl)));
      });
    });
    if (existing) {
      if (!existing.firstNames.some((f) => f.toLowerCase() === first.toLowerCase())) existing.firstNames.push(first);
    } else {
      people.push({ canonical: full, firstNames: [first], surname });
    }
  }
  return people;
}

// Two real staff can share a first name (e.g. two "Richard"s — one
// reception, one breakfast-only F&B). `rotaRichard`/`receptionRichard`
// below give each a `contextKeywords` regex for exactly this case: real
// rota data has no department field, so this one pairing is hand-told
// rather than inferred.
export function applyManualRosterOverrides(roster: RosterPerson[]): RosterPerson[] {
  const out = roster.map((p) => ({ ...p }));
  const rand = out.find((p) => p.canonical === "Richard Rand");
  if (rand) rand.contextKeywords = /\bbreakfast\b/i;
  if (!out.some((p) => p.surname.toLowerCase() === "gillies")) {
    out.push({ canonical: "Richard Gillies", firstNames: ["Richard"], surname: "Gillies", contextKeywords: /\b(reception|check[\s-]?in|check[\s-]?out|front desk)\b/i });
  }
  return out;
}

// Matches real roster people mentioned in free text. A first name shared
// by more than one roster person (e.g. two "Richard"s) is only accepted
// when that person's surname also appears, or — if neither surname is
// present — when exactly one of them has a `contextKeywords` match in the
// text (e.g. "breakfast" for the breakfast-only Richard). An unresolved
// ambiguous mention is skipped rather than guessed.
export function matchRosterMentions(text: string, roster: RosterPerson[]): RosterPerson[] {
  if (!text || !roster.length) return [];
  const byFirst = new Map<string, RosterPerson[]>();
  for (const p of roster) {
    for (const f of p.firstNames) {
      const k = f.toLowerCase();
      const list = byFirst.get(k) ?? [];
      if (!list.includes(p)) list.push(p);
      byFirst.set(k, list);
    }
  }
  const found = new Set<RosterPerson>();
  for (const [first, people] of byFirst.entries()) {
    const re = new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!re.test(text)) continue;
    if (people.length === 1) { found.add(people[0]); continue; }
    const bySurname = people.filter((p) => p.surname && new RegExp(`\\b${p.surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
    if (bySurname.length) { bySurname.forEach((p) => found.add(p)); continue; }
    const byContext = people.filter((p) => p.contextKeywords?.test(text));
    if (byContext.length === 1) found.add(byContext[0]);
    // 0 or 2+ context matches: genuinely ambiguous, skip rather than guess.
  }
  return Array.from(found);
}

// Capitalized-word-run heuristic, used only as a low-confidence fallback
// for names mentioned in "stand out" comments that AREN'T on the roster
// (e.g. a new starter who hasn't been synced from the rota sheet yet).
const STOP_PHRASES = new Set([
  "everyone", "every", "all", "alll", "entire", "whole", "team", "staff", "reception", "restaurant",
  "bar", "spa", "breakfast", "housekeeping", "the", "yes", "no", "hotel", "wood", "hall",
  "both", "lounge", "health", "club", "front", "desk", "especially", "particularly", "guest",
  "guests", "room", "bedroom", "grounds", "gardens", "general", "manager", "management",
  // pronouns, conjunctions and other ordinary words that capitalise at the
  // start of a sentence and would otherwise be mistaken for a name
  "they", "she", "he", "we", "it", "you", "your", "yours", "i", "there", "this", "that",
  "these", "those", "but", "and", "also", "very", "already", "basically", "aways", "always",
  "thank", "thanks", "please", "overall", "what", "when", "where", "which", "who", "why",
  "how", "receptionist", "chefs", "chef", "waitress", "waiter", "dad", "mum", "mom", "dogs",
  "dog", "checkin", "checkout", "english", "european", "romanian", "british", "during",
  "each", "excellent", "amazing", "being", "apologies", "sorry", "although", "however",
  "overview", "indeed", "despite", "unfortunately", "fortunately", "firstly", "secondly",
  "finally", "additionally", "honestly", "literally", "definitely", "absolutely", "obviously",
  "january", "february", "march", "april", "may", "june", "july", "august", "september",
  "october", "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday",
  "saturday", "sunday", "bridal", "suite", "wedding", "friendly", "lovely", "fantastic",
  "wonderful", "brilliant", "outstanding", "superb", "attentive", "helpful", "polite",
  "not", "was", "nothing", "barman", "barmaid", "waitress", "dinner", "lunch", "everybody",
  "from", "gentleman", "gentlemen", "lady", "ladies", "romania", "poland", "hungary", "spain",
  "first", "following", "genuinely", "great", "guy", "girl", "had", "hair", "handpicked",
  "head", "families", "family", "feb", "jan", "sept", "nov", "dec",
  "his", "her", "him", "hospitality", "man", "woman", "polish", "such", "thought", "think",
  "could", "would", "should", "upon", "across", "throughout", "other", "others",
  "for", "next", "good", "two", "one", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "another", "either", "neither", "various", "several", "multiple", "certain",
  "compliment", "compliments", "mention", "mentioned", "above", "previously", "once", "again",
  "rookery", "though", "well", "young", "older", "younger", "wasnt", "seriously", "meanwhile",
  "welcoming", "took", "worked", "new", "tall", "many", "professional", "likewise", "massive",
  "personal", "waiters", "waitresses", "special", "our", "receptionists", "only", "munich",
  "york", "tripadvisor", "yorkshire", "broad", "silver", "fox", "notonly", "saturdy",
]);
const NAME_RE = /\b([A-Z][a-z]{1,15}(?:\s+(?:and\s+)?[A-Z][a-z]{1,15}){0,2})\b/g;

function extractNames(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  NAME_RE.lastIndex = 0;
  while ((m = NAME_RE.exec(text))) {
    const phrase = m[1];
    const parts = phrase.split(/\s+and\s+/i);
    for (const part of parts) {
      const words = part.trim().split(/\s+/).filter((w) => !STOP_PHRASES.has(w.toLowerCase()));
      if (!words.length) continue;
      const name = words.slice(0, 2).join(" ");
      if (name.length >= 3) out.push(name);
    }
  }
  return out;
}

const DEPT_KEYWORDS: [string, RegExp][] = [
  ["Reception", /\b(reception|check[\s-]?in|check[\s-]?out|front desk)\b/i],
  ["Restaurant", /\b(restaurant|dining|dinner|waiter|waitress)\b/i],
  ["Bar", /\b(bar|lounge)\b/i],
  ["Breakfast", /\bbreakfast\b/i],
  ["Housekeeping", /\b(housekeeping|room clean|bedroom)\b/i],
  ["Spa", /\b(spa|health club|treatment|pool)\b/i],
  ["Grounds", /\b(grounds|garden|parking)\b/i],
  ["Management", /\b(manager|management)\b/i],
];
function guessDept(text: string): string | null {
  for (const [dept, re] of DEPT_KEYWORDS) if (re.test(text)) return dept;
  return null;
}

// Gates a staff mention outside the "stand out" question as genuine
// criticism rather than a second compliment — see buildRows below.
const NEGATIVE_WORDS =
  /\b(rude|unhelpful|unfriendly|dismissive|ignored|ignoring|slow|rushed|forgot|forgotten|mistakes?|unprofessional|abrupt|snapp(?:ed|y)|argued|refused|complain(?:ed|t)?|condescending|patroni[sz]ing|aggressive|unpleasant|unacceptable|awful|terrible|horrible|annoy(?:ed|ing)|frustrat(?:ed|ing)|disappoint(?:ed|ing)|locked out|no apology|talk(?:s|ed) too much|waited (?:ages|forever|a long time|too long)|long wait|let (?:us|me) down|lacking|lacked|short with (?:us|me)|huffy|stroppy|poor service|(?:was|were) poor\b)/gi;

// A long free-text comment often covers several things ("got locked out
// of my room... Richard couldn't open it either" — the lock is at fault,
// Richard was just trying to help). Requiring the negative word to sit
// close to the name, rather than just present anywhere in the comment,
// avoids blaming whoever happens to be named for an unrelated complaint.
function hasNearbyNegative(text: string, firstName: string, window = 120): boolean {
  const nameRe = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  const namePositions: number[] = [];
  let nm: RegExpExecArray | null;
  while ((nm = nameRe.exec(text))) namePositions.push(nm.index);
  if (!namePositions.length) return false;
  let wm: RegExpExecArray | null;
  NEGATIVE_WORDS.lastIndex = 0;
  while ((wm = NEGATIVE_WORDS.exec(text))) {
    if (namePositions.some((p) => Math.abs(p - wm!.index) <= window)) return true;
  }
  return false;
}

// Fixed theme catalogue for "Recurring complaints" — keyword-matched
// against free text, since the original dataset's theme tags were a
// one-time pass over text this app doesn't have the source for.
const THEMES: [string, RegExp][] = [
  ["Price & value", /\b(expensive|pricey|overpriced|price|cost|value for money)\b/i],
  ["Breakfast", /\bbreakfast\b/i],
  ["Menu choice & dietary", /\b(menu|dietary|vegan|vegetarian|gluten|allergy|allergies)\b/i],
  ["Booking & reservations", /\b(booking|reservation|confirmation|booked)\b/i],
  ["Slow service & waiting", /\b(slow|wait(ed|ing)?|queue|delay(ed)?)\b/i],
  ["Spa & pool condition", /\b(spa|pool|jacuzzi|sauna)\b/i],
  ["Cleanliness", /\b(dirty|dusty|stain(ed)?|not clean|unclean|mould|mold)\b/i],
  ["Noise", /\b(noise|noisy|loud)\b/i],
  ["Maintenance", /\b(broken|maintenance|repair|faulty|leak(ing|ed)?|not working)\b/i],
  ["Wifi & technology", /\b(wifi|wi-fi|internet|tv (?:not|didn))\b/i],
  ["Parking", /\bparking\b/i],
  ["Temperature & heating", /\b(too (cold|hot)|heating|air ?con|temperature)\b/i],
  ["Staff attitude", /\b(rude|unfriendly|dismissive|ignored)\b/i],
];

export function buildRows(surveys: SurveyInput[], roster: RosterPerson[] = []): Row[] {
  return surveys.map((s) => {
    const a = s.answers;
    const checkin = s.check_in;
    const checkout = s.check_out;
    const nights = nightsBetween(checkin, checkout);

    const highlight = ans(a, "What was the highlight of your stay? Comment") ?? "";
    const improve = ans(a, "What could have been improved? Comment") ?? "";
    const standout = ans(a, "Did any particular team member stand out? If so, why? Comment") ?? "";
    const issue_text = ans(a, "Please describe what happened Comment") ?? "";
    const additional = ans(a, "Thank you so much for your input. Please provide any additional comments that you would like to share: Comment") ?? "";
    const event_comment =
      ans(a, "Please tell us the reasons for your scores about the function Comment") ??
      ans(a, "Please tell us the reasons for your wedding function scores Comment") ??
      "";

    const notes: Record<string, string> = {};
    for (const [key, q] of Object.entries(NOTE_QUESTIONS)) {
      const v = ans(a, q);
      if (v) notes[key] = v;
    }

    const returningRaw = ans(a, "Have you ever stayed with Hand Picked Hotels before?") ?? "";
    const returning = /first time/i.test(returningRaw) ? "First time" : returningRaw;

    const row: Row = {
      id: s.id,
      guest: s.guest_name,
      nps_group: s.nps_category ?? "",
      room: s.room,
      room_type: ans(a, "Room Type"),
      date: s.response_date,
      checkin,
      checkout,
      nights,
      nightsLabel: nights == null ? "" : nights >= 4 ? "4+ nights" : `${nights} night${nights === 1 ? "" : "s"}`,
      reason: ans(a, "What was the main reason for your stay?") ?? "",
      channel: ans(a, "Source Code") ?? "",
      market: ans(a, "Market code") ?? "",
      returning,
      found_us: (ans(a, "How did you first find out about us?") ?? "").trim(),
      spend: num(a, "Total Revenue"),
      value: ans(a, "Did your overall experience represent good value for money?") ?? "",
      had_issue: ans(a, "Did you experience any issues during your stay?") ?? "",
      issue_area: ans(a, "Please let us know the area where the issue occurred") ?? "",
      issue_impact: ans(a, "Please let us know to what extent this issue impacted your overall stay with us") ?? "",
      action_score: num(a, "How satisfied were you with the action we took?"),
      sustain_importance: num(a, "How important is sustainability to you when choosing a hotel?"),
      sustain_sat: num(a, "How satisfied were you with the sustainability practices observed at the hotel?"),
      highlight,
      improve,
      standout,
      issue_text,
      additional,
      event_comment,
      notes,
      staff: [],
      otherNames: [],
      themes: [],
      overall: s.overall_score,
      nps: null,
      replied: ans(a, "Replied") ?? "",
      reply: ans(a, "Management Response") ?? "",
      reply_date: ans(a, "Reply Date"),
    };

    for (const [key, , , question] of QS) {
      if (key === "overall" || key === "nps") continue;
      row[key] = num(a, question);
    }
    // The literal 0–10 "Recommendation" text only exists on a handful of
    // rows (dropped for most during the bulk import) — fall back to the
    // Promoter/Passive/Detractor bucket's midpoint, which covers nearly
    // every row, so NPS-based sections aren't starved of data.
    const literalNps = num(a, "Recommendation");
    row.nps =
      literalNps ??
      (s.nps_category === "Promoter" ? 9.5 : s.nps_category === "Passive" ? 7.5 : s.nps_category === "Detractor" ? 4 : null);

    // Staff mentions: "stand out" text is positively framed by the
    // question itself, so a real roster name found there is praise. The
    // same person re-appearing in improve/issue/additional text is only
    // flagged critical if that text actually reads negatively near their
    // name — a bare re-mention is usually a second thank-you ("also huge
    // thanks to Richard"), not a complaint.
    const praisePeople = matchRosterMentions(standout, roster);
    const staff: StaffMention[] = praisePeople.map((p) => ({ name: p.canonical, tone: "praise" as const, dept: guessDept(standout), quote: standout, field: "standout" }));
    for (const [field, text] of [["improve", improve], ["issue_text", issue_text], ["additional", additional]] as const) {
      if (!text) continue;
      for (const p of matchRosterMentions(text, roster)) {
        if (p.firstNames.some((f) => hasNearbyNegative(text, f))) {
          staff.push({ name: p.canonical, tone: "critical", dept: guessDept(text), quote: text, field });
        }
      }
    }
    row.staff = staff;

    // Low-confidence fallback: names guessed from free text that aren't a
    // match for anyone on the roster (e.g. a new starter not yet synced
    // from the rota sheet) — kept separate, never mixed into `staff`.
    const rosterFirstNames = new Set(roster.flatMap((p) => p.firstNames.map((f) => f.toLowerCase())));
    row.otherNames = Array.from(new Set(extractNames(standout).filter((n) => !rosterFirstNames.has(n.split(" ")[0].toLowerCase()))));

    const themeText = [improve, issue_text, additional].join(" \n ").toLowerCase();
    row.themes = THEMES.filter(([, re]) => re.test(themeText)).map(([name]) => name);

    return row;
  });
}

// ---------- aggregate helpers (ported from the reference dashboard) ----------

export function vals(rows: Row[], k: string): number[] {
  return rows.map((r) => r[k]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}
export function mean(rows: Row[], k: string): number | null {
  const v = vals(rows, k);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
export type Stats = { n: number; avg: number | null; low: number; mid: number; top: number };
export function stats(rows: Row[], k: string): Stats {
  const v = vals(rows, k);
  if (!v.length) return { n: 0, avg: null, low: 0, mid: 0, top: 0 };
  return {
    n: v.length,
    avg: v.reduce((a, b) => a + b, 0) / v.length,
    low: v.filter((x) => x <= 6).length / v.length,
    mid: v.filter((x) => x > 6 && x < 9).length / v.length,
    top: v.filter((x) => x >= 9).length / v.length,
  };
}
export function npsOf(rows: Row[]): number | null {
  const v = vals(rows, "nps");
  if (!v.length) return null;
  return Math.round(((v.filter((x) => x >= 9).length - v.filter((x) => x <= 6).length) / v.length) * 100);
}
export function share(rows: Row[], fn: (r: Row) => boolean, base?: (r: Row) => boolean): number | null {
  const b = base ? rows.filter(base) : rows;
  return b.length ? b.filter(fn).length / b.length : null;
}
export function pearson(rows: Row[], a: string, b: string): number | null {
  const p = rows.filter((r) => typeof r[a] === "number" && typeof r[b] === "number");
  if (p.length < 25) return null;
  const ma = mean(p, a)!, mb = mean(p, b)!;
  let num_ = 0, da = 0, db = 0;
  for (const r of p) {
    const x = (r[a] as number) - ma;
    const y = (r[b] as number) - mb;
    num_ += x * y;
    da += x * x;
    db += y * y;
  }
  return da && db ? num_ / Math.sqrt(da * db) : null;
}

export type StaffAgg = { name: string; praise: number; crit: number; dept: string; quotes: StaffMention[] };
export function staffAgg(rows: Row[]): StaffAgg[] {
  const m = new Map<string, { praiseR: Set<number>; critR: Set<number>; depts: Map<string, number>; quotes: StaffMention[] }>();
  for (const r of rows) {
    for (const s of r.staff) {
      if (!m.has(s.name)) m.set(s.name, { praiseR: new Set(), critR: new Set(), depts: new Map(), quotes: [] });
      const p = m.get(s.name)!;
      (s.tone === "critical" ? p.critR : p.praiseR).add(r.id);
      if (s.dept) p.depts.set(s.dept, (p.depts.get(s.dept) ?? 0) + 1);
      p.quotes.push(s);
    }
  }
  return Array.from(m.entries())
    .map(([name, p]) => ({
      name,
      praise: p.praiseR.size,
      crit: p.critR.size,
      dept: Array.from(p.depts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
      quotes: p.quotes,
    }))
    .sort((a, b) => b.praise - a.praise || b.crit - a.crit || a.name.localeCompare(b.name));
}

export type ThemeAgg = { name: string; n: number; rows: Row[] };
export function themeAgg(rows: Row[]): ThemeAgg[] {
  const m = new Map<string, Row[]>();
  for (const r of rows) for (const t of r.themes) { if (!m.has(t)) m.set(t, []); m.get(t)!.push(r); }
  return Array.from(m.entries()).map(([name, list]) => ({ name, n: list.length, rows: list })).sort((a, b) => b.n - a.n);
}

// Low-confidence tally of names mentioned that aren't on the rota roster.
export type OtherNameAgg = { name: string; n: number; row: Row };
export function otherNameAgg(rows: Row[]): OtherNameAgg[] {
  const m = new Map<string, { n: number; row: Row }>();
  for (const r of rows) for (const name of r.otherNames) {
    const existing = m.get(name);
    if (existing) existing.n++;
    else m.set(name, { n: 1, row: r });
  }
  return Array.from(m.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.n - a.n);
}
