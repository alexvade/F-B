"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { Section } from "@/components/section";
import { GuestSurveyInsights } from "@/components/guest-survey-insights";
import { bg, border, ink, inkSoft } from "@/lib/design-tokens";

type Answer = { question: string; answer: string | null };
type Survey = {
  id: number;
  survey_name: string | null;
  guest_name: string;
  response_url: string | null;
  language: string | null;
  response_date: string | null;
  overall_score: number | null;
  nps_category: string | null;
  establishment: string | null;
  room: string | null;
  check_in: string | null;
  check_out: string | null;
  answers: Answer[];
};

// Black/white only, to match the app's theme — a detractor still stands
// out (inverted, like a highlighted "today" cell elsewhere in the app),
// everything else is a plain bordered badge.
function scoreColors(score: number | null, npsCategory: string | null): { bg: string; fg: string; border: string } {
  if (npsCategory === "Detractor") return { bg: ink, fg: bg, border: ink };
  return { bg, fg: ink, border };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

const pd = (s: string | null) => (s ? new Date(s + "T00:00:00Z") : null);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

type ResponseFilters = { from: string; to: string; preset: string; kw: string; npsCategory: string; surveyName: string };
const emptyResponseFilters = (): ResponseFilters => ({ from: "", to: "", preset: "all", kw: "", npsCategory: "", surveyName: "" });

export default function GuestSurveysPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const pageAccessEnabled = useFeatureFlag("page_access_guest_surveys");
  const canView = isAdmin || pageAccessEnabled;
  const supabase = createClient();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tab, setTab] = useState<"responses" | "insights">("responses");
  const [filters, setFilters] = useState<ResponseFilters>(emptyResponseFilters());

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("guest_surveys")
      .select("id, survey_name, guest_name, response_url, language, response_date, overall_score, nps_category, establishment, room, check_in, check_out, answers")
      .order("response_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false });
    setSurveys(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("guest-surveys-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_surveys" }, loadData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const deleteSurvey = async (survey: Survey) => {
    if (!confirm(`Delete ${survey.guest_name}'s survey response? This can't be undone.`)) return;
    await supabase.from("guest_surveys").delete().eq("id", survey.id);
    loadData();
  };

  if (!canView) {
    return (
      <Section title="Guest Surveys">
        <p className="text-sm" style={{ color: inkSoft }}>
          Admins only.
        </p>
      </Section>
    );
  }

  const DMAX = surveys.reduce<Date | null>((max, s) => {
    const d = pd(s.response_date);
    return d && (!max || d > max) ? d : max;
  }, null);
  const surveyNames = Array.from(new Set(surveys.map((s) => s.survey_name).filter((v): v is string => !!v))).sort();

  const kwMatch = (s: Survey, kw: string) => {
    const q = kw.toLowerCase();
    if (s.guest_name.toLowerCase().includes(q)) return true;
    return s.answers.some((a) => (a.answer ?? "").toLowerCase().includes(q));
  };
  const filteredSurveys = surveys.filter((s) => {
    if (filters.kw && !kwMatch(s, filters.kw)) return false;
    if (filters.npsCategory && s.nps_category !== filters.npsCategory) return false;
    if (filters.surveyName && s.survey_name !== filters.surveyName) return false;
    if (filters.from || filters.to) {
      const d = pd(s.response_date);
      if (!d) return false;
      const di = iso(d);
      if (filters.from && di < filters.from) return false;
      if (filters.to && di > filters.to) return false;
    }
    return true;
  });
  const applyPreset = (p: string) => {
    if (!DMAX) return;
    const nf: ResponseFilters = { ...filters, preset: p };
    if (p === "all") { nf.from = ""; nf.to = ""; }
    else if (p === "30" || p === "90") { nf.from = iso(addDays(DMAX, -(+p - 1))); nf.to = iso(DMAX); }
    else if (p === "month") { nf.from = iso(new Date(Date.UTC(DMAX.getUTCFullYear(), DMAX.getUTCMonth(), 1))); nf.to = iso(DMAX); }
    else if (p === "lastmonth") { const a = new Date(Date.UTC(DMAX.getUTCFullYear(), DMAX.getUTCMonth() - 1, 1)); nf.from = iso(a); nf.to = iso(new Date(Date.UTC(DMAX.getUTCFullYear(), DMAX.getUTCMonth(), 0))); }
    setFilters(nf);
  };

  const scored = filteredSurveys.filter((s) => s.overall_score != null);
  const avgScore = scored.length ? scored.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / scored.length : null;
  const counts = { Promoter: 0, Passive: 0, Detractor: 0 } as Record<string, number>;
  for (const s of filteredSurveys) if (s.nps_category && s.nps_category in counts) counts[s.nps_category]++;

  return (
    <Section title="Guest Surveys" subtitle="Post-stay feedback from ReviewPro">
      {!loading && surveys.length > 0 && (
        <div className="flex gap-2 mb-5">
          {(["responses", "insights"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm font-medium px-4 py-1.5 rounded-2xl capitalize"
              style={
                tab === t
                  ? { background: ink, color: bg, border: `1px solid ${border}` }
                  : { background: bg, color: ink, border: `1px solid ${border}` }
              }
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {!loading && surveys.length > 0 && tab === "responses" && (
        <div className="p-3 rounded-2xl mb-4 flex flex-col gap-2.5" style={{ background: bg, border: `1px solid ${border}` }}>
          <div className="flex flex-wrap gap-1.5">
            {[["all", "All"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["month", "This month"], ["lastmonth", "Last month"]].map(([p, l]) => (
              <button key={p} type="button" onClick={() => applyPreset(p)} className="text-[11px] px-2.5 py-1 rounded-2xl" style={filters.preset === p ? { background: ink, color: bg } : { border: `1px solid ${border}` }}>{l}</button>
            ))}
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value, preset: "" })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }} />
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value, preset: "" })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <input placeholder="Search guest name or comments…" value={filters.kw} onChange={(e) => setFilters({ ...filters, kw: e.target.value })} className="text-[11px] px-2.5 py-1 rounded-2xl flex-1 min-w-[160px]" style={{ border: `1px solid ${border}`, background: bg, color: ink }} />
            <select value={filters.npsCategory} onChange={(e) => setFilters({ ...filters, npsCategory: e.target.value })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }}>
              <option value="">All NPS groups</option>
              {["Promoter", "Passive", "Detractor"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={filters.surveyName} onChange={(e) => setFilters({ ...filters, surveyName: e.target.value })} className="text-[11px] px-2 py-1 rounded-2xl" style={{ border: `1px solid ${border}`, background: bg, color: ink }}>
              <option value="">All sources</option>
              {surveyNames.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <button type="button" onClick={() => setFilters(emptyResponseFilters())} className="text-[11px] px-2.5 py-1 rounded-2xl" style={{ border: `1px solid ${border}` }}>Reset filters</button>
            <span className="text-[11px] ml-auto" style={{ color: inkSoft }}>{filteredSurveys.length} of {surveys.length} responses</span>
          </div>
        </div>
      )}

      {!loading && surveys.length > 0 && tab === "responses" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-2xl text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-xl font-semibold" style={{ color: ink }}>
              {avgScore != null ? avgScore.toFixed(1) : "–"}
            </div>
            <div className="text-xs" style={{ color: inkSoft }}>
              Avg score
            </div>
          </div>
          <div className="p-3 rounded-2xl text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-xl font-semibold" style={{ color: ink }}>
              {counts.Promoter}
            </div>
            <div className="text-xs" style={{ color: inkSoft }}>
              Promoters
            </div>
          </div>
          <div className="p-3 rounded-2xl text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-xl font-semibold" style={{ color: ink }}>
              {counts.Passive}
            </div>
            <div className="text-xs" style={{ color: inkSoft }}>
              Passives
            </div>
          </div>
          <div className="p-3 rounded-2xl text-center" style={{ background: ink, border: `1px solid ${border}` }}>
            <div className="text-xl font-semibold" style={{ color: bg }}>
              {counts.Detractor}
            </div>
            <div className="text-xs" style={{ color: bg }}>
              Detractors
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          Loading…
        </p>
      ) : surveys.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          No survey responses yet.
        </p>
      ) : tab === "insights" ? (
        <GuestSurveyInsights surveys={surveys} />
      ) : filteredSurveys.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          No responses match these filters.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredSurveys.map((s) => {
            const expanded = expandedId === s.id;
            const colors = scoreColors(s.overall_score, s.nps_category);
            return (
              <div key={s.id} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
                <button
                  onClick={() => setExpandedId((cur) => (cur === s.id ? null : s.id))}
                  className="w-full flex items-center gap-3 p-3 text-left"
                  style={{ background: bg }}
                >
                  <div
                    className="flex items-center justify-center shrink-0 rounded-full font-semibold"
                    style={{ width: 44, height: 44, background: colors.bg, color: colors.fg, border: `1px solid ${colors.border}`, fontSize: 15 }}
                  >
                    {s.overall_score != null ? s.overall_score : "–"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: ink }}>
                        {s.guest_name}
                      </span>
                      {s.nps_category && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: colors.bg, color: colors.fg, border: `1px solid ${colors.border}` }}
                        >
                          {s.nps_category}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: inkSoft }}>
                      {s.survey_name ?? "Survey"} · {formatDate(s.response_date)}
                      {s.room ? ` · Room ${s.room}` : ""}
                    </div>
                    {(s.check_in || s.check_out) && (
                      <div className="text-xs mt-0.5" style={{ color: inkSoft }}>
                        {formatDate(s.check_in)} – {formatDate(s.check_out)}
                      </div>
                    )}
                  </div>
                  {expanded ? <ChevronUp size={16} style={{ color: inkSoft }} /> : <ChevronDown size={16} style={{ color: inkSoft }} />}
                </button>

                {expanded && (
                  <div className="p-3" style={{ background: "#FFFFFF" }}>
                    <div className="flex flex-col gap-2.5 mb-3">
                      {s.answers.map((a, i) => (
                        <div key={i}>
                          <div className="text-xs" style={{ color: inkSoft }}>
                            {a.question}
                          </div>
                          <div className="text-sm" style={{ color: ink }}>
                            {a.answer ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2" style={{ borderTop: `1px solid ${border}` }}>
                      {s.response_url && (
                        <a
                          href={s.response_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
                          style={{ background: "#FFFFFF", color: ink, border: `1px solid ${border}` }}
                        >
                          <ExternalLink size={13} /> View in ReviewPro
                        </a>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => deleteSurvey(s)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
                          style={{ background: "#FFFFFF", color: ink, border: `1px solid ${border}` }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
