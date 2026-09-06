"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, ThumbsUp, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { initials } from "@/lib/shift-status";
import { relativeTime, timestamp } from "@/lib/relative-time";
import { Section } from "@/components/section";
import { bg, border, ink, inkSoft, navy, navyText, orange, orangeSoft, surface } from "@/lib/design-tokens";

type Nomination = {
  id: number;
  nominee_name: string;
  reason: string;
  nominatedById: string | null;
  nominatedByName: string;
  created_at: string;
  votes: string[];
};

export default function ColleagueOfTheMonthPage() {
  const profile = useProfile();
  const supabase = createClient();

  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [newNominee, setNewNominee] = useState("");
  const [newReason, setNewReason] = useState("");

  const loadData = useCallback(async () => {
    const [nomRes, voteRes] = await Promise.all([
      supabase.from("nominations").select("*").order("created_at"),
      supabase.from("nomination_votes").select("*"),
    ]);
    const ids = Array.from(new Set((nomRes.data ?? []).map((n) => n.nominated_by).filter(Boolean))) as string[];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, name").in("id", ids)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    setNominations(
      (nomRes.data ?? []).map((n) => ({
        id: n.id,
        nominee_name: n.nominee_name,
        reason: n.reason,
        nominatedById: n.nominated_by,
        nominatedByName: nameById.get(n.nominated_by ?? "") ?? "Someone",
        created_at: n.created_at,
        votes: (voteRes.data ?? []).filter((v) => v.nomination_id === n.id).map((v) => v.user_id),
      }))
    );
  }, [supabase]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("colleague-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "nominations" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "nomination_votes" }, loadData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const addNomination = async () => {
    if (!newNominee.trim() || !newReason.trim()) return;
    const { data } = await supabase
      .from("nominations")
      .insert({ nominee_name: newNominee.trim(), reason: newReason.trim(), nominated_by: profile.id })
      .select()
      .single();
    if (data) {
      await supabase.from("nomination_votes").insert({ nomination_id: data.id, user_id: profile.id });
    }
    setNewNominee("");
    setNewReason("");
    loadData();
  };

  const toggleVote = async (nom: Nomination) => {
    const hasVoted = nom.votes.includes(profile.id);
    if (hasVoted) {
      await supabase
        .from("nomination_votes")
        .delete()
        .eq("nomination_id", nom.id)
        .eq("user_id", profile.id);
    } else {
      await supabase.from("nomination_votes").insert({ nomination_id: nom.id, user_id: profile.id });
    }
    loadData();
  };

  const deleteNomination = async (nom: Nomination) => {
    if (!confirm("Delete this nomination?")) return;
    await supabase.from("nominations").delete().eq("id", nom.id);
    loadData();
  };

  const sorted = [...nominations].sort((a, b) => b.votes.length - a.votes.length);

  return (
    <Section title="Colleague of the month" subtitle="Nominate a teammate, or vote for someone already nominated">
      <div className="p-3 rounded-2xl mb-6" style={{ background: surface, border: `1px solid ${border}` }}>
        <input
          value={newNominee}
          onChange={(e) => setNewNominee(e.target.value)}
          placeholder="Who are you nominating?"
          className="w-full text-sm px-4 py-2.5 rounded-full mb-2 outline-none"
          style={{ border: `1px solid ${border}`, color: ink, background: bg }}
        />
        <textarea
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          placeholder="Why do they deserve it?"
          className="w-full text-sm resize-none outline-none px-4 py-2.5 rounded-full"
          rows={2}
          style={{ color: ink, background: bg, border: `1px solid ${border}` }}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={addNomination}
            className="text-xs font-medium px-4 py-2 rounded-full"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            Submit nomination
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map((nom, i) => {
          const hasVoted = nom.votes.includes(profile.id);
          return (
            <div key={nom.id} className="p-4 rounded-2xl" style={{ background: surface, border: `1px solid ${border}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {i === 0 && nom.votes.length > 0 && <Award size={16} style={{ color: orange }} />}
                  <span className="text-sm font-semibold" style={{ color: navyText }}>
                    {nom.nominee_name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="flex items-center justify-center rounded-full text-xs font-medium"
                    style={{ width: 22, height: 22, background: orangeSoft, color: navyText }}
                  >
                    {initials(nom.nominatedByName)}
                  </span>
                  <span className="text-xs" style={{ color: inkSoft }}>
                    {nom.nominatedByName}
                  </span>
                </div>
              </div>
              <p className="text-sm mt-2" style={{ color: ink }}>
                {nom.reason}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs whitespace-nowrap" style={{ color: inkSoft }}>
                  {relativeTime(nom.created_at)} · {timestamp(nom.created_at)}
                </span>
                {(nom.nominatedById === profile.id || profile.role === "admin") && (
                  <button onClick={() => deleteNomination(nom)} style={{ color: inkSoft }} title="Delete nomination">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={() => toggleVote(nom)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-full"
                  style={{ background: hasVoted ? navy : orangeSoft, color: hasVoted ? "#FFFFFF" : orange }}
                >
                  <ThumbsUp size={13} />
                  {hasVoted ? "Voted" : "Vote"}
                </button>
                <span className="text-xs" style={{ color: inkSoft }}>
                  {nom.votes.length} {nom.votes.length === 1 ? "vote" : "votes"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
