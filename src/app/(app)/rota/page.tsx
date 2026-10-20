"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { todayISO, weekStartOf, addDaysISO, weekDates, formatTimeHHMM } from "@/lib/dates";
import type { ShiftStatus } from "@/lib/supabase/types";
import {
  border,
  fill,
  ink,
  inkSoft,
  navy,
  navyText,
  orange,
  orangeSoft,
  warn,
} from "@/lib/design-tokens";

// These never belong on the rota — a stray name imported from an old sheet,
// and the app owner's own personal account (he's not rota-able staff).
const EXCLUDED_STAFF_NAMES = new Set(["Nicola Smith", "alexandru.vadeanu@gmail.com"]);

// The grid itself reads as an actual spreadsheet — thin grey gridlines and
// a blue selection outline, like Sheets' own default look — rather than
// the app's usual bold black/white chrome. Scoped to the grid only; the
// surrounding buttons/toolbar stay in the normal design-token style.
const GRID = "#D9D9D9";
const SELECTION_COLOR = "#1A73E8";

type Staff = { name: string; id: string | null };
type Shift = {
  status: ShiftStatus;
  start_time: string | null;
  end_time: string | null;
  color: string | null;
  text_color: string | null;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  font_size: number | null;
  note: string | null;
};

const defaultShift: Shift = {
  status: "off",
  start_time: null,
  end_time: null,
  color: null,
  text_color: null,
  bold: false,
  italic: false,
  strikethrough: false,
  font_size: null,
  note: null,
};

const FONT_SIZES = [10, 11, 12, 14, 16, 18];

// Accepts loose spreadsheet-style typing — "9", "17", "9:30", "0900",
// "5pm" — rather than requiring the browser's native HH:MM time picker.
function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^\d{4}$/.test(s)) {
    const h = parseInt(s.slice(0, 2), 10);
    const min = parseInt(s.slice(2), 10);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (min > 59) return null;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Picks black or white text so it stays readable over whatever pastel the
// sheet's cell was painted — same idea as the sheet itself, where the fill
// is usually pale enough that black text just always works, but better to
// check than assume.
function readableTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}

// The same grid Google Sheets' own colour picker uses — a greyscale row
// plus seven shade-rows per hue — so Bg/Text pickers read as genuinely
// spreadsheet-native rather than an app-specific swatch set.
const GOOGLE_GREYS = ["#000000", "#434343", "#666666", "#999999", "#B7B7B7", "#CCCCCC", "#D9D9D9", "#EFEFEF", "#F3F3F3", "#FFFFFF"];
const GOOGLE_COLOR_ROWS = [
  ["#980000", "#FF0000", "#FF9900", "#FFFF00", "#00FF00", "#00FFFF", "#4A86E8", "#0000FF", "#9900FF", "#FF00FF"],
  ["#E6B8AF", "#F4CCCC", "#FCE5CD", "#FFF2CC", "#D9EAD3", "#D0E0E3", "#C9DAF8", "#CFE2F3", "#D9D2E9", "#EAD1DC"],
  ["#DD7E6B", "#EA9999", "#F9CB9C", "#FFE599", "#B6D7A8", "#A2C4C9", "#A4C2F4", "#9FC5E8", "#B4A7D6", "#D5A6BD"],
  ["#CC4125", "#E06666", "#F6B26B", "#FFD966", "#93C47D", "#76A5AF", "#6D9EEB", "#6FA8DC", "#8E7CC3", "#C27BA0"],
  ["#A61C00", "#CC0000", "#E69138", "#F1C232", "#6AA84F", "#45818E", "#3C78D8", "#3D85C6", "#674EA7", "#A64D79"],
  ["#85200C", "#990000", "#B45F06", "#BF9000", "#38761D", "#134F5C", "#1155CC", "#0B5394", "#351C75", "#741B47"],
  ["#5B0F00", "#660000", "#783F04", "#7F6000", "#274E13", "#0C343D", "#1C4587", "#073763", "#20124D", "#4C1130"],
];
const STANDARD_SWATCHES = ["#000000", "#FFFFFF", "#4A86E8", "#FF0000", "#FF9900", "#00FFFF"];
const KNOWN_SWATCHES = new Set([...GOOGLE_GREYS, ...GOOGLE_COLOR_ROWS.flat(), ...STANDARD_SWATCHES]);

