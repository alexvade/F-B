"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  RotateCcw,
  Plus,
  Send as SendIcon,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useFeatureFlag } from "@/lib/feature-flags-context";
import { Section } from "@/components/section";
import type { EventContent } from "@/lib/event-content";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange } from "@/lib/design-tokens";

// Synthetic tab id for the collated drink-pre-orders view — not a real
// stock_products.tab_label, so it can't collide with a synced sheet tab.
const EVENTS_TAB = "__events__";

type EventDrinkOrder = {
  eventId: number;
  eventTitle: string;
  eventDate: string | null;
  product: string;
  qty: number;
  unit?: string;
  note?: string;
};

// Manually-added items (quick add or a brand new tab's first item) all fall
// under one shared category, rather than asking for one — keeps adding an
// item as low-friction as adding a to do.
const QUICK_ADD_CATEGORY = "General";

// One-tap "send to" shortcuts for whoever the stock report usually goes to —
// the free-text field right below still takes any other address.
const QUICK_EMAIL_CONTACTS = [
  { label: "Alex", email: "avadeanu@handpicked.co.uk" },
  { label: "Shane", email: "wzhao@handpicked.co.uk" },
];

// Fallback display order for a tab with no row in stock_tab_order (i.e.
// nobody's ever moved it) — anything not listed here falls after these,
// alphabetically.
const TAB_ORDER = ["Breakfast", "Beer Cellar", "Wine Cellar", "Bin End", "Miscellaneous"];
function fallbackTabRank(a: string, b: string): number {
  const ai = TAB_ORDER.indexOf(a);
  const bi = TAB_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

// Tabs with an explicit sort_order (someone has moved at least one tab)
// always sort before ones without — those still fall back to TAB_ORDER,
// keeping their relative order until they're moved too.
function sortTabs(labels: string[], order: Map<string, number>): string[] {
  return [...labels].sort((a, b) => {
    const oa = order.get(a);
    const ob = order.get(b);
    if (oa !== undefined && ob !== undefined) return oa - ob;
    if (oa !== undefined) return -1;
    if (ob !== undefined) return 1;
    return fallbackTabRank(a, b);
  });
}

type Product = {
  id: number;
  tab_label: string;
  category: string;
  code: string | null;
  product: string;
  cellar_code: string | null;
  supplier: string | null;
  sort_order: number;
  quantity: number | null;
  delisted: boolean;
};

type EditDraft = {
  product: string;
  code: string;
  cellarCode: string;
  supplier: string;
  category: string;
  delisted: boolean;
};

export default function StockOrdersPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const editEnabled = useFeatureFlag("stock_orders_edit");
  const canAccess = isAdmin || editEnabled;
  const supabase = createClient();
  const [tabs, setTabs] = useState<string[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [resetting, setResetting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [creatingTab, setCreatingTab] = useState(false);
  const [eventOrders, setEventOrders] = useState<EventDrinkOrder[] | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportTabs, setExportTabs] = useState<string[]>([]);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailFormat, setEmailFormat] = useState<"xlsx" | "pdf">("pdf");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionItems, setSectionItems] = useState("");
  const [savingSection, setSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [addToCategory, setAddToCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [addingCategoryItem, setAddingCategoryItem] = useState(false);
  const [reorderingTabs, setReorderingTabs] = useState(false);

  const loadData = useCallback(async () => {
    const [{ data }, { data: orderData }] = await Promise.all([
      supabase.from("stock_products").select("*").order("tab_label").order("sort_order"),
      supabase.from("stock_tab_order").select("tab_label, sort_order"),
    ]);
    const all = data ?? [];
    const order = new Map((orderData ?? []).map((o) => [o.tab_label, o.sort_order]));
    const tabLabels = sortTabs(Array.from(new Set(all.map((p) => p.tab_label))), order);
    setTabs(tabLabels);
    setTab((current) => current ?? tabLabels[0] ?? null);
    setProducts(all);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of all) {
        if (!(p.id in next)) next[p.id] = p.quantity?.toString() ?? "";
      }
      return next;
    });
  }, [supabase]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("stock-products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_products" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_tab_order" }, loadData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const loadEventOrders = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, title, event_date, content")
      .order("event_date", { ascending: true, nullsFirst: false });
    const rows: EventDrinkOrder[] = [];
    for (const e of data ?? []) {
      const content = e.content as EventContent | null;
      for (const line of content?.drinkOrders ?? []) {
        rows.push({
          eventId: e.id,
          eventTitle: e.title,
          eventDate: e.event_date,
          product: line.product,
          qty: line.qty,
          unit: line.unit,
          note: line.note,
        });
      }
    }
    setEventOrders(rows);
  }, [supabase]);

  useEffect(() => {
    if (tab === EVENTS_TAB && eventOrders === null) loadEventOrders();
  }, [tab, eventOrders, loadEventOrders]);

  const groupedEventOrders = useMemo(() => {
    const map = new Map<string, { product: string; unit?: string; qty: number; lines: EventDrinkOrder[] }>();
    for (const line of eventOrders ?? []) {
      const key = `${line.product}__${line.unit ?? ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.qty += line.qty;
        existing.lines.push(line);
      } else {
        map.set(key, { product: line.product, unit: line.unit, qty: line.qty, lines: [line] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [eventOrders]);

  const commitQuantity = async (product: Product) => {
    const draft = drafts[product.id] ?? "";
    const quantity = draft.trim() === "" ? null : Number(draft);
    if (quantity === product.quantity) return;
    setSavingIds((prev) => new Set(prev).add(product.id));
    try {
      await fetch("/api/stock/update-quantity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, quantity }),
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const resetAllQuantities = async () => {
    if (!confirm("Reset every quantity across all tabs back to 0? This can't be undone.")) return;
    setResetting(true);
    try {
      setDrafts(Object.fromEntries(products.map((p) => [p.id, "0"])));
      await Promise.all(
        products.map((p) =>
          fetch("/api/stock/update-quantity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: p.id, quantity: 0 }),
          })
        )
      );
    } finally {
      setResetting(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!confirm(`Remove "${product.product}" from stock orders?`)) return;
    setDeletingIds((prev) => new Set(prev).add(product.id));
    try {
      await supabase.from("stock_products").delete().eq("id", product.id);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const toggleEdit = (product: Product) => {
    if (editingId === product.id) {
      setEditingId(null);
      setEditDraft(null);
      setEditError(null);
      return;
    }
    setEditingId(product.id);
    setEditError(null);
    setEditDraft({
      product: product.product,
      code: product.code ?? "",
      cellarCode: product.cellar_code ?? "",
      supplier: product.supplier ?? "",
      category: product.category,
      delisted: product.delisted,
    });
  };

  const saveEdit = async () => {
    if (editingId == null || !editDraft) return;
    if (!editDraft.product.trim() || !editDraft.category.trim()) {
      setEditError("Product and category can't be empty.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch("/api/stock/update-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editDraft }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(body.error || "Couldn't save that — try again.");
        return;
      }
      setEditingId(null);
      setEditDraft(null);
      loadData();
    } finally {
      setSavingEdit(false);
    }
  };

  const addItemToCategory = async (category: string) => {
    const product = categoryDraft.trim();
    if (!product || !tab) return;
    setAddingCategoryItem(true);
    try {
      await fetch("/api/stock/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabLabel: tab, category, product }),
      });
      setCategoryDraft("");
      setAddToCategory(null);
      loadData();
    } finally {
      setAddingCategoryItem(false);
    }
  };

  const addSection = async () => {
    const category = sectionName.trim();
    const items = sectionItems
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!category || items.length === 0 || !tab) {
      setSectionError("A section name and at least one item are required.");
      return;
    }
    setSavingSection(true);
    setSectionError(null);
    try {
      const res = await fetch("/api/stock/add-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabLabel: tab, category, items }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSectionError(body.error || "Couldn't add that section — try again.");
        return;
      }
      setSectionName("");
      setSectionItems("");
      setAddingSection(false);
      loadData();
    } finally {
      setSavingSection(false);
    }
  };

  const renameSection = async (tabLabel: string, category: string) => {
    const newName = prompt("Rename section", category)?.trim();
    if (!newName || newName === category) return;
    await fetch("/api/stock/rename-category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabLabel, category, newCategory: newName }),
    });
    loadData();
  };

  const sendReportEmail = async () => {
    const to = emailTo.trim();
    if (!to || exportTabs.length === 0) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/stock/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, tabs: exportTabs, format: emailFormat }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailStatus({ ok: false, message: body.error || "Couldn't send that — try again." });
        return;
      }
      setEmailStatus({ ok: true, message: `Sent to ${to}.` });
      setEmailTo("");
    } finally {
      setSendingEmail(false);
    }
  };

  const moveTab = async (label: string, direction: -1 | 1) => {
    const from = tabs.indexOf(label);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= tabs.length) return;
    const reordered = [...tabs];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    setTabs(reordered);
    const rows = reordered.map((t, i) => ({ tab_label: t, sort_order: i }));
    await supabase.from("stock_tab_order").upsert(rows);
  };

  const createTab = async () => {
    const tabLabel = prompt("New tab name, e.g. Breakfast")?.trim();
    if (!tabLabel) return;
    const product = prompt(`First item for "${tabLabel}"`)?.trim();
    if (!product) return;
    setCreatingTab(true);
    try {
      const res = await fetch("/api/stock/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabLabel, category: QUICK_ADD_CATEGORY, product }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body.error || "Couldn't create that tab.");
        return;
      }
      setTab(tabLabel);
    } finally {
      setCreatingTab(false);
    }
  };

  const tabProducts = products.filter((p) => p.tab_label === tab);
  const categories = Array.from(new Set(tabProducts.map((p) => p.category)));

  // Shared by the download and email panels — both let you pick which tabs
  // to include from the same `exportTabs` selection.
  const tabCheckboxes = (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {tabs.map((t) => (
        <label key={t} className="flex items-center gap-1.5 text-xs" style={{ color: ink }}>
          <input
            type="checkbox"
            checked={exportTabs.includes(t)}
            onChange={(e) =>
              setExportTabs((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
            }
          />
          {t}
        </label>
      ))}
      <button
        onClick={() => setExportTabs((prev) => (prev.length === tabs.length ? [] : tabs))}
        className="text-xs underline"
        style={{ color: navyText }}
      >
        {exportTabs.length === tabs.length ? "Select none" : "Select all"}
      </button>
    </div>
  );

  if (!canAccess) {
    return (
      <Section title="Stock Orders">
        <p className="text-sm" style={{ color: inkSoft }}>
          Admins only.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Stock Orders" subtitle="Add a quantity for anything that needs ordering">
      <div className="flex gap-1.5 overflow-x-auto pb-1 items-center mb-3" style={{ scrollbarWidth: "thin" }}>
        {tabs.map((t, i) => {
            const active = t === tab;
            return (
              <div key={t} className="flex items-center gap-0.5 shrink-0">
                {reorderingTabs && (
                  <button
                    onClick={() => moveTab(t, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${t} earlier`}
                    className="flex items-center justify-center shrink-0 rounded-full disabled:opacity-25"
                    style={{ width: 20, height: 20, border: "1px solid #000000" }}
                  >
                    <ChevronLeft size={12} />
                  </button>
                )}
                <button
                  onClick={() => setTab(t)}
                  className="text-xs px-3.5 py-1.5 rounded-2xl shrink-0 whitespace-nowrap"
                  style={{
                    background: active ? "#000000" : "#FFFFFF",
                    color: active ? "#FFFFFF" : "#000000",
                    border: "1px solid #000000",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {t}
                </button>
                {reorderingTabs && (
                  <button
                    onClick={() => moveTab(t, 1)}
                    disabled={i === tabs.length - 1}
                    aria-label={`Move ${t} later`}
                    className="flex items-center justify-center shrink-0 rounded-full disabled:opacity-25"
                    style={{ width: 20, height: 20, border: "1px solid #000000" }}
                  >
                    <ChevronRight size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => setTab(EVENTS_TAB)}
            className="text-xs px-3.5 py-1.5 rounded-2xl shrink-0 whitespace-nowrap"
            style={{
              background: tab === EVENTS_TAB ? "#000000" : "#FFFFFF",
              color: tab === EVENTS_TAB ? "#FFFFFF" : "#000000",
              border: "1px solid #000000",
              fontWeight: tab === EVENTS_TAB ? 600 : 400,
            }}
          >
            From Events
          </button>
      </div>

      {showExport && isAdmin && (
        <div
          className="flex flex-col gap-3 p-3 rounded-2xl mb-6"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          <span className="text-xs" style={{ color: inkSoft }}>
            Everything with a quantity set right now, from these tabs:
          </span>
          {tabCheckboxes}
          <div className="flex items-center gap-2">
            {exportTabs.length === 0 ? (
              <span className="text-xs" style={{ color: inkSoft }}>
                Pick at least one tab to export.
              </span>
            ) : (
              <>
                <a
                  href={`/api/stock/report?format=xlsx&tabs=${encodeURIComponent(exportTabs.join(","))}`}
                  className="text-xs font-medium px-3 py-1.5 rounded-2xl"
                  style={{ background: navy, color: "#FFFFFF" }}
                >
                  .xlsx
                </a>
                <a
                  href={`/api/stock/report?format=pdf&tabs=${encodeURIComponent(exportTabs.join(","))}`}
                  className="text-xs font-medium px-3 py-1.5 rounded-2xl"
                  style={{ background: navy, color: "#FFFFFF" }}
                >
                  .pdf
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {showEmailForm && isAdmin && (
        <div
          className="flex flex-col gap-3 p-3 rounded-2xl mb-6"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          <span className="text-xs" style={{ color: inkSoft }}>
            Email everything with a quantity set right now, from these tabs:
          </span>
          {tabCheckboxes}
          <div className="flex items-center gap-2">
            {QUICK_EMAIL_CONTACTS.map((c) => {
              const active = emailTo.trim().toLowerCase() === c.email.toLowerCase();
              return (
                <button
                  key={c.email}
                  onClick={() => setEmailTo(c.email)}
                  className="text-xs font-medium px-3 py-1.5 rounded-2xl"
                  style={{
                    background: active ? navy : "#FFFFFF",
                    color: active ? "#FFFFFF" : navy,
                    border: `1px solid ${border}`,
                  }}
                >
                  Email {c.label}
                </button>
              );
            })}
          </div>
          <input
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="Send to…"
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, color: ink, background: fill }}
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs" style={{ color: ink }}>
              <input type="radio" checked={emailFormat === "xlsx"} onChange={() => setEmailFormat("xlsx")} />
              .xlsx
            </label>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: ink }}>
              <input type="radio" checked={emailFormat === "pdf"} onChange={() => setEmailFormat("pdf")} />
              .pdf
            </label>
          </div>
          {emailStatus && (
            <p className="text-xs" style={{ color: emailStatus.ok ? inkSoft : "#E4002B" }}>
              {emailStatus.message}
            </p>
          )}
          <button
            onClick={sendReportEmail}
            disabled={sendingEmail || !emailTo.trim() || exportTabs.length === 0}
            className="text-xs font-medium px-3 py-1.5 rounded-2xl w-fit disabled:opacity-60"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            {sendingEmail ? "Sending…" : "Send"}
          </button>
        </div>
      )}

      {tab && tab !== EVENTS_TAB && (
        <div className="mb-6">
          <button
            onClick={() => setAddingSection((v) => !v)}
            className="text-xs font-medium"
            style={{ color: navyText }}
          >
            {addingSection ? "Cancel" : `+ Add a section to ${tab}`}
          </button>
          {addingSection && (
            <div
              className="flex flex-col gap-2 mt-2 p-3 rounded-2xl"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <input
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Section name, e.g. Gin"
                className="text-sm px-4 py-2 rounded-full outline-none"
                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
              />
              <textarea
                value={sectionItems}
                onChange={(e) => setSectionItems(e.target.value)}
                placeholder={"One item per line, e.g.\nBombay Sapphire\nHendrick's\nTanqueray No. Ten"}
                rows={4}
                className="text-sm px-4 py-2 rounded-2xl outline-none resize-y"
                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
              />
              {sectionError && (
                <p className="text-xs" style={{ color: "#E4002B" }}>
                  {sectionError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={addSection}
                  disabled={savingSection}
                  className="text-xs font-medium px-3 py-1.5 rounded-2xl disabled:opacity-60"
                  style={{ background: navy, color: "#FFFFFF" }}
                >
                  {savingSection ? "Adding…" : "Add section"}
                </button>
                <button
                  onClick={() => setAddingSection(false)}
                  disabled={savingSection}
                  className="text-xs font-medium px-3 py-1.5 rounded-2xl disabled:opacity-60"
                  style={{ background: "#FFFFFF", color: "#000000", border: "1px solid #000000" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === EVENTS_TAB ? (
        eventOrders === null ? (
          <p className="text-sm" style={{ color: inkSoft }}>
            Loading…
          </p>
        ) : groupedEventOrders.length === 0 ? (
          <p className="text-sm" style={{ color: inkSoft }}>
            No drink pre-orders found on any event guide yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {groupedEventOrders.map((g) => {
              const key = `${g.product}__${g.unit ?? ""}`;
              const open = expandedProduct === key;
              return (
                <div key={key} className="rounded-2xl overflow-hidden" style={{ background: bg, border: `1px solid ${border}` }}>
                  <button
                    onClick={() => setExpandedProduct(open ? null : key)}
                    className="w-full flex items-center justify-between gap-3 p-3"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {open ? (
                        <ChevronDown size={14} style={{ color: inkSoft }} />
                      ) : (
                        <ChevronRight size={14} style={{ color: inkSoft }} />
                      )}
                      <span className="text-sm font-medium truncate" style={{ color: ink }}>
                        {g.product}
                      </span>
                    </span>
                    <span className="text-sm font-semibold shrink-0" style={{ color: navyText }}>
                      {g.qty}
                      {g.unit ? ` ${g.unit}` : ""}
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 flex flex-col gap-1.5" style={{ borderTop: `1px solid ${border}` }}>
                      {g.lines.map((l, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 pt-2 text-xs">
                          <Link href={`/events/${l.eventId}`} className="truncate" style={{ color: navyText }}>
                            {l.eventTitle}
                            {l.eventDate &&
                              ` · ${new Date(l.eventDate + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                          </Link>
                          <span className="shrink-0" style={{ color: inkSoft }}>
                            {l.qty}
                            {l.unit ? ` ${l.unit}` : ""}
                            {l.note ? ` (${l.note})` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : tabProducts.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          {tabs.length === 0 ? "No stock sheet synced yet." : "Nothing in this tab yet."}
        </p>
      ) : (
        categories.map((cat, i) => (
          <div key={cat} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="text-xs font-semibold" style={{ color: orange }}>
                  {cat.toUpperCase()}
                </div>
                <button
                  onClick={() => tab && renameSection(tab, cat)}
                  aria-label={`Rename ${cat}`}
                  title="Rename section"
                  className="flex items-center justify-center shrink-0 rounded-full"
                  style={{ width: 20, height: 20, border: "1px solid #000000" }}
                >
                  <Pencil size={10} style={{ color: "#000000" }} />
                </button>
                <button
                  onClick={() => {
                    setAddToCategory((current) => (current === cat ? null : cat));
                    setCategoryDraft("");
                  }}
                  aria-label={`Add item to ${cat}`}
                  title="Add item to this section"
                  className="flex items-center justify-center shrink-0 rounded-full"
                  style={{ width: 20, height: 20, border: "1px solid #000000" }}
                >
                  <Plus size={11} style={{ color: "#000000" }} />
                </button>
              </div>
              {i === 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetAllQuantities}
                    disabled={resetting}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl disabled:opacity-60"
                    style={{ background: "#FFFFFF", color: "#000000", border: "1px solid #000000" }}
                  >
                    <RotateCcw size={13} /> {resetting ? "Resetting…" : "Reset all to 0"}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowExport((v) => !v);
                        setExportTabs((prev) => (prev.length === 0 ? tabs : prev));
                      }}
                      aria-label="Export"
                      title="Export"
                      className="flex items-center justify-center shrink-0 rounded-2xl"
                      style={{ width: 28, height: 28, border: "1px solid #000000", color: "#000000" }}
                    >
                      <Download size={14} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        const opening = !showEmailForm;
                        setShowEmailForm(opening);
                        if (opening) setExportTabs(tab && tab !== EVENTS_TAB ? [tab] : tabs);
                        setEmailStatus(null);
                      }}
                      aria-label="Send by email"
                      title="Send by email"
                      className="flex items-center justify-center shrink-0 rounded-2xl"
                      style={{
                        width: 28,
                        height: 28,
                        border: `1px solid ${showEmailForm ? navy : "#000000"}`,
                        background: showEmailForm ? navy : "transparent",
                      }}
                    >
                      <SendIcon size={14} style={{ color: showEmailForm ? "#FFFFFF" : "#000000" }} />
                    </button>
                  )}
                  <button
                    onClick={() => setReorderingTabs((v) => !v)}
                    aria-label="Reorder tabs"
                    title="Reorder tabs"
                    className="flex items-center justify-center shrink-0 rounded-2xl"
                    style={{
                      width: 28,
                      height: 28,
                      border: `1px solid ${reorderingTabs ? navy : "#000000"}`,
                      background: reorderingTabs ? navy : "transparent",
                    }}
                  >
                    <ArrowLeftRight size={13} style={{ color: reorderingTabs ? "#FFFFFF" : "#000000" }} />
                  </button>
                  <button
                    onClick={createTab}
                    disabled={creatingTab}
                    aria-label="New tab"
                    title="New tab"
                    className="flex items-center justify-center shrink-0 rounded-2xl disabled:opacity-60"
                    style={{ width: 28, height: 28, border: "1px solid #000000", color: "#000000" }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
            {addToCategory === cat && (
              <div className="flex items-center gap-2 mb-2">
                <input
                  autoFocus
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItemToCategory(cat)}
                  placeholder={`Add to ${cat}…`}
                  className="flex-1 text-sm px-4 py-2 rounded-full outline-none"
                  style={{ border: `1px solid ${border}`, color: ink, background: fill }}
                />
                <button
                  onClick={() => addItemToCategory(cat)}
                  disabled={addingCategoryItem}
                  className="text-xs font-medium px-3 py-1.5 rounded-2xl shrink-0 disabled:opacity-60"
                  style={{ background: navy, color: "#FFFFFF" }}
                >
                  {addingCategoryItem ? "Adding…" : "Add"}
                </button>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {tabProducts
                .filter((p) => p.category === cat)
                .map((p) => {
                  const editing = editingId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl overflow-hidden"
                      style={{ background: bg, border: `1px solid ${editing ? navy : border}` }}
                    >
                      <div className="flex items-center gap-3 p-2.5">
                        <button onClick={() => toggleEdit(p)} className="flex-1 min-w-0 text-left">
                          <div className="text-sm font-medium truncate" style={{ color: ink }}>
                            {p.product}
                          </div>
                          {p.delisted && (
                            <div className="text-xs font-bold truncate dark-mode-invert" style={{ color: "#E4002B" }}>
                              DELISTED
                            </div>
                          )}
                          <div className="text-xs truncate" style={{ color: inkSoft }}>
                            {[p.code, p.supplier].filter(Boolean).join(" · ")}
                          </div>
                        </button>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={drafts[p.id] ?? ""}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          onBlur={() => commitQuantity(p)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          placeholder="0"
                          className="w-16 text-sm text-center px-2 py-1.5 rounded-full outline-none shrink-0"
                          style={{
                            border: `1px solid ${savingIds.has(p.id) ? navy : border}`,
                            color: navyText,
                            background: fill,
                          }}
                        />
                        <button
                          onClick={() => deleteProduct(p)}
                          disabled={deletingIds.has(p.id)}
                          aria-label="Remove item"
                          className="shrink-0 disabled:opacity-40"
                        >
                          <Trash2 size={14} style={{ color: inkSoft }} />
                        </button>
                      </div>

                      {editing && editDraft && (
                        <div
                          className="px-3 pb-3 flex flex-col gap-2"
                          style={{ borderTop: `1px solid ${border}` }}
                        >
                          <div className="flex flex-col sm:flex-row gap-2 pt-3">
                            <label className="flex-1 text-xs" style={{ color: inkSoft }}>
                              Product
                              <input
                                value={editDraft.product}
                                onChange={(e) => setEditDraft({ ...editDraft, product: e.target.value })}
                                className="block w-full mt-1 text-sm px-3 py-1.5 rounded-full outline-none"
                                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
                              />
                            </label>
                            <label className="flex-1 text-xs" style={{ color: inkSoft }}>
                              Category
                              <input
                                value={editDraft.category}
                                onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                                className="block w-full mt-1 text-sm px-3 py-1.5 rounded-full outline-none"
                                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
                              />
                            </label>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <label className="flex-1 text-xs" style={{ color: inkSoft }}>
                              Code
                              <input
                                value={editDraft.code}
                                onChange={(e) => setEditDraft({ ...editDraft, code: e.target.value })}
                                className="block w-full mt-1 text-sm px-3 py-1.5 rounded-full outline-none"
                                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
                              />
                            </label>
                            <label className="flex-1 text-xs" style={{ color: inkSoft }}>
                              Cellar code
                              <input
                                value={editDraft.cellarCode}
                                onChange={(e) => setEditDraft({ ...editDraft, cellarCode: e.target.value })}
                                className="block w-full mt-1 text-sm px-3 py-1.5 rounded-full outline-none"
                                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
                              />
                            </label>
                            <label className="flex-1 text-xs" style={{ color: inkSoft }}>
                              Supplier
                              <input
                                value={editDraft.supplier}
                                onChange={(e) => setEditDraft({ ...editDraft, supplier: e.target.value })}
                                className="block w-full mt-1 text-sm px-3 py-1.5 rounded-full outline-none"
                                style={{ border: `1px solid ${border}`, color: ink, background: fill }}
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-xs" style={{ color: inkSoft }}>
                            <input
                              type="checkbox"
                              checked={editDraft.delisted}
                              onChange={(e) => setEditDraft({ ...editDraft, delisted: e.target.checked })}
                            />
                            Delisted
                          </label>
                          {editError && (
                            <p className="text-xs" style={{ color: "#E4002B" }}>
                              {editError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={savingEdit}
                              className="text-xs font-medium px-3 py-1.5 rounded-2xl disabled:opacity-60"
                              style={{ background: navy, color: "#FFFFFF" }}
                            >
                              {savingEdit ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => toggleEdit(p)}
                              disabled={savingEdit}
                              className="text-xs font-medium px-3 py-1.5 rounded-2xl disabled:opacity-60"
                              style={{ background: "#FFFFFF", color: "#000000", border: "1px solid #000000" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))
      )}
    </Section>
  );
}
