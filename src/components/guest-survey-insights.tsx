"use client";

// Rebuilds, inside Team Ops, the structure of the reference dashboard at
// claude.ai/artifact/Lmud4ugsdJd6pGNhf7UjNr: the same 8 tabs, the same
// section headings and filter bar, computed live over `guest_surveys`.
//
// The rest of the app is strictly black-and-white, but these charts use
// real colour by request — same scoped exception as the rota's
// shift-colour coding. Panel chrome, text and borders stay in the app's
// usual ink/border tokens; only the data (bars, lines, heat cells) gets
// colour, so it still reads as a Team Ops page.

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { bg, border, ink, inkSoft } from "@/lib/design-tokens";
import {
  QS, QL, QSH, MONTH_COLS, DIMS,
  buildRows, buildRoster, applyManualRosterOverrides, vals, mean, stats, npsOf, share, pearson, staffAgg, themeAgg,
  type Row, type SurveyInput, type RosterPerson,
} from "@/lib/guest-survey-dashboard";

// ---------- small formatters & date helpers ----------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const fmt2 = (v: number | null) => (v == null || isNaN(v) ? "—" : v.toFixed(2));
const fmt1 = (v: number | null) => (v == null || isNaN(v) ? "—" : v.toFixed(1));
const pct = (v: number | null) => (v == null || isNaN(v) ? "—" : Math.round(v * 100) + "%");
const int = (v: number) => v.toLocaleString("en-GB");
const money = (v: number) => "£" + Math.round(v).toLocaleString("en-GB");
const pd = (s: string | null | undefined) => (s ? new Date(s + "T00:00:00Z") : null);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const dowIdx = (d: Date) => (d.getUTCDay() + 6) % 7;
const monthKey = (d: Date) => d.getUTCFullYear() * 100 + d.getUTCMonth();
const dayFmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortFmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const firstName = (n: string) => n.split(" ")[0];
function joinNames(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain, [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}
function scaleBand(domain: (string | number)[], range: [number, number], padding = 0.2) {
  const [r0, r1] = range;
  const step = (r1 - r0) / Math.max(1, domain.length);
  const bw = step * (1 - padding);
  const map = new Map(domain.map((d, i) => [d, r0 + i * step + (step - bw) / 2]));
  return { x: (d: string | number) => map.get(d) ?? r0, bandwidth: bw };
}

// ---------- chart colour palette (scoped to these charts only) ----------
const CHART = {
  primary: "#2563EB", // main series — line/trend, primary bars
  good: "#16A34A", // above average, promoters, praise
  bad: "#DC2626", // below average, detractors, issues, criticism
  amber: "#D97706", // moderate/warning (middling impact)
  grid: "#E5E7EB",
  ref: "#94A3B8", // dashed average/reference line
  muted: "#9CA3AF", // neutral bars (response counts, etc.)
  track: "#EEF2F6", // bar track background
};
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a), [br, bg_, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * Math.max(0, Math.min(1, t)));
  return `rgb(${c(ar, br)}, ${c(ag, bg_)}, ${c(ab, bb)})`;
}
function textOn(fillLightness: number): string {
  return fillLightness < 0.6 ? "#FFFFFF" : "#111111";
}
// Diverging red → white → green heat colour, scaled by how far `v` is
// from `avg` relative to `span`. `goodDir` flips the sense for metrics
// where lower is better (e.g. issue share).
function divColor(v: number | null, avg: number | null, span = 1.2, goodDir = 1): { background: string; color: string } | Record<string, never> {
  if (v == null || avg == null) return {};
  const t = Math.max(-1, Math.min(1, ((v - avg) / span) * goodDir));
  if (Math.abs(t) < 0.12) return {};
  const bgColor = t < 0 ? mixHex("#FFFFFF", CHART.bad, -t) : mixHex("#FFFFFF", CHART.good, t * 0.85);
  return { background: bgColor, color: textOn(1 - Math.abs(t) * 0.6) };
}
// Thin wrapper kept for call sites that only care about "notably below
// average" (tables where a single red flag reads better than a full scale).
function heatStyle(v: number | null, avg: number | null, goodDir = 1): React.CSSProperties {
  return divColor(v, avg, 1.2, goodDir);
}

// ---------- filter state ----------
type Filters = {
  kw: string; basis: "date" | "checkin" | "checkout"; from: string; to: string;
  months: Set<number>; dows: Set<number>; q: string;
  reason: string; channel: string; room_type: string; returning: string; nps_group: string;
  preset: string;
};
const emptyFilters = (): Filters => ({
  kw: "", basis: "date", from: "", to: "", months: new Set(), dows: new Set(), q: "overall",
  reason: "", channel: "", room_type: "", returning: "", nps_group: "", preset: "all",
});

function dOf(r: Row, basis: Filters["basis"]): Date | null {
  return pd(basis === "date" ? r.date : basis === "checkin" ? r.checkin : r.checkout);
}

function searchText(r: Row): string {
  return [r.highlight, r.improve, r.standout, r.issue_text, r.additional, r.event_comment, ...Object.values(r.notes), r.guest, r.room ?? "", r.staff.map((s) => s.name).join(" ")]
    .join("\n")
    .toLowerCase();
}

function monthsOf(rows: Row[], basis: Filters["basis"]): number[] {
  return Array.from(new Set(rows.map((r) => dOf(r, basis)).filter((d): d is Date => !!d).map(monthKey))).sort((a, b) => a - b);
}

// ---------- tiny chart primitives ----------
function KpiTile({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="p-3 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="text-[11px]" style={{ color: inkSoft }}>{label}</div>
      <div className="text-xl font-semibold mt-0.5" style={{ color: ink }}>
        {value}
        {unit && <span className="text-xs font-normal" style={{ color: inkSoft }}> {unit}</span>}
      </div>
      {note && <div className="text-[10px] mt-0.5" style={{ color: inkSoft }}>{note}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl mb-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: ink }}>{title}</div>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: inkSoft }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

type BarItem = { label: string; value: string; v: number; v2?: number; active?: boolean; onClick?: () => void; title?: string; color?: string; color2?: string };
function HBars({ items, max, empty, color = CHART.primary, color2 = CHART.bad }: { items: BarItem[]; max?: number; empty?: string; color?: string; color2?: string }) {
  if (!items.length) return <p className="text-xs" style={{ color: inkSoft }}>{empty ?? "Nothing in the current view."}</p>;
  const m = max ?? Math.max(...items.map((d) => d.v + (d.v2 ?? 0)), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((d, i) => {
        const Tag = d.onClick ? "button" : "div";
        return (
          <Tag
            key={i}
            type={d.onClick ? "button" : undefined}
            onClick={d.onClick}
            title={d.title}
            className="w-full flex items-center gap-2 text-left"
            style={d.active ? { background: "#F0F0F0", borderRadius: 6 } : undefined}
          >
            <span className="text-xs truncate" style={{ width: 170, flexShrink: 0, color: ink }}>{d.label}</span>
            <span className="flex-1 flex rounded-full overflow-hidden" style={{ height: 8, background: CHART.track }}>
              <span style={{ width: `${Math.max(0, (d.v / m) * 100)}%`, background: d.color ?? color }} />
              {d.v2 ? <span style={{ width: `${(d.v2 / m) * 100}%`, background: d.color2 ?? color2 }} /> : null}
            </span>
            <span className="text-xs shrink-0 text-right" style={{ width: 64, color: inkSoft }}>{d.value}</span>
          </Tag>
        );
      })}
    </div>
  );
}

