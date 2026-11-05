"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Send as SendIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy } from "@/lib/design-tokens";

// Mirrors Fisher Services' own linen hire order form — article list,
// grouping and column layout taken straight off their blank sheet — so
// filling this in is a one-to-one swap for filling in their spreadsheet by
// hand. See src/lib/linen-order-report.ts for the attachment this builds.
const RECIPIENT = "hdnewc@fisherservices.co.uk";

type Item = {
  article: string;
  category: string;
  sort_order: number;
  total_sent: number | null;
  colour: string | null;
  increase_required: number | null;
  decrease_required: number | null;
  reject: number | null;
};
type Meta = { your_name: string | null; labels_colour: string | null; empty_bags_cages: number | null };
type Field = "total_sent" | "colour" | "increase_required" | "decrease_required" | "reject";

export default function LinenOrderPage() {
  const profile = useProfile();
  const supabase = createClient();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [metaDrafts, setMetaDrafts] = useState<{ your_name: string; labels_colour: string; empty_bags_cages: string }>({
    your_name: "",
    labels_colour: "",
    empty_bags_cages: "",
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [showSendForm, setShowSendForm] = useState(false);
  const [emailTo, setEmailTo] = useState(RECIPIENT);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const draftKey = (article: string, field: Field) => `${article}:${field}`;

  const load = useCallback(async () => {
    const [{ data: itemRows }, { data: metaRow }] = await Promise.all([
      supabase.from("linen_order_items").select("*").order("sort_order"),
      supabase.from("linen_order_meta").select("your_name, labels_colour, empty_bags_cages").eq("id", 1).single(),
    ]);
    setItems(itemRows ?? []);
    const resolvedMeta: Meta = metaRow ?? { your_name: null, labels_colour: null, empty_bags_cages: null };
    setMetaDrafts({
      your_name: resolvedMeta.your_name ?? profile.name,
      labels_colour: resolvedMeta.labels_colour ?? "",
      empty_bags_cages: resolvedMeta.empty_bags_cages != null ? String(resolvedMeta.empty_bags_cages) : "",
    });
    setLoading(false);
  }, [supabase, profile.name]);

  useEffect(() => {
    load();
  }, [load]);

  const commitField = async (article: string, field: Field) => {
    const key = draftKey(article, field);
    const raw = drafts[key];
    if (raw === undefined) return;
    const value = field === "colour" ? (raw.trim() || null) : raw.trim() === "" ? null : Number(raw);
    setSavingKey(key);
    try {
      const patch: Partial<Item> & { updated_at: string } = { updated_at: new Date().toISOString() };
      if (field === "colour") patch.colour = value as string | null;
      else patch[field] = value as number | null;
      await supabase.from("linen_order_items").update(patch).eq("article", article);
      setItems((prev) => prev.map((it) => (it.article === article ? { ...it, [field]: value } : it)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setSavingKey(null);
    }
  };

  const commitMeta = async (field: keyof typeof metaDrafts) => {
    const raw = metaDrafts[field];
    const value = field === "empty_bags_cages" ? (raw.trim() === "" ? null : Number(raw)) : raw.trim() || null;
    setSavingKey(`meta:${field}`);
    try {
      const patch: Partial<Meta> & { updated_at: string } = { updated_at: new Date().toISOString() };
      if (field === "empty_bags_cages") patch.empty_bags_cages = value as number | null;
      else patch[field] = value as string | null;
      await supabase.from("linen_order_meta").update(patch).eq("id", 1);
    } finally {
      setSavingKey(null);
    }
  };

  const sendOrder = async () => {
    const to = emailTo.trim();
    if (!to) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/linen-order/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailStatus({ ok: false, message: body.error || "Couldn't send that — try again." });
        return;
      }
      setEmailStatus({ ok: true, message: `Sent to ${to}. Today's figures have been cleared, ready for tomorrow.` });
      await load();
    } finally {
      setSendingEmail(false);
    }
  };

  if (!profile.is_super_admin) {
    return (
      <Section title="Linen Order">
        <p className="text-sm" style={{ color: inkSoft }}>
          Super admins only.
        </p>
      </Section>
    );
  }

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const inputStyle = { border: `1px solid ${border}`, color: ink, background: fill } as const;
  const numCell = (article: string, field: Field, width: number) => {
    const key = draftKey(article, field);
    const item = items.find((i) => i.article === article);
    const current = key in drafts ? drafts[key] : (item?.[field] != null ? String(item[field]) : "");
    return (
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={current}
        onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
        onBlur={() => commitField(article, field)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="text-xs text-center px-1.5 py-1 rounded-full outline-none"
        style={{ ...inputStyle, width, borderColor: savingKey === key ? navy : border }}
      />
    );
  };

  return (
    <Section title="Linen Order" subtitle={`Daily order for Fisher Services, built for Wood Hall Hotel — sent to ${RECIPIENT}`}>
      {loading ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          Loading…
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-6 max-w-2xl">
            <label className="text-xs" style={{ color: inkSoft }}>
              Hotel Name
              <input disabled value="WOOD HALL HOTEL" className="w-full text-sm px-4 py-2 rounded-full outline-none mt-1" style={{ ...inputStyle, opacity: 0.6 }} />
            </label>
            <label className="text-xs" style={{ color: inkSoft }}>
              Date
              <input disabled value={new Date().toLocaleDateString("en-GB")} className="w-full text-sm px-4 py-2 rounded-full outline-none mt-1" style={{ ...inputStyle, opacity: 0.6 }} />
            </label>
            <label className="text-xs" style={{ color: inkSoft }}>
              Your Name
              <input
                value={metaDrafts.your_name}
                onChange={(e) => setMetaDrafts((p) => ({ ...p, your_name: e.target.value }))}
                onBlur={() => commitMeta("your_name")}
                className="w-full text-sm px-4 py-2 rounded-full outline-none mt-1"
                style={{ ...inputStyle, borderColor: savingKey === "meta:your_name" ? navy : border }}
              />
            </label>
            <label className="text-xs" style={{ color: inkSoft }}>
              Labels (State Colour)
              <input
                value={metaDrafts.labels_colour}
                onChange={(e) => setMetaDrafts((p) => ({ ...p, labels_colour: e.target.value }))}
                onBlur={() => commitMeta("labels_colour")}
                placeholder="If required"
                className="w-full text-sm px-4 py-2 rounded-full outline-none mt-1"
                style={{ ...inputStyle, borderColor: savingKey === "meta:labels_colour" ? navy : border }}
              />
            </label>
            <label className="text-xs" style={{ color: inkSoft }}>
              Empty Bags/Cages collected
              <input
                type="number"
                min={0}
                value={metaDrafts.empty_bags_cages}
                onChange={(e) => setMetaDrafts((p) => ({ ...p, empty_bags_cages: e.target.value }))}
                onBlur={() => commitMeta("empty_bags_cages")}
                className="w-full text-sm px-4 py-2 rounded-full outline-none mt-1"
                style={{ ...inputStyle, borderColor: savingKey === "meta:empty_bags_cages" ? navy : border }}
              />
            </label>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="text-xs" style={{ borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${border}` }}>
                  <th className="text-left py-2 pr-3" style={{ color: ink }}>Article</th>
                  <th className="text-center py-2 px-2" style={{ color: ink }}>Total Sent</th>
                  <th className="text-center py-2 px-2" style={{ color: ink }}>Colour</th>
                  <th className="text-center py-2 px-2" style={{ color: ink }}>Increase Req.</th>
                  <th className="text-center py-2 px-2" style={{ color: ink }}>Decrease Req.</th>
                  <th className="text-center py-2 px-2" style={{ color: ink }}>Reject</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <Fragment key={cat}>
                    <tr>
                      <td colSpan={6} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: inkSoft }}>
                        {cat}
                      </td>
                    </tr>
                    {items
                      .filter((i) => i.category === cat)
                      .map((item) => {
                        const colourKey = draftKey(item.article, "colour");
                        const colourVal = colourKey in drafts ? drafts[colourKey] : item.colour ?? "";
                        return (
                          <tr key={item.article} style={{ borderBottom: `1px solid ${border}22` }}>
                            <td className="py-1.5 pr-3" style={{ color: ink }}>{item.article}</td>
                            <td className="py-1.5 px-2 text-center">{numCell(item.article, "total_sent", 56)}</td>
                            <td className="py-1.5 px-2 text-center">
                              <input
                                value={colourVal}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [colourKey]: e.target.value }))}
                                onBlur={() => commitField(item.article, "colour")}
                                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                className="text-xs text-center px-1.5 py-1 rounded-full outline-none"
                                style={{ ...inputStyle, width: 72, borderColor: savingKey === colourKey ? navy : border }}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">{numCell(item.article, "increase_required", 56)}</td>
                            <td className="py-1.5 px-2 text-center">{numCell(item.article, "decrease_required", 56)}</td>
                            <td className="py-1.5 px-2 text-center">{numCell(item.article, "reject", 56)}</td>
                          </tr>
                        );
                      })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {showSendForm && (
            <div className="flex flex-col gap-3 p-3 rounded-2xl mb-6" style={{ background: bg, border: `1px solid ${border}` }}>
              <span className="text-xs" style={{ color: inkSoft }}>
                Builds today&apos;s order into a spreadsheet and emails it — figures clear automatically once it&apos;s sent.
              </span>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="Send to…"
                className="text-sm px-4 py-2 rounded-full outline-none"
                style={inputStyle}
              />
              {emailStatus && (
                <p className="text-xs" style={{ color: emailStatus.ok ? inkSoft : "#E4002B" }}>
                  {emailStatus.message}
                </p>
              )}
              <button
                onClick={sendOrder}
                disabled={sendingEmail || !emailTo.trim()}
                className="text-sm font-medium py-2.5 rounded-full disabled:opacity-60 w-fit px-6"
                style={{ background: navy, color: "#FFFFFF" }}
              >
                {sendingEmail ? "Sending…" : "Send order"}
              </button>
            </div>
          )}

          <button
            onClick={() => setShowSendForm((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{
              border: `1px solid ${showSendForm ? navy : "#000000"}`,
              background: showSendForm ? navy : "transparent",
              color: showSendForm ? "#FFFFFF" : "#000000",
            }}
          >
            <SendIcon size={13} />
            {showSendForm ? "Hide" : "Send order"}
          </button>
        </>
      )}
    </Section>
  );
}