function ColorPopover({ value, onPick, onClear, onClose }: { value: string | null; onPick: (c: string) => void; onClear: () => void; onClose: () => void }) {
  const swatch = (c: string, key: string) => (
    <button
      key={key}
      type="button"
      title={c}
      onClick={() => { onPick(c); onClose(); }}
      className="w-4 h-4 rounded-full shrink-0"
      style={{
        background: c,
        border: c.toUpperCase() === "#FFFFFF" ? `1px solid ${border}` : "none",
        boxShadow: value?.toUpperCase() === c.toUpperCase() ? `0 0 0 2px #FFFFFF, 0 0 0 3px ${SELECTION_COLOR}` : undefined,
      }}
    />
  );

  const customValue = value && !KNOWN_SWATCHES.has(value.toUpperCase()) ? value : null;

  return (
    <div
      className="absolute z-20 p-2.5 rounded-xl"
      style={{ background: "#FFFFFF", border: `1px solid ${border}`, top: "100%", left: 0, width: 212, boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
    >
      <button
        type="button"
        onClick={() => { onClear(); onClose(); }}
        className="flex items-center gap-2 w-full text-xs rounded px-1 py-1 mb-2 hover:bg-[#F1F3F4]"
        style={{ color: ink }}
      >
        <span className="w-4 h-4 rounded-full relative inline-block shrink-0" style={{ border: `1px solid ${border}` }}>
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(to top right, transparent calc(50% - 1px), ${orange} calc(50% - 1px), ${orange} calc(50% + 1px), transparent calc(50% + 1px))`,
            }}
          />
        </span>
        Reset
      </button>
      <div className="flex flex-col gap-[3px] mb-2">
        <div className="flex gap-[3px]">{GOOGLE_GREYS.map((c) => swatch(c, c))}</div>
        {GOOGLE_COLOR_ROWS.map((row, i) => (
          <div key={i} className="flex gap-[3px]">{row.map((c) => swatch(c, `${i}-${c}`))}</div>
        ))}
      </div>
      <div className="h-px mb-2" style={{ background: border }} />
      <div className="text-[9px] font-semibold tracking-wide mb-1" style={{ color: inkSoft }}>STANDARD</div>
      <div className="flex gap-[3px] mb-2">{STANDARD_SWATCHES.map((c) => swatch(c, `std-${c}`))}</div>
      <div className="h-px mb-2" style={{ background: border }} />
      <div className="text-[9px] font-semibold tracking-wide mb-1" style={{ color: inkSoft }}>CUSTOM</div>
      <div className="flex items-center gap-[6px]">
        {customValue && swatch(customValue, "custom-current")}
        <label
          className="w-4 h-4 rounded-full relative cursor-pointer overflow-hidden flex items-center justify-center shrink-0"
          style={{ border: `1px dashed ${inkSoft}` }}
          title="Custom colour"
        >
          <span className="text-[10px] leading-none" style={{ color: inkSoft }}>+</span>
          <input
            type="color"
            className="absolute opacity-0 cursor-pointer"
            style={{ width: 30, height: 30, left: -7, top: -7 }}
            onChange={(e) => { onPick(e.target.value); onClose(); }}
          />
        </label>
      </div>
    </div>
  );
}

function NotePopover({ value, onCommit, onClear, onClose }: { value: string; onCommit: (v: string) => void; onClear: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div
      className="absolute z-20 p-2 rounded-xl"
      style={{ background: "#FFFFFF", border: `1px solid ${border}`, top: "100%", left: 0, width: 180, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
    >
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Note…"
        className="w-full text-xs rounded px-1 py-1 mb-1"
        style={{ border: `1px solid ${border}`, color: ink, background: fill }}
      />
      <div className="flex gap-1 justify-end">
        <button type="button" onClick={() => { onClear(); onClose(); }} className="text-[10px] px-2 py-0.5 rounded" style={{ border: `1px solid ${border}`, color: ink }}>
          Clear
        </button>
        <button type="button" onClick={() => { onCommit(draft); onClose(); }} className="text-[10px] px-2 py-0.5 rounded" style={{ background: ink, color: fill }}>
          Save
        </button>
      </div>
    </div>
  );
}

function TimeField({ value, onCommit }: { value: string | null; onCommit: (hhmm: string) => void }) {
  const [draft, setDraft] = useState(value ? value.slice(0, 5) : "");
  useEffect(() => setDraft(value ? value.slice(0, 5) : ""), [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="09:00"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = parseTimeInput(draft);
        if (parsed) onCommit(parsed);
        else setDraft(value ? value.slice(0, 5) : "");
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="text-xs rounded px-1.5 py-1 w-[64px] text-center"
      style={{ border: `1px solid ${border}`, color: ink, background: fill }}
    />
  );
}

// The single formatting toolbar, above the grid — acts on whichever cell
// is currently selected (clicked) rather than embedding controls in every
// cell, which read as cluttered and nothing like an actual spreadsheet.
function FormatToolbar({
  label,
  shift,
  onChange,
  openPicker,
  setOpenPicker,
}: {
  label: string | null;
  shift: Shift | null;
  onChange: (next: Shift) => void;
  openPicker: string | null;
  setOpenPicker: (k: string | null) => void;
}) {
  const inputStyle = { border: `1px solid ${border}`, color: ink, background: fill } as const;
  if (!shift) {
    return (
      <div className="flex items-center p-2.5 mb-3 rounded-xl" style={{ border: `1px solid ${border}`, background: "#F7F7F7" }}>
        <span className="text-xs" style={{ color: inkSoft }}>Click a cell below to edit it.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 p-2 mb-3 rounded-xl" style={{ border: `1px solid ${border}`, background: fill }}>
      <span className="text-xs font-semibold shrink-0 mr-1" style={{ color: ink }}>{label}</span>
      <select
        value={shift.status}
        onChange={(e) => onChange({ ...shift, status: e.target.value as ShiftStatus, start_time: shift.start_time ?? "09:00", end_time: shift.end_time ?? "17:00" })}
        className="text-xs rounded px-1.5 py-1"
        style={inputStyle}
      >
        <option value="work">Work</option>
        <option value="off">Off</option>
        <option value="holiday">Holiday</option>
      </select>
      {shift.status === "work" && (
        <div className="flex items-center gap-1">
          <TimeField value={shift.start_time} onCommit={(v) => onChange({ ...shift, start_time: v })} />
          <span style={{ color: inkSoft }}>–</span>
          <TimeField value={shift.end_time} onCommit={(v) => onChange({ ...shift, end_time: v })} />
        </div>
      )}
      <div className="w-px h-6 shrink-0" style={{ background: border }} />
      <div className="relative">
        <button
          type="button"
          title="Background colour"
          onClick={() => setOpenPicker(openPicker === "bg" ? null : "bg")}
          className="w-7 h-7 rounded text-[10px] font-semibold"
          style={{ background: shift.color ?? fill, border: `1px solid ${border}`, color: shift.color ? readableTextColor(shift.color) : ink }}
        >
          Bg
        </button>
        {openPicker === "bg" && (
          <ColorPopover
            value={shift.color}
            onPick={(c) => onChange({ ...shift, color: c })}
            onClear={() => onChange({ ...shift, color: null })}
            onClose={() => setOpenPicker(null)}
          />
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          title="Text colour"
          onClick={() => setOpenPicker(openPicker === "text" ? null : "text")}
          className="w-7 h-7 rounded text-xs font-bold"
          style={{ background: fill, border: `1px solid ${border}`, color: shift.text_color ?? ink }}
        >
          A
        </button>
        {openPicker === "text" && (
          <ColorPopover
            value={shift.text_color}
            onPick={(c) => onChange({ ...shift, text_color: c })}
            onClear={() => onChange({ ...shift, text_color: null })}
            onClose={() => setOpenPicker(null)}
          />
        )}
      </div>
      <button type="button" title="Bold" onClick={() => onChange({ ...shift, bold: !shift.bold })} className="w-7 h-7 rounded text-xs font-bold" style={shift.bold ? { background: ink, color: fill } : { border: `1px solid ${border}`, color: ink }}>
        B
      </button>
      <button type="button" title="Italic" onClick={() => onChange({ ...shift, italic: !shift.italic })} className="w-7 h-7 rounded text-xs italic" style={shift.italic ? { background: ink, color: fill } : { border: `1px solid ${border}`, color: ink }}>
        I
      </button>
      <button
        type="button"
        title="Strikethrough"
        onClick={() => onChange({ ...shift, strikethrough: !shift.strikethrough })}
        className="w-7 h-7 rounded text-xs"
        style={{ textDecoration: "line-through", ...(shift.strikethrough ? { background: ink, color: fill } : { border: `1px solid ${border}`, color: ink }) }}
      >
        S
      </button>
      <select
        title="Font size"
        value={shift.font_size ?? ""}
        onChange={(e) => onChange({ ...shift, font_size: e.target.value ? Number(e.target.value) : null })}
        className="text-xs rounded px-1.5 py-1"
        style={inputStyle}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((sz) => (
          <option key={sz} value={sz}>{sz}</option>
        ))}
      </select>
      <div className="relative">
        <button
          type="button"
          title={shift.note ? "Edit note" : "Add note"}
          onClick={() => setOpenPicker(openPicker === "note" ? null : "note")}
          className="w-7 h-7 rounded text-xs"
          style={shift.note ? { background: ink, color: fill } : { border: `1px solid ${border}`, color: ink }}
        >
          📝
        </button>
        {openPicker === "note" && (
          <NotePopover
            value={shift.note ?? ""}
            onCommit={(v) => onChange({ ...shift, note: v || null })}
            onClear={() => onChange({ ...shift, note: null })}
            onClose={() => setOpenPicker(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function RotaPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const pageAccessEnabled = useFeatureFlag("page_access_rota");
  const canView = isAdmin || pageAccessEnabled;
  const supabase = createClient();

  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayISO()));
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Record<string, Record<string, Shift>>>({});
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ person: string; date: string } | null>(null);

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const today = todayISO();
  const weekEnd = addDaysISO(weekStart, 6);

  const loadAvailableWeeks = useCallback(async () => {
    const [coversRes, shiftsRes, eventsRes] = await Promise.all([
      supabase.from("daily_covers").select("date"),
      supabase.from("rota_shifts").select("date"),
      supabase.from("daily_events").select("date"),
    ]);
    const allDates = [
      ...(coversRes.data ?? []).map((r) => r.date),
      ...(shiftsRes.data ?? []).map((r) => r.date),
      ...(eventsRes.data ?? []).map((r) => r.date),
      todayISO(),
    ];
    const currentWeek = weekStartOf(todayISO());
    const weeks = Array.from(new Set(allDates.map((d) => weekStartOf(d))))
      .filter((w) => w >= currentWeek) // hide past weeks — Prev still reaches them if needed
      .sort();
    setAvailableWeeks(weeks);
  }, [supabase]);

  const loadData = useCallback(async () => {
    const [staffRes, shiftsRes, orderRes] = await Promise.all([
      supabase.from("profiles").select("id, name").order("name"),
      supabase
        .from("rota_shifts")
        .select("staff_id, staff_name, date, status, start_time, end_time, color, text_color, bold, italic, strikethrough, font_size, note")
        .gte("date", weekStart)
        .lte("date", weekEnd),
      supabase.from("rota_staff_order").select("staff_name, sort_order"),
    ]);

    const idByName = new Map((staffRes.data ?? []).map((p) => [p.name, p.id]));
    const names = new Set((staffRes.data ?? []).map((p) => p.name));
    for (const s of shiftsRes.data ?? []) names.add(s.staff_name);
    for (const excluded of EXCLUDED_STAFF_NAMES) names.delete(excluded);

    // Order matches the sheet's own row order; anyone the sheet's never
    // mentioned (e.g. a brand-new invite) sorts alphabetically after that.
    const orderByName = new Map((orderRes.data ?? []).map((o) => [o.staff_name, o.sort_order]));
    setStaff(
      Array.from(names)
        .sort((a, b) => {
          const oa = orderByName.get(a);
          const ob = orderByName.get(b);
          if (oa !== undefined && ob !== undefined) return oa - ob;
          if (oa !== undefined) return -1;
          if (ob !== undefined) return 1;
          return a.localeCompare(b);
        })
        .map((name) => ({ name, id: idByName.get(name) ?? null }))
    );

    const shiftMap: Record<string, Record<string, Shift>> = {};
    for (const s of shiftsRes.data ?? []) {
      shiftMap[s.staff_name] ??= {};
      shiftMap[s.staff_name][s.date] = {
        status: s.status,
        start_time: s.start_time,
        end_time: s.end_time,
        color: s.color,
        text_color: s.text_color,
        bold: s.bold,
        italic: s.italic,
        strikethrough: s.strikethrough,
        font_size: s.font_size,
        note: s.note,
      };
    }
    setShifts(shiftMap);
  }, [supabase, weekStart, weekEnd]);

  useEffect(() => {
    loadAvailableWeeks();
  }, [loadAvailableWeeks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // A selection from a previous week (or before editing was turned on)
  // shouldn't linger with no cell to point at.
  useEffect(() => {
    setSelected(null);
    setOpenPicker(null);
  }, [weekStart, editing]);

  const saveShift = async (person: Staff, date: string, shift: Shift) => {
    setShifts((prev) => ({ ...prev, [person.name]: { ...prev[person.name], [date]: shift } }));
    await supabase
      .from("rota_shifts")
      .upsert(
        // manually_edited_at marks this row as hand-edited in the app, so
        // the next Google Sheet sync skips it for a while rather than
        // silently reverting the change — see ROTA_PROTECT_WINDOW_HOURS
        // in src/app/api/sync/rota-sheet/route.ts.
        { staff_id: person.id, staff_name: person.name, date, ...shift, manually_edited_at: new Date().toISOString() },
        { onConflict: "staff_name,date" }
      );
  };

  const selectedPerson = selected ? staff.find((p) => p.name === selected.person) ?? null : null;
  const selectedShift = selected ? shifts[selected.person]?.[selected.date] ?? defaultShift : null;
  const selectedDay = selected ? days.find((d) => d.date === selected.date) ?? null : null;

  if (!canView) {
    return (
      <div>
        <h1
          className="text-lg font-semibold inline-block pb-1 mb-4"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          Rota
        </h1>
        <p className="text-sm" style={{ color: inkSoft }}>
          Admins only.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1
          className="text-lg font-semibold inline-block pb-1"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          Rota
        </h1>
        {isAdmin && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{
              background: editing ? navy : orangeSoft,
              color: editing ? "#FFFFFF" : navy,
            }}
          >
            <Pencil size={13} />
            {editing ? "Done editing" : "Edit rota"}
          </button>
        )}
      </div>

      {/* Week picker — one pill per week that has any data, plus the current week */}
      <div className="flex gap-1.5 overflow-x-auto mb-3 pb-1" style={{ scrollbarWidth: "thin" }}>
        {availableWeeks.map((ws) => {
          const wd = weekDates(ws);
          const active = ws === weekStart;
          return (
            <button
              key={ws}
              onClick={() => setWeekStart(ws)}
              className="text-xs px-3 py-1.5 rounded-2xl shrink-0 whitespace-nowrap"
              style={{
                background: active ? "#000000" : "#FFFFFF",
                color: active ? "#FFFFFF" : "#000000",
                border: "1px solid #000000",
                fontWeight: active ? 600 : 400,
              }}
            >
              {wd[0].label} – {wd[6].label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: inkSoft }}>
          {days[0].label} – {days[6].label}
        </p>
        <div className="flex gap-2">
          <button
            className="text-xs px-3 py-1 rounded-2xl"
            style={{ border: `1px solid ${border}`, color: ink }}
            onClick={() => setWeekStart((w) => addDaysISO(w, -7))}
          >
            ← Prev
          </button>
          <button
            className="text-xs px-3 py-1 rounded-2xl"
            style={{ border: `1px solid ${border}`, color: ink }}
            onClick={() => setWeekStart(weekStartOf(todayISO()))}
          >
            This week
          </button>
          <button
            className="text-xs px-3 py-1 rounded-2xl"
            style={{ border: `1px solid ${border}`, color: ink }}
            onClick={() => setWeekStart((w) => addDaysISO(w, 7))}
          >
            Next →
          </button>
        </div>
      </div>

      <h2 className="text-sm font-semibold mb-3" style={{ color: navyText }}>
        Staff shifts
      </h2>

      {editing && (
        <FormatToolbar
          label={selected && selectedDay ? `${selected.person} · ${selectedDay.label}` : null}
          shift={selectedShift}
          onChange={(next) => { if (selected && selectedPerson) saveShift(selectedPerson, selected.date, next); }}
          openPicker={openPicker}
          setOpenPicker={setOpenPicker}
        />
      )}

      {/* A flatter, denser grid — sharp corners and uniform column widths,
          closer to an actual spreadsheet than the previous rounded, form-like
          layout. Formatting is applied here for display, but only ever
          changed via the toolbar above (click a cell to select it). */}
      <div className="overflow-x-auto mb-6" style={{ border: `1px solid ${GRID}` }}>
        <table className="text-xs" style={{ borderCollapse: "collapse", minWidth: 720, width: "100%" }}>
          <thead>
            <tr>
              <th
                className="text-left p-1.5 sticky left-0"
                style={{ background: "#FFFFFF", color: ink, minWidth: 150, borderBottom: `1px solid ${GRID}`, borderRight: `1px solid ${GRID}` }}
              >
                Name
              </th>
              {days.map((d) => (
                <th
                  key={d.date}
                  className="text-center p-1.5"
                  style={{
                    background: d.date === today ? "#E8EAED" : "#FFFFFF",
                    color: ink,
                    fontWeight: d.date === today ? 700 : 400,
                    minWidth: 92,
                    borderLeft: `1px solid ${GRID}`,
                    borderBottom: `1px solid ${GRID}`,
                  }}
                >
                  <div>{d.day}</div>
                  <div style={{ color: inkSoft, fontWeight: 400 }}>
                    {d.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => (
              <tr key={person.name}>
                <td
                  className="p-1.5 sticky left-0"
                  style={{ background: "#FFFFFF", fontWeight: 500, color: ink, borderBottom: `1px solid ${GRID}`, borderRight: `1px solid ${GRID}` }}
                >
                  {person.name}
                  {!person.id && (
                    <span className="ml-1.5 text-[10px]" style={{ color: inkSoft }}>
                      (not invited)
                    </span>
                  )}
                </td>
                {days.map((d) => {
                  const shift = shifts[person.name]?.[d.date];
                  const isSelected = editing && selected?.person === person.name && selected?.date === d.date;
                  // The shift's own colour-coding (from the sheet, or now
                  // set in-app) always shows.
                  const cellColor = shift?.color ?? null;
                  const textColor = shift?.text_color ?? (cellColor ? readableTextColor(cellColor) : undefined);
                  return (
                    <td
                      key={d.date}
                      onClick={() => editing && setSelected({ person: person.name, date: d.date })}
                      className="text-center p-1.5 relative"
                      style={{
                        background: cellColor ?? "#FFFFFF",
                        color: textColor,
                        fontWeight: shift?.bold ? 700 : undefined,
                        fontStyle: shift?.italic ? "italic" : undefined,
                        textDecoration: shift?.strikethrough ? "line-through" : undefined,
                        fontSize: shift?.font_size ? `${shift.font_size}px` : undefined,
                        cursor: editing ? "pointer" : undefined,
                        boxShadow: isSelected ? `inset 0 0 0 2px ${SELECTION_COLOR}` : undefined,
                        border: `1px solid ${GRID}`,
                      }}
                    >
                      {shift?.note && (
                        <div
                          title={shift.note}
                          className="absolute top-0 right-0"
                          style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "0 7px 7px 0", borderColor: `transparent ${ink} transparent transparent` }}
                        />
                      )}
                      {shift?.status === "work" ? (
                        <span>
                          {formatTimeHHMM(shift.start_time)}–{formatTimeHHMM(shift.end_time)}
                        </span>
                      ) : shift?.status === "holiday" ? (
                        <span style={{ color: textColor ?? warn }}>HOL</span>
                      ) : shift?.status === "off" ? (
                        <span style={{ color: textColor ?? inkSoft }}>OFF</span>
                      ) : (
                        <span style={{ color: textColor ?? inkSoft }}>–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