function LineChartSvg({ points, avgAll, onClick }: { points: { t: Date; avg: number | null; qn: number }[]; avgAll: number | null; onClick?: (p: { t: Date; avg: number }) => void }) {
  const pts = points.filter((p) => p.avg != null) as { t: Date; avg: number; qn: number }[];
  if (pts.length < 2) return <p className="text-xs" style={{ color: inkSoft }}>Not enough answers per period to draw a trend.</p>;
  const W = 600, H = 220, m = { t: 14, r: 16, b: 24, l: 34 };
  const times = pts.map((p) => p.t.getTime());
  const x = scaleLinear([Math.min(...times), Math.max(...times)], [m.l, W - m.r]);
  const lo = Math.min(...pts.map((p) => p.avg)), hi = Math.max(...pts.map((p) => p.avg));
  const y = scaleLinear([Math.max(0, Math.floor((lo - 0.3) * 2) / 2), Math.min(10, Math.ceil((hi + 0.2) * 2) / 2)], [H - m.b, m.t]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t.getTime())},${y(p.avg)}`).join(" ");
  const best = pts.reduce((a, b) => (b.avg > a.avg ? b : a));
  const worst = pts.reduce((a, b) => (b.avg < a.avg ? b : a));
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Score trend">
      {[0, 2.5, 5, 7.5, 10].filter((v) => v >= Math.floor(lo) - 1 && v <= Math.ceil(hi) + 1).map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={CHART.grid} />
          <text x={m.l - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={inkSoft}>{v}</text>
        </g>
      ))}
      {avgAll != null && (
        <>
          <line x1={m.l} x2={W - m.r} y1={y(avgAll)} y2={y(avgAll)} stroke={CHART.ref} strokeDasharray="4 4" />
          <text x={W - m.r} y={y(avgAll) - 5} textAnchor="end" fontSize={10} fill={inkSoft}>average {fmt2(avgAll)}</text>
        </>
      )}
      <path d={d} fill="none" stroke={CHART.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={x(p.t.getTime())}
          cy={y(p.avg)}
          r={p === best || p === worst ? 5 : 3}
          fill={p === best ? CHART.good : p === worst ? CHART.bad : CHART.primary}
          style={{ cursor: onClick ? "pointer" : "default" }}
          onClick={() => onClick?.(p)}
        >
          <title>{`${shortFmt(p.t)}: average ${fmt2(p.avg)} from ${p.qn} answers`}</title>
        </circle>
      ))}
      <text x={x(best.t.getTime())} y={y(best.avg) - 10} textAnchor="middle" fontSize={10} fill={CHART.good}>best {fmt2(best.avg)}</text>
      {worst !== best && <text x={x(worst.t.getTime())} y={y(worst.avg) + 16} textAnchor="middle" fontSize={10} fill={CHART.bad}>lowest {fmt2(worst.avg)}</text>}
    </svg>
  );
}

function CountBarsSvg({ per }: { per: { t: Date; n: number }[] }) {
  if (!per.length) return null;
  const W = 600, H = 70, m = { t: 6, r: 16, b: 18, l: 34 };
  const x = scaleBand(per.map((p) => +p.t), [m.l, W - m.r], 0.25);
  const maxN = Math.max(...per.map((p) => p.n), 1);
  const y = scaleLinear([0, maxN], [H - m.b, m.t]);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {per.map((p, i) => (
        <rect key={i} x={x.x(+p.t)} y={y(p.n)} width={x.bandwidth} height={Math.max(0, y(0) - y(p.n))} fill={CHART.muted} rx={2}>
          <title>{`${shortFmt(p.t)}: ${p.n} responses`}</title>
        </rect>
      ))}
    </svg>
  );
}

function HistogramSvg({ rows, k, qScore, onClick }: { rows: Row[]; k: string; qScore: number | null; onClick: (s: number) => void }) {
  const v = vals(rows, k);
  if (!v.length) return <p className="text-xs" style={{ color: inkSoft }}>No answers in this view.</p>;
  const lo = k === "nps" ? 0 : 1;
  const bins = Array.from({ length: 11 - lo }, (_, i) => i + lo).map((s) => ({ s, n: v.filter((x) => Math.round(x) === s).length }));
  const W = 500, H = 180, m = { t: 16, r: 8, b: 22, l: 28 };
  const x = scaleBand(bins.map((b) => b.s), [m.l, W - m.r], 0.2);
  const maxN = Math.max(...bins.map((b) => b.n), 1);
  const y = scaleLinear([0, maxN], [H - m.b, m.t]);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {bins.map((b) => (
        <g key={b.s} opacity={qScore == null || qScore === b.s ? 1 : 0.35} style={{ cursor: "pointer" }} onClick={() => onClick(b.s)}>
          <rect x={x.x(b.s)} y={y(b.n)} width={x.bandwidth} height={Math.max(0, y(0) - y(b.n))} fill={b.s <= 6 ? CHART.bad : b.s >= 9 ? CHART.good : CHART.muted} rx={2}>
            <title>{`Score ${b.s}: ${b.n} guests (${pct(b.n / v.length)})`}</title>
          </rect>
          {b.n > 0 && <text x={x.x(b.s) + x.bandwidth / 2} y={y(b.n) - 4} textAnchor="middle" fontSize={10} fill={ink}>{b.n}</text>}
          <text x={x.x(b.s) + x.bandwidth / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={inkSoft}>{b.s}</text>
        </g>
      ))}
    </svg>
  );
}

function MatrixSvg({ rows, focusKey, onClick }: { rows: Row[]; focusKey: string; onClick: (k: string) => void }) {
  const pts = QS.filter(([k]) => k !== "nps" && k !== "overall")
    .map(([k]) => ({ k, avg: mean(rows, k), r: pearson(rows, k, "nps"), n: vals(rows, k).length }))
    .filter((p): p is { k: string; avg: number; r: number; n: number } => p.r != null && p.avg != null);
  if (pts.length < 3) return <p className="text-xs" style={{ color: inkSoft }}>Not enough answers in this view to compare questions.</p>;
  const W = 680, H = 320, m = { t: 16, r: 20, b: 36, l: 44 };
  const avgs = pts.map((p) => p.avg), rs = pts.map((p) => p.r);
  const x = scaleLinear([Math.min(...avgs), Math.max(...avgs)], [m.l, W - m.r]);
  const y = scaleLinear([Math.min(0, ...rs), Math.max(0.1, ...rs)], [H - m.b, m.t]);
  const sortedAvg = avgs.slice().sort((a, b) => a - b);
  const sortedR = rs.slice().sort((a, b) => a - b);
  const mx = sortedAvg[Math.floor(sortedAvg.length / 2)];
  const my = sortedR[Math.floor(sortedR.length / 2)];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Priority matrix">
      <rect x={m.l} y={m.t} width={Math.max(0, x(mx) - m.l)} height={Math.max(0, y(my) - m.t)} fill={CHART.bad} opacity={0.07} />
      <line x1={x(mx)} x2={x(mx)} y1={m.t} y2={H - m.b} stroke={CHART.grid} strokeDasharray="4 4" />
      <line x1={m.l} x2={W - m.r} y1={y(my)} y2={y(my)} stroke={CHART.grid} strokeDasharray="4 4" />
      <text x={m.l + 4} y={m.t + 12} fontSize={10} fill={CHART.bad}>Fix first</text>
      <text x={W - m.r - 4} y={m.t + 12} textAnchor="end" fontSize={10} fill={CHART.good}>Protect</text>
      <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" fontSize={10} fill={inkSoft}>Average score →</text>
      {pts.map((p) => (
        <g key={p.k} style={{ cursor: "pointer" }} onClick={() => onClick(p.k)}>
          <circle cx={x(p.avg)} cy={y(p.r)} r={p.k === focusKey ? 7 : 5} fill={p.avg < mx && p.r > my ? CHART.bad : CHART.primary} stroke={p.k === focusKey ? ink : bg} strokeWidth={2}>
            <title>{`${QL[p.k]}: average ${fmt2(p.avg)} from ${p.n} answers, link to recommending ${p.r.toFixed(2)}`}</title>
          </circle>
          <text x={x(p.avg) + 8} y={y(p.r)} dy="0.32em" fontSize={10} fontWeight={p.k === focusKey ? 600 : 400} fill={ink}>{QSH[p.k]}</text>
        </g>
      ))}
    </svg>
  );
}

function Calendar({ rows, k, basis, F, setF }: { rows: Row[]; k: string; basis: Filters["basis"]; F: Filters; setF: (f: Filters) => void }) {
  const days = rows.map((r) => dOf(r, basis)).filter((d): d is Date => !!d);
  if (!days.length) return <p className="text-xs" style={{ color: inkSoft }}>No responses in this view.</p>;
  const byDay = new Map<string, Row[]>();
  for (const r of rows) { const d = dOf(r, basis); if (!d) continue; const s = iso(d); if (!byDay.has(s)) byDay.set(s, []); byDay.get(s)!.push(r); }
  const min = new Date(Math.min(...days.map((d) => d.getTime())));
  const max = new Date(Math.max(...days.map((d) => d.getTime())));
  const start = addDays(min, -dowIdx(min));
  const all: Date[] = [];
  for (let d = start; d <= max; d = addDays(d, 1)) all.push(d);
  const weeks: Date[][] = [];
  for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
  const avgAll = mean(rows, k);
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            <div className="text-[9px] h-3" style={{ color: inkSoft }}>{week[0].getUTCDate() <= 7 ? MONTHS[week[0].getUTCMonth()] : ""}</div>
            {week.map((d, di) => {
              const s = iso(d);
              const rs = byDay.get(s);
              const avg = rs ? mean(rs, k) : null;
              const inRange = d >= min && d <= max;
              const selected = F.from === s && F.to === s;
              const fill = divColor(avg, avgAll, 1.2);
              return (
                <button
                  key={di}
                  type="button"
                  disabled={!rs}
                  title={rs ? `${dayFmt(d)}: ${rs.length} response${rs.length === 1 ? "" : "s"}${avg != null ? `, ${QSH[k]} average ${fmt2(avg)}` : ""}` : ""}
                  onClick={() => setF(selected ? { ...F, from: "", to: "", preset: "all" } : { ...F, from: s, to: s, preset: "", months: new Set() })}
                  style={{
                    width: 15, height: 15, borderRadius: 3,
                    background: !inRange ? "transparent" : "background" in fill ? fill.background : rs ? bg : "#F5F5F5",
                    border: selected ? `2px solid ${ink}` : inRange ? `1px solid ${border}` : "none",
                    cursor: rs ? "pointer" : "default",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px]" style={{ color: inkSoft }}>
        <span style={{ width: 10, height: 10, background: CHART.bad, display: "inline-block", borderRadius: 2 }} /> below average
        <span style={{ width: 10, height: 10, background: CHART.good, display: "inline-block", borderRadius: 2 }} /> above average
        <span style={{ width: 10, height: 10, background: "#F5F5F5", display: "inline-block", borderRadius: 2 }} /> no responses
      </div>
    </div>
  );
}

function QuoteCard({ r, text, tag, onClick }: { r: Row; text: string; tag?: string; onClick: () => void }) {
  if (!text) return null;
  return (
    <button type="button" onClick={onClick} className="w-full text-left p-2.5 rounded-xl mb-2" style={{ border: `1px solid ${border}` }}>
      <p className="text-sm" style={{ color: ink }}>&ldquo;{text.length > 400 ? text.slice(0, 400) + "…" : text}&rdquo;</p>
      <div className="flex gap-2 mt-1 text-[10px]" style={{ color: inkSoft }}>
        <span>{r.date ? shortFmt(pd(r.date)!) : ""}</span>
        <span>{r.guest}</span>
        {r.room && <span>Room {r.room}</span>}
        {r.overall != null && <span>Overall {r.overall}/10</span>}
        {tag && <span className="font-medium" style={{ color: ink }}>{tag}</span>}
      </div>
    </button>
  );
}

function ResponseModal({ r, onClose }: { r: Row; onClose: () => void }) {
  const scores = QS.filter(([k]) => typeof r[k] === "number").map(([k]) => ({ k, v: r[k] as number }));
  const sections: [string, string][] = [
    ["Highlight of the stay", r.highlight], ["What could have been improved", r.improve], ["Team member stand-out", r.standout],
    ["Issue", r.issue_text], ["Event feedback", r.event_comment], ["Anything else", r.additional],
    ...Object.entries(r.notes).map(([k, v]) => [`Comment on ${QL[k]?.toLowerCase() ?? k}`, v] as [string, string]),
    ["Our reply", r.reply],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto p-5 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: ink }}>{r.guest}</h2>
            <p className="text-xs" style={{ color: inkSoft }}>{r.date ? dayFmt(pd(r.date)!) : "—"} · Room {r.room ?? "—"} {r.nps_group ? `· ${r.nps_group}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded-2xl" style={{ border: `1px solid ${border}` }}>Close</button>
        </div>
        <dl className="grid grid-cols-2 gap-1.5 text-xs mb-3">
          <dt style={{ color: inkSoft }}>Stay</dt><dd style={{ color: ink }}>{r.checkin && r.checkout ? `${shortFmt(pd(r.checkin)!)} – ${shortFmt(pd(r.checkout)!)}` : "—"}{r.nights != null ? ` (${r.nights}n)` : ""}</dd>
          <dt style={{ color: inkSoft }}>Reason</dt><dd style={{ color: ink }}>{r.reason || "—"}</dd>
          <dt style={{ color: inkSoft }}>Room type</dt><dd style={{ color: ink }}>{r.room_type || "—"}</dd>
          <dt style={{ color: inkSoft }}>Guest</dt><dd style={{ color: ink }}>{r.returning || "—"}</dd>
          <dt style={{ color: inkSoft }}>Total spend</dt><dd style={{ color: ink }}>{r.spend != null ? money(r.spend) : "—"}</dd>
          <dt style={{ color: inkSoft }}>Value for money</dt><dd style={{ color: ink }}>{r.value || "—"}</dd>
          <dt style={{ color: inkSoft }}>Had an issue</dt><dd style={{ color: ink }}>{r.had_issue ? `${r.had_issue}${r.issue_area ? " · " + r.issue_area : ""}` : "—"}</dd>
          {(r.replied === "Yes" || r.replied === "No") && (<><dt style={{ color: inkSoft }}>Replied</dt><dd style={{ color: ink }}>{r.replied === "Yes" ? `Yes${r.reply_date ? ` on ${shortFmt(pd(r.reply_date)!)}` : ""}` : "Not yet"}</dd></>)}
        </dl>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {scores.map(({ k, v }) => (
            <span key={k} className="text-[11px] px-2 py-0.5 rounded-full" style={v <= 6 ? { background: CHART.bad, color: "#fff" } : v >= 9 ? { background: CHART.good, color: "#fff" } : { border: `1px solid ${border}` }}>{QSH[k]} {v}</span>
          ))}
        </div>
        {sections.filter(([, v]) => v).map(([t, v]) => (
          <div key={t} className="mb-2.5">
            <div className="text-[11px] font-medium" style={{ color: inkSoft }}>{t}</div>
            <div className="text-sm" style={{ color: ink }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= main component =================
export function GuestSurveyInsights({ surveys }: { surveys: SurveyInput[] }) {
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("rota_staff_order")
      .select("staff_name")
      .then(({ data }) => setRoster(applyManualRosterOverrides(buildRoster((data ?? []).map((r) => r.staff_name)))));
  }, []);

  const ALL = useMemo(() => buildRows(surveys, roster), [surveys, roster]);
  const DMAX = useMemo(() => { const ds = ALL.map((r) => pd(r.date)).filter((d): d is Date => !!d); return ds.length ? new Date(Math.max(...ds.map((d) => d.getTime()))) : null; }, [ALL]);

  const [F, setF] = useState<Filters>(emptyFilters());
  const [tab, setTab] = useState("overview");
  const [gran, setGran] = useState<"week" | "month">("month");
  const [person, setPerson] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [fuMode, setFuMode] = useState<"open" | "all">("all");
  const [qScore, setQScore] = useState<number | null>(null);
  const [dim, setDim] = useState("reason");
  const [cmQ, setCmQ] = useState("");
  const [cmField, setCmField] = useState("all");
  const [cmLimit, setCmLimit] = useState(60);
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const didInitFilters = useRef(false);

  const kwPass = (r: Row) => {
    if (!F.kw) return true;
    const terms = F.kw.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const text = searchText(r);
    return !terms.length || terms.some((term) => term.split(/\s+/).every((w) => text.includes(w)));
  };
  const segPass = (r: Row) =>
    kwPass(r) &&
    (!F.reason || r.reason === F.reason) &&
    (!F.channel || r.channel === F.channel) &&
    (!F.room_type || r.room_type === F.room_type) &&
    (!F.returning || r.returning === F.returning) &&
    (!F.nps_group || r.nps_group === F.nps_group);
  const datePass = (r: Row, from: string, to: string) => { const d = dOf(r, F.basis); if (!d) return false; const s = iso(d); return (!from || s >= from) && (!to || s <= to); };
  const calPass = (r: Row) => { const d = dOf(r, F.basis); if (!d) return false; return (!F.months.size || F.months.has(monthKey(d))) && (!F.dows.size || F.dows.has(dowIdx(d))); };

  const rows = useMemo(() => ALL.filter((r) => segPass(r) && datePass(r, F.from, F.to) && calPass(r)), [ALL, F]);
  const prev = useMemo(() => {
    if (!F.from || !F.to || F.months.size) return null;
    const a = pd(F.from)!, b = pd(F.to)!;
    const len = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
    const pf = iso(addDays(a, -len)), pt = iso(addDays(a, -1));
    const prows = ALL.filter((r) => segPass(r) && datePass(r, pf, pt) && calPass(r));
    return prows.length ? { rows: prows, label: `previous ${len} days` } : null;
  }, [ALL, F]);

  const go = (t: string) => setTab(t);
  const applyPreset = (p: string) => {
    if (!DMAX) return;
    const nf: Filters = { ...F, preset: p, months: new Set() };
    if (p === "all") { nf.from = ""; nf.to = ""; }
    else if (p === "30" || p === "90") { nf.from = iso(addDays(DMAX, -(+p - 1))); nf.to = iso(DMAX); }
    else if (p === "month") { nf.from = iso(new Date(Date.UTC(DMAX.getUTCFullYear(), DMAX.getUTCMonth(), 1))); nf.to = iso(DMAX); }
    else if (p === "lastmonth") { const a = new Date(Date.UTC(DMAX.getUTCFullYear(), DMAX.getUTCMonth() - 1, 1)); nf.from = iso(a); nf.to = iso(new Date(Date.UTC(DMAX.getUTCFullYear(), DMAX.getUTCMonth(), 0))); }
    setF(nf);
  };

  if (!didInitFilters.current && ALL.length) didInitFilters.current = true;

  const allMonths = monthsOf(ALL, F.basis);

  const uniq = (k: keyof Row) => Array.from(new Set(ALL.map((r) => r[k] as string).filter(Boolean))).sort();

  const TABS: [string, string][] = [
    ["overview", "Overview"], ["trends", "Trends & calendar"], ["questions", "Questions"], ["team", "Team"],
    ["problems", "Problems"], ["guests", "Guests"], ["followups", "Follow-ups"], ["comments", "Comments"],
  ];

  if (surveys.length === 0) {
    return <p className="text-sm" style={{ color: inkSoft }}>No survey responses yet — insights will appear once some come in.</p>;
  }

  // ---------- headline ----------
  const headline = (() => {
    if (!rows.length) return "No responses match these filters. Try widening the dates or clearing a filter.";
    const st = QS.filter(([k]) => k !== "nps" && k !== "overall").map(([k]) => ({ k, ...stats(rows, k) })).filter((s) => s.n >= 15).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
    const best = st[0], worst = st[st.length - 1];
    const span = rows.map((r) => pd(r.date)).filter((d): d is Date => !!d);
    const lo = span.length ? new Date(Math.min(...span.map((d) => d.getTime()))) : null;
    const hi = span.length ? new Date(Math.max(...span.map((d) => d.getTime()))) : null;
    let t = `${int(rows.length)} guests responded${lo ? ` between ${shortFmt(lo)} and ${shortFmt(hi!)}` : ""}, rating their stay ${fmt2(mean(rows, "overall"))} out of 10 with a recommend score (NPS) of ${npsOf(rows) ?? "—"}.`;
    if (best && worst) t += ` ${QL[best.k]} is the strongest area (${fmt2(best.avg)}) and ${QL[worst.k].toLowerCase()} the weakest (${fmt2(worst.avg)}).`;
    return t;
  })();

  return (
    <div>
      {openRow && <ResponseModal r={openRow} onClose={() => setOpenRow(null)} />}

      {/* ---------- filter bar ---------- */}
      <div className="p-3 rounded-2xl mb-4 flex flex-col gap-2.5" style={{ background: bg, border: `1px solid ${border}` }}>
        <div className="flex flex-wrap gap-1.5">
          {[["all", "All"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["month", "This month"], ["lastmonth", "Last month"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => applyPreset(k)} className="text-[11px] px-2.5 py-1 rounded-2xl" style={F.preset === k ? { background: ink, color: bg } : { border: `1px solid ${border}` }}>{l}</button>
          ))}
          <input type="date" value={F.from} onChange={(e) => setF({ ...F, from: e.target.value, preset: "" })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }} />
          <input type="date" value={F.to} onChange={(e) => setF({ ...F, to: e.target.value, preset: "" })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }} />
          <select value={F.basis} onChange={(e) => setF({ ...F, basis: e.target.value as Filters["basis"] })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }}>
            <option value="date">Dates are: survey date</option>
            <option value="checkin">Dates are: arrival</option>
            <option value="checkout">Dates are: departure</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <input placeholder="Search comments…" value={F.kw} onChange={(e) => setF({ ...F, kw: e.target.value })} className="text-[11px] px-2.5 py-1 rounded-2xl flex-1 min-w-[140px]" style={{ border: `1px solid ${border}`, background: bg, color: ink }} />
          {([["reason", "All reasons"], ["channel", "All channels"], ["room_type", "All room types"], ["returning", "All guests"]] as const).map(([k, label]) => (
            <select key={k} value={F[k]} onChange={(e) => setF({ ...F, [k]: e.target.value })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }}>
              <option value="">{label}</option>
              {uniq(k).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ))}
          <select value={F.nps_group} onChange={(e) => setF({ ...F, nps_group: e.target.value })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }}>
            <option value="">All NPS groups</option>
            {["Promoter", "Passive", "Detractor"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={F.q} onChange={(e) => { setF({ ...F, q: e.target.value }); setQScore(null); }} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }}>
            {QS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allMonths.map((m) => (
            <button key={m} type="button" onClick={() => { const s = new Set(F.months); if (s.has(m)) s.delete(m); else s.add(m); setF({ ...F, months: s, from: "", to: "", preset: "" }); }}
              className="text-[11px] px-2 py-1 rounded-2xl" style={F.months.has(m) ? { background: ink, color: bg } : { border: `1px solid ${border}` }}>
              {MONTHS[m % 100]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DOWS.map((d, i) => (
            <button key={d} type="button" onClick={() => { const s = new Set(F.dows); if (s.has(i)) s.delete(i); else s.add(i); setF({ ...F, dows: s }); }}
              className="text-[11px] px-2 py-1 rounded-2xl" style={F.dows.has(i) ? { background: ink, color: bg } : { border: `1px solid ${border}` }}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => setF(emptyFilters())} className="text-[11px] px-2.5 py-1 rounded-2xl" style={{ border: `1px solid ${border}` }}>Reset filters</button>
          <span className="text-[11px] ml-auto" style={{ color: inkSoft }}>{int(rows.length)} of {int(ALL.length)} responses</span>
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: ink }}>{headline}</p>

      {/* ---------- tabs ---------- */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => go(id)} className="text-xs font-medium px-3 py-1.5 rounded-2xl shrink-0"
            style={tab === id ? { background: ink, color: bg } : { border: `1px solid ${border}`, color: ink }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab rows={rows} prev={prev} F={F} setF={setF} go={go} />
      )}
      {tab === "trends" && (
        <TrendsTab rows={rows} F={F} setF={setF} gran={gran} setGran={setGran} />
      )}
      {tab === "questions" && (
        <QuestionsTab rows={rows} ALL={ALL} F={F} qScore={qScore} setQScore={setQScore} setF={setF} onOpen={setOpenRow} />
      )}
      {tab === "team" && (
        <TeamTab rows={rows} person={person} setPerson={setPerson} onOpen={setOpenRow} />
      )}
      {tab === "problems" && (
        <ProblemsTab rows={rows} prev={prev} theme={theme} setTheme={setTheme} room={room} setRoom={setRoom} onOpen={setOpenRow} />
      )}
      {tab === "guests" && (
        <GuestsTab rows={rows} dim={dim} setDim={setDim} F={F} setF={setF} />
      )}
      {tab === "followups" && (
        <FollowupsTab rows={rows} fuMode={fuMode} setFuMode={setFuMode} onOpen={setOpenRow} />
      )}
      {tab === "comments" && (
        <CommentsTab rows={rows} cmQ={cmQ} setCmQ={setCmQ} cmField={cmField} setCmField={setCmField} cmLimit={cmLimit} setCmLimit={setCmLimit} onOpen={setOpenRow} />
      )}
    </div>
  );
}

