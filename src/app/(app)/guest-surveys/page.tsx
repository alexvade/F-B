"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy, navyText, orangeSoft } from "@/lib/design-tokens";

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

function scoreColors(score: number | null): { bg: string; fg: string } {
  if (score == null) return { bg: fill, fg: inkSoft };
  if (score >= 9) return { bg: "#E6F4EA", fg: "#1E7A34" };
  if (score >= 7) return { bg: "#FFF4D6", fg: "#9A6B00" };
  return { bg: "#FBE7E7", fg: "#B3261E" };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function GuestSurveysPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const pageAccessEnabled = useFeatureFlag("page_access_guest_surveys");
  const canView = isAdmin || pageAccessEnabled;
  const supabase = createClient();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const scored = surveys.filter((s) => s.overall_score != null);
  const avgScore = scored.length ? scored.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / scored.length : null;
  const counts = { Promoter: 0, Passive: 0, Detractor: 0 } as Record<string, number>;
  for (const s of surveys) if (s.nps_category && s.nps_category in counts) counts[s.nps_category]++;

  return (
    <Section title="Guest Surveys" subtitle="Post-stay feedback from ReviewPro">
      {!loading && surveys.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-2xl text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-xl font-semibold" style={{ color: navyText }}>
              {avgScore != null ? avgScore.toFixed(1) : "–"}
            </div>
            <div className="text-xs" style={{ color: inkSoft }}>
              Avg score
            </div>
          </div>
          <div className="p-3 rounded-2xl text-center" style={{ background: "#E6F4EA", border: `1px solid ${border}` }}>
            <div className="text-xl font-semibold" style={{ color: "#1E7A34" }}>
              {counts.Promoter}
            </div>
            <div className="text-xs" style={{ color: "#1E7A34" }}>
              Promoters
            </div>
          </div>
          <div className="p-3 rounded-2xl text-center" style={{ background: "#FFF4D6", border: `1px solid ${border}` }}>
            <div className="text-xl font-semibold" style={{ color: "#9A6B00" }}>
              {counts.Passive}
            </div>
            <div className="text-xs" style={{ color: "#9A6B00" }}>
              Passives
            </div>
          </div>
          <div className="p-3 rounded-2xl text-center" style={{ background: "#FBE7E7", border: `1px solid ${border}` }}>
            <div className="text-xl font-semibold" style={{ color: "#B3261E" }}>
              {counts.Detractor}
            </div>
            <div className="text-xs" style={{ color: "#B3261E" }}>
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
      ) : (
        <div className="flex flex-col gap-3">
          {surveys.map((s) => {
            const expanded = expandedId === s.id;
            const colors = scoreColors(s.overall_score);
            return (
              <div key={s.id} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
                <button
                  onClick={() => setExpandedId((cur) => (cur === s.id ? null : s.id))}
                  className="w-full flex items-center gap-3 p-3 text-left"
                  style={{ background: bg }}
                >
                  <div
                    className="flex items-center justify-center shrink-0 rounded-full font-semibold"
                    style={{ width: 44, height: 44, background: colors.bg, color: colors.fg, fontSize: 15 }}
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
                          style={{ background: colors.bg, color: colors.fg }}
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
                          style={{ background: orangeSoft, color: navy }}
                        >
                          <ExternalLink size={13} /> View in ReviewPro
                        </a>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => deleteSurvey(s)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
                          style={{ background: "#FFFFFF", color: "#B3261E", border: `1px solid ${border}` }}
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