// ================= OVERVIEW =================
function OverviewTab({ rows, prev, F, setF, go }: { rows: Row[]; prev: { rows: Row[]; label: string } | null; F: Filters; setF: (f: Filters) => void; go: (t: string) => void }) {
  const nps = npsOf(rows);
  const ov = mean(rows, "overall");
  const vfm = share(rows, (r) => r.value === "Yes", (r) => !!r.value);
  const iss = share(rows, (r) => r.had_issue === "Yes", (r) => !!r.had_issue);
  const det = rows.filter((r) => r.nps != null && r.nps <= 6);

  const st = QS.map(([k]) => ({ k, ...stats(rows, k) })).filter((s) => s.n >= 15 && s.k !== "nps");
  const sorted = [...st].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  const good: React.ReactNode[] = [];
  const bad: React.ReactNode[] = [];
  sorted.slice(0, 3).forEach((s, i) => good.push(<span key={"g" + i}><b>{QL[s.k]}</b> averages {fmt2(s.avg)}, with {pct(s.top)} of guests scoring it 9 or 10.</span>));
  const ppl = staffAgg(rows);
  if (ppl.length) {
    const top5 = ppl.slice(0, 5);
    const topCount = top5[0].praise;
    // Several people can be tied at the top praise count — calling out
    // just one of them as "the most-praised" would misrepresent a tie.
    const leaders = top5.filter((p) => p.praise === topCount);
    const rest = top5.slice(leaders.length).map((p) => `${firstName(p.name)} (${p.praise})`);
    const restText = rest.length ? `, followed by ${joinNames(rest)}` : "";
    good.push(
      <span key="staff">
        <b>{joinNames(leaders.map((p) => firstName(p.name)))}</b>{" "}
        {leaders.length === 1 ? "is the most-praised team member" : "are the most-praised team members"} ({topCount} guest{topCount === 1 ? "" : "s"}{leaders.length > 1 ? " each" : ""}){restText}.
      </span>
    );
  }
  sorted.slice(-3).reverse().forEach((s, i) => bad.push(<span key={"b" + i}><b>{QL[s.k]}</b> is among the lowest at {fmt2(s.avg)}; {pct(s.low)} scored it 6 or below.</span>));
  const th = themeAgg(rows)[0];
  if (th) bad.push(<span key="theme"><b>{th.name}</b> is the most common complaint theme, in {pct(th.n / rows.length)} of responses ({th.n}).</span>);
  if (det.length) bad.push(<span key="unhappy"><b>{det.length} unhappy guest{det.length === 1 ? "" : "s"}</b> scored their likelihood to recommend 0–6. See Follow-ups.</span>);
  if (prev && prev.rows.length >= 10 && rows.length >= 10) {
    const movers = QS.filter(([key]) => key !== "nps").map(([key]) => { const a = stats(rows, key), b = stats(prev.rows, key); return { key, d: a.n >= 8 && b.n >= 8 && a.avg != null && b.avg != null ? a.avg - b.avg : null, a: a.avg }; }).filter((x): x is { key: string; d: number; a: number } => x.d != null);
    movers.sort((a, b) => a.d - b.d);
    const down = movers[0], up = movers[movers.length - 1];
    if (up && up.d > 0.1) good.push(<span key="up"><b>{QL[up.key]}</b> is rising: {fmt2(up.a)} this period, up {up.d.toFixed(2)} on {prev.label}.</span>);
    if (down && down.d < -0.1) bad.push(<span key="down"><b>{QL[down.key]}</b> is slipping: {fmt2(down.a)} this period, down {Math.abs(down.d).toFixed(2)} on {prev.label}.</span>);
  }

  const allAvg = Object.fromEntries(QS.map(([k]) => [k, mean(rows, k)]));
  const board = QS.map(([k, l]) => ({ k, l, s: stats(rows, k) })).filter((x) => x.s.n > 0).sort((a, b) => (b.s.avg ?? 0) - (a.s.avg ?? 0));

  const wk = new Map<string, Row[]>();
  for (const r of rows) { const d = dOf(r, F.basis); if (!d || typeof r[F.q] !== "number") continue; const monday = addDays(d, -dowIdx(d)); const key = iso(monday); if (!wk.has(key)) wk.set(key, []); wk.get(key)!.push(r); }
  const weekStats = Array.from(wk.entries()).map(([w, rs]) => ({ w, n: rs.length, avg: mean(rs, F.q) })).filter((x) => x.n >= 5);
  const sw = [...weekStats].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  const weekItem = (color: string) => (x: { w: string; avg: number | null; n: number }): BarItem => ({
    label: "w/c " + dayFmt(pd(x.w)!), value: fmt2(x.avg), v: x.avg ?? 0, color, title: `Average ${fmt2(x.avg)} from ${x.n} answers`,
    onClick: () => setF({ ...F, from: x.w, to: iso(addDays(pd(x.w)!, 6)), preset: "", months: new Set() }),
  });

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        <KpiTile label="Responses" value={int(rows.length)} note="Monthly volume on Trends" />
        <KpiTile label="Recommend score (NPS)" value={nps == null ? "—" : String(nps)} note="% promoters minus % detractors" />
        <KpiTile label="Overall experience" value={fmt2(ov)} unit="/ 10" />
        <KpiTile label="Good value for money" value={pct(vfm)} note="Of guests who answered" />
        <KpiTile label="Had an issue" value={pct(iss)} note="Lower is better" />
        <KpiTile label="Unhappy guests (NPS ≤6)" value={String(det.length)} note="See Follow-ups" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title="What's going well" subtitle="Highest-scoring areas in the current view">
          <ul className="flex flex-col gap-2">{good.length ? good.map((g, i) => <li key={i} className="text-xs flex gap-1.5" style={{ color: ink }}><span style={{ color: CHART.good, fontWeight: 700 }}>+</span><span>{g}</span></li>) : <li className="text-xs" style={{ color: inkSoft }}>Not enough responses in this view.</li>}</ul>
        </Panel>
        <Panel title="What needs attention" subtitle="Lowest scores, most complaints and anything slipping">
          <ul className="flex flex-col gap-2">{bad.length ? bad.map((b, i) => <li key={i} className="text-xs flex gap-1.5" style={{ color: ink }}><span style={{ color: CHART.bad, fontWeight: 700 }}>−</span><span>{b}</span></li>) : <li className="text-xs" style={{ color: inkSoft }}>Not enough responses in this view.</li>}</ul>
        </Panel>
      </div>

      <Panel title="Every question at a glance" subtitle="Average out of 10 and share of low (1–6) / middling (7–8) / top (9–10) scores. Click a row to focus on it.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr style={{ borderBottom: `1px solid ${border}` }}>
              <th className="text-left py-1.5" style={{ color: inkSoft }}>Question</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Average</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Answers</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Low (1–6)</th>
            </tr></thead>
            <tbody>
              {board.map(({ k, l, s }) => (
                <tr key={k} onClick={() => go("questions")} className="cursor-pointer" style={{ borderBottom: "1px solid #EEE" }}>
                  <td className="py-1.5" style={{ color: ink }}>{l}{k === F.q ? <span style={{ color: inkSoft }}> · in focus</span> : null}</td>
                  <td className="text-right" style={heatStyle(s.avg, allAvg[k])}>{fmt2(s.avg)}</td>
                  <td className="text-right" style={{ color: inkSoft }}>{int(s.n)}</td>
                  <td className="text-right" style={{ color: ink }}>{pct(s.low)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title="Best weeks" subtitle={`${QL[F.q]}, weeks with 5+ answers. Click a week to filter to it.`}>
          <HBars items={sw.slice(0, 5).map(weekItem(CHART.good))} max={10} empty="Not enough weeks with 5+ answers." />
        </Panel>
        <Panel title="Toughest weeks" subtitle={`${QL[F.q]}, weeks with 5+ answers. Click a week to filter to it.`}>
          <HBars items={sw.slice(-5).reverse().map(weekItem(CHART.bad))} max={10} empty="Not enough weeks with 5+ answers." />
        </Panel>
      </div>
    </div>
  );
}

// ================= TRENDS =================
function TrendsTab({ rows, F, setF, gran, setGran }: { rows: Row[]; F: Filters; setF: (f: Filters) => void; gran: "week" | "month"; setGran: (g: "week" | "month") => void }) {
  const k = F.q;
  const periodKey = (d: Date) => (gran === "week" ? iso(addDays(d, -dowIdx(d))) : iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))));
  const per = new Map<string, Row[]>();
  for (const r of rows) { const d = dOf(r, F.basis); if (!d) continue; const key = periodKey(d); if (!per.has(key)) per.set(key, []); per.get(key)!.push(r); }
  const series = Array.from(per.entries()).map(([t, rs]) => ({ t: pd(t)!, avg: vals(rs, k).length >= (gran === "week" ? 3 : 5) ? mean(rs, k) : null, n: rs.length, qn: vals(rs, k).length })).sort((a, b) => a.t.getTime() - b.t.getTime());
  const avgAll = mean(rows, k);

  const dowAgg = DOWS.map((n, i) => ({ i, n, s: stats(rows.filter((r) => { const d = dOf(r, F.basis); return d && dowIdx(d) === i; }), k) }));
  const ng = Array.from(new Set(rows.map((r) => r.nightsLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  const ms = monthsOf(rows, F.basis);
  const g = new Map<number, Row[]>();
  for (const r of rows) { const d = dOf(r, F.basis); if (!d) continue; const mk = monthKey(d); if (!g.has(mk)) g.set(mk, []); g.get(mk)!.push(r); }
  const cols: [string, string][] = [["n", "Responses"], ["npsv", "NPS"], ...MONTH_COLS.map((c) => [c, QSH[c]] as [string, string]), ["vfm", "Value"], ["iss", "Issues"]];
  const cell = (rs: Row[] | undefined, c: string): number | null => {
    const rows2 = rs ?? [];
    if (c === "n") return rows2.length;
    if (c === "npsv") return npsOf(rows2);
    if (c === "vfm") return share(rows2, (r) => r.value === "Yes", (r) => !!r.value);
    if (c === "iss") return share(rows2, (r) => r.had_issue === "Yes", (r) => !!r.had_issue);
    return mean(rows2, c);
  };
  const colValues = cols.map(([c]) => ({ c, vals: ms.map((m) => cell(g.get(m), c)).filter((v): v is number => v != null) }));
  const colMean: Record<string, number | null> = Object.fromEntries(colValues.map(({ c, vals: vs }) => [c, vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null]));

  return (
    <div>
      <Panel
        title={`${QL[k]} over time`}
        subtitle="Average score per period, with the overall average as a dashed line. Click a point to filter to that period."
        right={<div className="flex gap-1">{(["week", "month"] as const).map((gv) => (
          <button key={gv} type="button" onClick={() => setGran(gv)} className="text-[11px] px-2 py-1 rounded-2xl capitalize" style={gran === gv ? { background: ink, color: bg } : { border: `1px solid ${border}` }}>{gv}ly</button>
        ))}</div>}
      >
        <LineChartSvg points={series} avgAll={avgAll} onClick={(p) => setF({ ...F, from: iso(p.t), to: iso(gran === "week" ? addDays(p.t, 6) : new Date(Date.UTC(p.t.getUTCFullYear(), p.t.getUTCMonth() + 1, 0))), months: new Set(), preset: "" })} />
        <h3 className="text-xs mt-2 mb-1" style={{ color: inkSoft }}>Responses per period</h3>
        <CountBarsSvg per={series.map((s) => ({ t: s.t, n: s.n }))} />
      </Panel>

      <Panel title={`Day by day: ${QL[k].toLowerCase()}`} subtitle="Each square is a day, coloured by that day's average against the overall average. Click a day to see only that day.">
        <Calendar rows={rows} k={k} basis={F.basis} F={F} setF={setF} />
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title="By day of the week" subtitle={`${QL[k]} by ${F.basis === "date" ? "day the survey was answered" : F.basis === "checkin" ? "arrival day" : "departure day"}. Click a day to filter.`}>
          <HBars max={10} items={dowAgg.filter((x) => x.s.n).map((x) => ({
            label: x.n, value: fmt2(x.s.avg), v: x.s.avg ?? 0, active: F.dows.has(x.i), color: x.s.avg != null && avgAll != null && x.s.avg < avgAll ? CHART.bad : CHART.good,
            title: `Average ${fmt2(x.s.avg)} from ${x.s.n} answers`,
            onClick: () => { const s = new Set(F.dows); if (s.has(x.i)) s.delete(x.i); else s.add(x.i); setF({ ...F, dows: s }); },
          }))} />
        </Panel>
        <Panel title="By length of stay" subtitle="Average for the question in focus">
          <HBars max={10} items={ng.map((lab) => { const rs = rows.filter((r) => r.nightsLabel === lab); const s = stats(rs, k); return { label: lab, value: fmt2(s.avg), v: s.avg ?? 0, color: s.avg != null && avgAll != null && s.avg < avgAll ? CHART.bad : CHART.good }; }).filter((x) => x.value !== "—")} />
        </Panel>
      </div>

      <Panel title="Month by month" subtitle="A filled cell is notably below that column's average for the year. Click a month to filter to it.">
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead><tr style={{ borderBottom: `1px solid ${border}` }}>
              <th className="text-left py-1.5" style={{ color: inkSoft }}>Month</th>
              {cols.map(([, l]) => <th key={l} className="text-right py-1.5 px-1.5" style={{ color: inkSoft }}>{l}</th>)}
            </tr></thead>
            <tbody>
              {ms.map((m) => {
                const rs = g.get(m);
                return (
                  <tr key={m} className="cursor-pointer" style={{ borderBottom: "1px solid #EEE" }}
                    onClick={() => { const s = new Set(F.months); if (s.has(m)) s.delete(m); else s.add(m); setF({ ...F, months: s, from: "", to: "", preset: "" }); }}>
                    <td className="py-1.5" style={{ color: ink }}>{MONTHS[m % 100]} {Math.floor(m / 100)}{F.months.has(m) ? " ✓" : ""}</td>
                    {cols.map(([c]) => {
                      const v = cell(rs, c);
                      const txt = v == null ? "—" : c === "vfm" || c === "iss" ? pct(v) : c === "npsv" ? String(v) : fmt2(v);
                      const good = c === "iss" ? -1 : 1;
                      return <td key={c} className="text-right px-1.5" style={(rs?.length ?? 0) >= 5 ? heatStyle(v, colMean[c], good) : {}}>{txt}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ================= QUESTIONS =================
function QuestionsTab({ rows, ALL, F, qScore, setQScore, setF, onOpen }: {
  rows: Row[]; ALL: Row[]; F: Filters; qScore: number | null; setQScore: (n: number | null) => void; setF: (f: Filters) => void; onOpen: (r: Row) => void;
}) {
  const k = F.q;
  const s = stats(rows, k);
  const hasNotes = ALL.some((r) => r.notes[k]);
  let list: [Row, string][];
  if (qScore != null) list = rows.filter((r) => Math.round((r[k] as number) ?? NaN) === qScore).map((r) => [r, r.notes[k] || r.improve || r.highlight || ""]).filter((x): x is [Row, string] => !!x[1]);
  else if (hasNotes) list = rows.filter((r) => r.notes[k]).map((r) => [r, r.notes[k]]);
  else list = rows.filter((r) => typeof r[k] === "number" && (r[k] as number) <= 7 && r.improve).map((r) => [r, r.improve]);
  list.sort((a, b) => ((a[0][k] as number) ?? 11) - ((b[0][k] as number) ?? 11));

  return (
    <div>
      <Panel title="Where to focus" subtitle="Each dot is a question. Across: its average score. Up: how closely it moves with guests' likelihood to recommend. Top-left questions matter a lot and score lower.">
        <MatrixSvg rows={rows} focusKey={k} onClick={(key) => { setF({ ...F, q: key }); setQScore(null); }} />
      </Panel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title={`${QL[k]}: score spread`} subtitle={s.n ? `${int(s.n)} answers · average ${fmt2(s.avg)} · ${pct(s.top)} gave 9–10 · ${pct(s.low)} gave 6 or below. Click a bar to read those guests' comments.` : "No answers in this view."}>
          <HistogramSvg rows={rows} k={k} qScore={qScore} onClick={(n) => setQScore(qScore === n ? null : n)} />
        </Panel>
        <Panel title="What guests said to improve" subtitle={hasNotes ? undefined : "This question has no tick-box reasons; comments below are from guests who scored it 7 or less."}>
          <p className="text-xs" style={{ color: inkSoft }}>No tick-box reasons are captured for this export — see the comments panel below instead.</p>
        </Panel>
      </div>
      <Panel title={qScore != null ? `Guests who scored ${QL[k].toLowerCase()} ${qScore}` : `Comments on ${QL[k].toLowerCase()}`} subtitle={`${list.length} comment${list.length === 1 ? "" : "s"}, lowest scores first.`}>
        {qScore != null && <button type="button" onClick={() => setQScore(null)} className="text-[11px] px-2.5 py-1 rounded-2xl mb-2" style={{ border: `1px solid ${border}` }}>Show all comments</button>}
        <div>{list.length ? list.slice(0, 80).map(([r, t], i) => <QuoteCard key={i} r={r} text={t} tag={QSH[k] + " " + r[k]} onClick={() => onOpen(r)} />) : <p className="text-xs" style={{ color: inkSoft }}>No comments in this view.</p>}</div>
      </Panel>
    </div>
  );
}

// ================= TEAM =================
function TeamTab({ rows, person, setPerson, onOpen }: { rows: Row[]; person: string | null; setPerson: (p: string | null) => void; onOpen: (r: Row) => void }) {
  const ppl = staffAgg(rows);
  const answered = rows.filter((r) => r.standout.trim().length > 2);
  const named = rows.filter((r) => r.staff.some((s) => s.field === "standout"));
  const crit = ppl.reduce((a, p) => a + p.crit, 0);
  const activePerson = person && ppl.find((p) => p.name === person) ? person : ppl[0]?.name ?? null;
  const p = ppl.find((x) => x.name === activePerson);
  const maxBar = Math.max(...ppl.map((x) => x.praise + x.crit), 1);

  const cq: { r: Row; s: Row["staff"][number] }[] = [];
  for (const r of rows) for (const s of r.staff) if (s.tone === "critical") cq.push({ r, s });
  cq.sort((a, b) => (pd(b.r.date)?.getTime() ?? 0) - (pd(a.r.date)?.getTime() ?? 0));

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        <KpiTile label="Team friendliness" value={fmt2(mean(rows, "friendly"))} unit="/ 10" note={`${pct(stats(rows, "friendly").top)} scored 9–10`} />
        <KpiTile label="Named a team member" value={pct(answered.length ? named.length / answered.length : null)} note={`${named.length} of ${answered.length} stand-out answers`} />
        <KpiTile label="People named" value={String(ppl.filter((x) => x.praise).length)} note="On the rota, distinct names in praise" />
        <KpiTile label="Possible criticism" value={String(crit)} note="Mentions to read and check" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title="Most nominated" subtitle="Guests who named each person on your rota. Click a name for their quotes.">
          <HBars max={maxBar} empty="No one on your rota was named in this view." color={CHART.good} color2={CHART.bad} items={ppl.map((x) => ({
            label: x.name, value: x.praise + (x.crit ? ` · ${x.crit}!` : ""), v: x.praise, v2: x.crit, active: x.name === activePerson,
            title: `${x.praise} praised${x.crit ? `, ${x.crit} possible criticism` : ""}`, onClick: () => setPerson(x.name),
          }))} />
        </Panel>
        <Panel title={p ? p.name : "No one named"} subtitle={p ? `${p.praise} guest${p.praise === 1 ? "" : "s"} praised ${p.name}${p.crit ? `, ${p.crit} possibly critical` : ""}.` : "No one on your rota is named in the current view."}>
          <div>{p?.quotes.map((q, i) => {
            const quoteRow = rows.find((r) => r.staff.includes(q)) ?? rows[0];
            return <QuoteCard key={i} r={quoteRow} text={q.quote} tag={q.tone === "critical" ? "possible criticism" : q.dept ?? undefined} onClick={() => onOpen(quoteRow)} />;
          })}</div>
        </Panel>
      </div>

      <Panel title="Possible criticism of named staff" subtitle={'Picked out by a name re-appearing in an improvement, issue or "anything else" comment, near negative wording. Read each one before acting on it.'}>
        <div>{cq.length ? cq.map((q, i) => <QuoteCard key={i} r={q.r} text={q.s.quote} tag={q.s.name} onClick={() => onOpen(q.r)} />) : <p className="text-xs" style={{ color: inkSoft }}>No critical mentions of named staff in this view.</p>}</div>
      </Panel>
    </div>
  );
}

// ================= PROBLEMS =================
function ProblemsTab({ rows, prev, theme, setTheme, room, setRoom, onOpen }: {
  rows: Row[]; prev: { rows: Row[]; label: string } | null; theme: string | null; setTheme: (t: string | null) => void; room: string | null; setRoom: (r: string | null) => void; onOpen: (r: Row) => void;
}) {
  const th = themeAgg(rows);
  const pth = prev ? Object.fromEntries(themeAgg(prev.rows).map((t) => [t.name, t.n / prev.rows.length])) : null;
  const issR = rows.filter((r) => r.had_issue === "Yes");
  const act = vals(issR, "action_score");
  const activeTheme = theme && th.find((t) => t.name === theme) ? theme : th[0]?.name ?? null;
  const t = th.find((x) => x.name === activeTheme);
  const maxTheme = Math.max(...th.map((x) => x.n), 1);

  const am = new Map<string, Row[]>();
  for (const r of issR) for (const a of (r.issue_area || "Not given").split(",").map((x) => x.trim()).filter(Boolean)) { if (!am.has(a)) am.set(a, []); am.get(a)!.push(r); }
  const al = Array.from(am.entries()).sort((a, b) => b[1].length - a[1].length);

  const IMP = ["No impact", "Slight impact", "Moderate impact", "High impact", "Very high impact"];

  const rg = Array.from(new Set(rows.map((r) => r.room).filter((r): r is string => !!r)))
    .map((rm) => rows.filter((r) => r.room === rm))
    .filter((rs) => rs.length >= 2)
    .map((rs) => ({ room: rs[0].room!, n: rs.length, clean: mean(rs, "room_clean"), fac: mean(rs, "room_fac"), ov: mean(rs, "overall"), iss: rs.filter((r) => r.had_issue === "Yes" && /bedroom/i.test(r.issue_area)).length }))
    .sort((a, b) => ((a.clean ?? 10) + (a.fac ?? 10)) / 2 - ((b.clean ?? 10) + (b.fac ?? 10)) / 2);
  const cMean = mean(rows, "room_clean"), fMean = mean(rows, "room_fac"), ovMean = mean(rows, "overall");
  const roomRows = room ? rows.filter((r) => r.room === room) : [];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        <KpiTile label="Had an issue" value={pct(share(rows, (r) => r.had_issue === "Yes", (r) => !!r.had_issue))} note={`${issR.length} guests`} />
        <KpiTile label="High / very high impact" value={String(issR.filter((r) => /high/i.test(r.issue_impact)).length)} note="Issues that badly hurt the stay" />
        <KpiTile label="Happy with how we fixed it" value={act.length ? fmt1(act.reduce((a, b) => a + b, 0) / act.length) : "—"} unit="/ 10" note={`${act.length} guests rated our response`} />
        <KpiTile label="Not good value" value={pct(share(rows, (r) => r.value === "No", (r) => !!r.value))} />
        <KpiTile label="Overall after an issue" value={fmt2(mean(issR, "overall"))} unit="/ 10" note={`vs ${fmt2(mean(rows.filter((r) => r.had_issue === "No"), "overall"))} without one`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title="Recurring complaints" subtitle="Share of responses whose improvement, issue or comment-box text mentions each theme. Click one to read them.">
          <HBars max={maxTheme} empty="No complaint themes in this view." color={CHART.bad} items={th.map((x) => {
            const sh = x.n / rows.length;
            const ch = pth ? (sh - (pth[x.name] ?? 0)) * 100 : null;
            return { label: x.name, value: `${x.n} · ${pct(sh)}`, v: x.n, active: x.name === activeTheme, title: ch != null ? `${ch >= 0 ? "+" : "−"}${Math.abs(ch).toFixed(0)} pts vs ${prev!.label}` : undefined, onClick: () => setTheme(x.name) };
          })} />
        </Panel>
        <Panel title={t ? t.name : "No themes"} subtitle={t ? `${t.n} responses mention this, average overall ${fmt2(mean(t.rows, "overall"))}.` : ""}>
          <div>{t?.rows.slice(0, 20).map((r, i) => {
            const txt = [r.improve, r.issue_text, ...Object.values(r.notes), r.value === "No" ? r.additional : ""].filter(Boolean).join(" / ");
            return <QuoteCard key={i} r={r} text={txt} onClick={() => onOpen(r)} />;
          })}</div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title="Where issues happened" subtitle="Guests who said they had an issue, by area they chose">
          <HBars color={CHART.bad} items={al.map(([a, rs]) => ({ label: a, value: int(rs.length), v: rs.length, title: `Average overall ${fmt2(mean(rs, "overall"))}` }))} />
        </Panel>
        <Panel title="How much it spoiled the stay" subtitle="Impact guests reported, and their average overall score">
          <HBars items={IMP.map((i, idx) => { const rs = issR.filter((r) => r.issue_impact === i); return { label: i, value: rs.length ? `${rs.length} · ${fmt2(mean(rs, "overall"))}` : "0", v: rs.length, color: mixHex(CHART.muted, CHART.bad, idx / (IMP.length - 1)) }; })} />
        </Panel>
      </div>

      <Panel title="Room hotspots" subtitle="Rooms with at least two responses, worst first. Click a room to see its comments.">
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead><tr style={{ borderBottom: `1px solid ${border}` }}>
              <th className="text-left py-1.5" style={{ color: inkSoft }}>Room</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Responses</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Clean</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Facilities</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Overall</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Bedroom issues</th>
            </tr></thead>
            <tbody>
              {rg.map((x) => (
                <tr key={x.room} className="cursor-pointer" style={{ borderBottom: "1px solid #EEE" }} onClick={() => setRoom(room === x.room ? null : x.room)}>
                  <td className="py-1.5" style={{ color: ink }}>{x.room}{room === x.room ? " ▾" : ""}</td>
                  <td className="text-right" style={{ color: inkSoft }}>{x.n}</td>
                  <td className="text-right" style={heatStyle(x.clean, cMean)}>{fmt1(x.clean)}</td>
                  <td className="text-right" style={heatStyle(x.fac, fMean)}>{fmt1(x.fac)}</td>
                  <td className="text-right" style={heatStyle(x.ov, ovMean)}>{fmt1(x.ov)}</td>
                  <td className="text-right" style={{ color: x.iss ? ink : inkSoft, fontWeight: x.iss ? 600 : 400 }}>{x.iss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {room && (
          <div className="mt-3">
            <h3 className="text-xs font-medium mb-2" style={{ color: ink }}>Room {room}: {roomRows.length} responses</h3>
            {roomRows.map((r, i) => <QuoteCard key={i} r={r} text={[r.notes.room_clean, r.notes.room_fac, r.issue_text, r.improve].filter(Boolean).join(" / ") || r.highlight} onClick={() => onOpen(r)} />)}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ================= GUESTS =================
function GuestsTab({ rows, dim, setDim, F, setF }: { rows: Row[]; dim: string; setDim: (d: string) => void; F: Filters; setF: (f: Filters) => void }) {
  const k = dim;
  const groups = Array.from(new Set(rows.map((r) => r[k] as string).filter(Boolean)))
    .map((v) => { const rs = rows.filter((r) => r[k] === v); return { v, n: rs.length, nps: npsOf(rs), ov: mean(rs, "overall"), vfm: share(rs, (r) => r.value === "Yes", (r) => !!r.value), iss: share(rs, (r) => r.had_issue === "Yes", (r) => !!r.had_issue) }; })
    .sort((a, b) => b.n - a.n);
  const ovAll = mean(rows, "overall");
  const npsMid = npsOf(rows);
  const DIM_FILTER: Record<string, keyof Filters> = { reason: "reason", channel: "channel", room_type: "room_type", returning: "returning" };

  const bands: [number, number, string][] = [[0, 200, "Under £200"], [200, 400, "£200–£400"], [400, 700, "£400–£700"], [700, 1e9, "£700+"]];
  const nv = rows.filter((r) => r.value === "No" && r.additional);
  const fg = Array.from(new Set(rows.map((r) => r.found_us).filter(Boolean))).map((v) => { const rs = rows.filter((r) => r.found_us === v); return { v, n: rs.length, ov: mean(rs, "overall") }; }).sort((a, b) => b.n - a.n);
  const si = vals(rows, "sustain_importance"), ss = vals(rows, "sustain_sat");
  const IMPN = ["", "Not important", "Little importance", "Somewhat important", "Important", "Extremely important"];
  const SATN = ["", "Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"];

  const ms = monthsOf(rows, F.basis);
  const g = new Map<number, Row[]>();
  for (const r of rows) { const d = dOf(r, F.basis); if (!d) continue; const mk = monthKey(d); if (!g.has(mk)) g.set(mk, []); g.get(mk)!.push(r); }

  return (
    <div>
      <Panel title="Which guests are happiest" subtitle="Click a row to filter the whole page to that group." right={
        <select value={dim} onChange={(e) => setDim(e.target.value)} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }}>
          {DIMS.map(([dk, dl]) => <option key={dk} value={dk}>{dl}</option>)}
        </select>
      }>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead><tr style={{ borderBottom: `1px solid ${border}` }}>
              <th className="text-left py-1.5" style={{ color: inkSoft }}>{DIMS.find((d) => d[0] === k)?.[1]}</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Responses</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>NPS</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Overall</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Good value</th>
              <th className="text-right py-1.5" style={{ color: inkSoft }}>Had issue</th>
            </tr></thead>
            <tbody>
              {groups.map((grp) => {
                const can = DIM_FILTER[k];
                return (
                  <tr key={grp.v} className={can ? "cursor-pointer" : ""} style={{ borderBottom: "1px solid #EEE" }} onClick={can ? () => setF({ ...F, [can]: F[can] === grp.v ? "" : grp.v }) : undefined}>
                    <td className="py-1.5" style={{ color: ink }}>{grp.v}{can && F[can] === grp.v ? " ✓" : ""}</td>
                    <td className="text-right" style={{ color: inkSoft }}>{int(grp.n)}</td>
                    <td className="text-right" style={grp.n >= 8 ? heatStyle(grp.nps, npsMid) : { color: inkSoft }}>{grp.nps ?? "—"}</td>
                    <td className="text-right" style={grp.n >= 8 ? heatStyle(grp.ov, ovAll) : { color: inkSoft }}>{fmt2(grp.ov)}</td>
                    <td className="text-right" style={{ color: ink }}>{pct(grp.vfm)}</td>
                    <td className="text-right" style={{ color: ink }}>{pct(grp.iss)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title="Spend and satisfaction" subtitle="Average overall score by total bill">
          <HBars max={10} items={bands.map(([a, b, l]) => { const rs = rows.filter((r) => r.spend != null && r.spend >= a && r.spend < b); const s = stats(rs, "overall"); return { label: l, value: s.n ? fmt2(s.avg) : "—", v: s.avg ?? 0, color: s.avg != null && ovAll != null && s.avg < ovAll ? CHART.bad : CHART.good, title: `${s.n} guests` }; })} />
        </Panel>
        <Panel title="Value for money" subtitle="Share of guests saying the stay was good value, by month">
          <div className="flex gap-2 mb-2">
            {ms.map((m) => { const rs = g.get(m) ?? []; const v = share(rs, (r) => r.value === "Yes", (r) => !!r.value); return (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div style={{ width: "100%", height: 50, background: CHART.track, borderRadius: 4, position: "relative" }}>
                  <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${(v ?? 0) * 100}%`, background: CHART.good, borderRadius: 4 }} title={v != null ? pct(v) : ""} />
                </div>
                <span className="text-[9px]" style={{ color: inkSoft }}>{MONTHS[m % 100]}</span>
              </div>
            ); })}
          </div>
          <div>{nv.slice(0, 10).map((r, i) => <QuoteCard key={i} r={r} text={r.additional} onClick={() => {}} />)}</div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-4">
        <Panel title="How they found us" subtitle="Responses and average overall score">
          <HBars color={CHART.primary} items={fg.map((f) => ({ label: f.v, value: `${f.n} · ${fmt2(f.ov)}`, v: f.n }))} />
        </Panel>
        <Panel title="Sustainability" subtitle={`Importance averages ${si.length ? fmt2(si.reduce((a, b) => a + b, 0) / si.length) : "—"} and satisfaction ${ss.length ? fmt2(ss.reduce((a, b) => a + b, 0) / ss.length) : "—"} out of 5`}>
          <HBars max={Math.max(1, ...[1, 2, 3, 4, 5].map((i) => si.filter((v) => v === i).length), ...[1, 2, 3, 4, 5].map((i) => ss.filter((v) => v === i).length))} items={[
            ...[5, 4, 3, 2, 1].map((i) => ({ label: "Importance: " + IMPN[i].toLowerCase(), value: int(si.filter((v) => v === i).length), v: si.filter((v) => v === i).length, color: CHART.amber })),
            ...[5, 4, 3, 2, 1].map((i) => ({ label: "Satisfaction: " + SATN[i].toLowerCase(), value: int(ss.filter((v) => v === i).length), v: ss.filter((v) => v === i).length, color: CHART.good })),
          ]} />
        </Panel>
      </div>
    </div>
  );
}

// ================= FOLLOW-UPS =================
function FollowupsTab({ rows, fuMode, setFuMode, onOpen }: { rows: Row[]; fuMode: "open" | "all"; setFuMode: (m: "open" | "all") => void; onOpen: (r: Row) => void }) {
  const need = rows.filter((r) => (r.nps != null && r.nps <= 6) || (r.overall != null && r.overall <= 6) || (r.had_issue === "Yes" && /high/i.test(r.issue_impact)));
  const tracked = rows.filter((r) => r.replied === "Yes" || r.replied === "No");
  const open = need.filter((r) => r.replied !== "Yes");
  const list = [...(fuMode === "open" ? open : need)].sort((a, b) => (pd(b.date)?.getTime() ?? 0) - (pd(a.date)?.getTime() ?? 0));

  return (
    <div>
      <div className="p-3 rounded-2xl mb-4 text-xs" style={{ border: `1px solid ${border}`, color: inkSoft }}>
        Reply tracking is only available for OTA reviews (Booking/Google/Expedia/TripAdvisor/etc.) — post-stay surveys don&apos;t carry it, so those always show as unreplied here.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        <KpiTile label="Need a follow-up" value={String(need.length)} note="Unhappy or high-impact issue" />
        <KpiTile label="Not replied yet" value={String(open.length)} note="Of those needing one" />
        <KpiTile label="Reply rate" value={tracked.length ? pct(share(tracked, (r) => r.replied === "Yes")) : "—"} note={tracked.length ? `${tracked.length} reviews with tracking` : "No reviews with tracking in this view"} />
      </div>
      <Panel title="Guests to follow up" subtitle="Recommend score 0–6, an overall score of 6 or less, or a high-impact issue. Newest first."
        right={<div className="flex gap-1">{(["open", "all"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setFuMode(m)} className="text-[11px] px-2.5 py-1 rounded-2xl" style={fuMode === m ? { background: ink, color: bg } : { border: `1px solid ${border}` }}>{m === "open" ? "Not replied" : "All"}</button>
        ))}</div>}
      >
        {!list.length ? <p className="text-xs" style={{ color: inkSoft }}>{fuMode === "open" ? "Every guest who needs a follow-up in this view has a reply." : "No unhappy guests in this view."}</p> : (
          <div className="flex flex-col gap-2">
            {list.map((r, i) => {
              const low = QS.filter(([key]) => typeof r[key] === "number" && (r[key] as number) <= 6 && key !== "nps");
              const txt = r.issue_text || r.improve || r.additional || "";
              return (
                <button key={i} type="button" onClick={() => onOpen(r)} className="w-full text-left p-3 rounded-2xl" style={{ border: `1px solid ${border}` }}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: ink }}>{r.guest}</div>
                      <div className="text-[10px]" style={{ color: inkSoft }}>{r.date ? dayFmt(pd(r.date)!) : ""} · Room {r.room ?? "—"} · {r.reason}</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={r.nps != null && r.nps <= 6 ? { background: CHART.bad, color: "#fff" } : { border: `1px solid ${border}` }}>Recommend {r.nps ?? "—"}/10</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ border: `1px solid ${border}` }}>Overall {r.overall ?? "—"}/10</span>
                      {r.issue_impact && <span className="text-[10px] px-2 py-0.5 rounded-full" style={/high/i.test(r.issue_impact) ? { background: CHART.amber, color: "#fff" } : { border: `1px solid ${border}` }}>{r.issue_impact}</span>}
                      {r.replied === "Yes" && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: CHART.good, color: "#fff" }}>Replied{r.reply_date ? ` ${shortFmt(pd(r.reply_date)!)}` : ""}</span>}
                      {r.replied === "No" && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: CHART.bad, color: "#fff" }}>Not replied</span>}
                    </div>
                  </div>
                  {low.length > 0 && <div className="flex gap-1.5 flex-wrap mt-1.5">{low.map(([key]) => <span key={key} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: CHART.bad, color: "#fff" }}>{QSH[key]} {r[key] as number}</span>)}</div>}
                  {txt && <p className="text-xs mt-1.5" style={{ color: ink }}>{txt.length > 300 ? txt.slice(0, 300) + "…" : txt}</p>}
                </button>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ================= COMMENTS =================
function CommentsTab({ rows, cmQ, setCmQ, cmField, setCmField, cmLimit, setCmLimit, onOpen }: {
  rows: Row[]; cmQ: string; setCmQ: (s: string) => void; cmField: string; setCmField: (s: string) => void; cmLimit: number; setCmLimit: (n: number) => void; onOpen: (r: Row) => void;
}) {
  const fieldMap: Record<string, keyof Row> = { highlight: "highlight", improve: "improve", standout: "standout", issue_text: "issue_text", additional: "additional" };
  const fields = cmField === "all" ? Object.keys(fieldMap) : [cmField];
  const lbl: Record<string, string> = { highlight: "Highlight", improve: "Improve", standout: "Team", issue_text: "Issue", additional: "Other" };
  const q = cmQ.trim().toLowerCase();
  const out: [Row, string, string][] = [];
  for (const r of [...rows].sort((a, b) => (pd(b.date)?.getTime() ?? 0) - (pd(a.date)?.getTime() ?? 0))) {
    for (const f of fields) {
      const t = (r[fieldMap[f]] as string) || "";
      if (!t || t.trim().length < 3) continue;
      if (q && !t.toLowerCase().includes(q)) continue;
      out.push([r, f, t]);
    }
  }
  return (
    <Panel title="Read what guests wrote" subtitle="Search every comment in the current view. Click a comment to open the full response.">
      <div className="flex flex-wrap gap-2 mb-3">
        <input placeholder="e.g. breakfast, dog, Richard" value={cmQ} onChange={(e) => { setCmQ(e.target.value); setCmLimit(60); }} className="text-xs px-2.5 py-1.5 rounded-2xl flex-1 min-w-[160px]" style={{ border: `1px solid ${border}`, background: bg, color: ink }} />
        <select value={cmField} onChange={(e) => { setCmField(e.target.value); setCmLimit(60); }} className="text-xs px-2 py-1.5 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }}>
          <option value="all">All comments</option>
          <option value="highlight">Highlight of the stay</option>
          <option value="improve">What could be improved</option>
          <option value="standout">Team member stand-outs</option>
          <option value="issue_text">Issues</option>
          <option value="additional">Anything else</option>
        </select>
      </div>
      <p className="text-xs mb-2" style={{ color: inkSoft }}>{int(out.length)} comment{out.length === 1 ? "" : "s"}{q ? ` mentioning "${cmQ.trim()}"` : ""}</p>
      {out.length ? out.slice(0, cmLimit).map(([r, f, t], i) => <QuoteCard key={i} r={r} text={t} tag={lbl[f]} onClick={() => onOpen(r)} />) : <p className="text-xs" style={{ color: inkSoft }}>No comments match.</p>}
      {out.length > cmLimit && <button type="button" onClick={() => setCmLimit(cmLimit + 60)} className="text-xs px-3 py-1.5 rounded-2xl mt-2" style={{ border: `1px solid ${border}` }}>Show more</button>}
    </Panel>
  );
}
