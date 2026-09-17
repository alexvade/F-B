"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { Section } from "@/components/section";
import { bg, border, fill, ink, inkSoft, navy, navyText, orange, orangeSoft } from "@/lib/design-tokens";

const NEW_TAB_VALUE = "__new_tab__";

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

export default function StockOrdersPage() {
  const profile = useProfile();
  const supabase = createClient();
  const [tabs, setTabs] = useState<string[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [resetting, setResetting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    tabLabel: "",
    newTabName: "",
    category: "",
    product: "",
    code: "",
    supplier: "",
    cellarCode: "",
  });

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("stock_products")
      .select("*")
      .order("tab_label")
      .order("sort_order");
    const all = data ?? [];
    const tabLabels = Array.from(new Set(all.map((p) => p.tab_label)));
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

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

  const openAddItem = () => {
    setNewItem({ tabLabel: tab ?? "", newTabName: "", category: "", product: "", code: "", supplier: "", cellarCode: "" });
    setAddError(null);
    setAdding(true);
  };

  const addItem = async () => {
    const tabLabel = newItem.tabLabel === NEW_TAB_VALUE ? newItem.newTabName.trim() : newItem.tabLabel;
    if (!tabLabel || !newItem.category.trim() || !newItem.product.trim()) {
      setAddError("Tab, category and product are required.");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/stock/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabLabel,
          category: newItem.category,
          product: newItem.product,
          code: newItem.code,
          supplier: newItem.supplier,
          cellarCode: newItem.cellarCode,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't add that item.");
      setTab(tabLabel);
      setAdding(false);
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAddSaving(false);
    }
  };

  const tabProducts = products.filter((p) => p.tab_label === tab);
  const categories = Array.from(new Set(tabProducts.map((p) => p.category)));
  const existingCategories = Array.from(
    new Set(products.filter((p) => p.tab_label === newItem.tabLabel).map((p) => p.category))
  );

  if (profile.role !== "admin") {
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
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          {tabs.map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
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
            );
          })}
        </div>
        <button
          onClick={openAddItem}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl shrink-0"
          style={{ background: orangeSoft, color: navy }}
        >
          <Plus size={13} /> Add item
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl mb-6" style={{ background: bg, border: `1px solid ${border}` }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: navyText }}>
              New stock item
            </span>
            <button onClick={() => setAdding(false)} aria-label="Cancel">
              <X size={15} style={{ color: inkSoft }} />
            </button>
          </div>
          <label className="text-xs" style={{ color: inkSoft }}>
            Tab
            <select
              value={newItem.tabLabel}
              onChange={(e) => setNewItem((prev) => ({ ...prev, tabLabel: e.target.value }))}
              className="block mt-1 w-full text-sm px-4 py-2 rounded-full outline-none"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            >
              <option value="" disabled>
                Choose a tab…
              </option>
              {tabs.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={NEW_TAB_VALUE}>+ New tab…</option>
            </select>
          </label>
          {newItem.tabLabel === NEW_TAB_VALUE && (
            <input
              value={newItem.newTabName}
              onChange={(e) => setNewItem((prev) => ({ ...prev, newTabName: e.target.value }))}
              placeholder="New tab name, e.g. Breakfast"
              className="text-sm px-4 py-2 rounded-full outline-none"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            />
          )}
          <input
            value={newItem.category}
            onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Category, e.g. Dairy"
            list="stock-add-categories"
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <datalist id="stock-add-categories">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input
            value={newItem.product}
            onChange={(e) => setNewItem((prev) => ({ ...prev, product: e.target.value }))}
            placeholder="Product name"
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          <div className="flex gap-2">
            <input
              value={newItem.code}
              onChange={(e) => setNewItem((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="Code (optional)"
              className="flex-1 text-sm px-4 py-2 rounded-full outline-none"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            />
            <input
              value={newItem.supplier}
              onChange={(e) => setNewItem((prev) => ({ ...prev, supplier: e.target.value }))}
              placeholder="Supplier (optional)"
              className="flex-1 text-sm px-4 py-2 rounded-full outline-none"
              style={{ border: `1px solid ${border}`, background: fill, color: ink }}
            />
          </div>
          <input
            value={newItem.cellarCode}
            onChange={(e) => setNewItem((prev) => ({ ...prev, cellarCode: e.target.value }))}
            placeholder="Cellar code (optional)"
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: fill, color: ink }}
          />
          {addError && (
            <p className="text-xs" style={{ color: "#000000" }}>
              {addError}
            </p>
          )}
          <button
            onClick={addItem}
            disabled={addSaving}
            className="text-sm font-medium py-2.5 rounded-full disabled:opacity-60"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            {addSaving ? "Adding…" : "Add item"}
          </button>
        </div>
      )}

      {tabProducts.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          {tabs.length === 0 ? "No stock sheet synced yet." : "Nothing in this tab yet."}
        </p>
      ) : (
        categories.map((cat, i) => (
          <div key={cat} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold" style={{ color: orange }}>
                {cat.toUpperCase()}
              </div>
              {i === 0 && (
                <button
                  onClick={resetAllQuantities}
                  disabled={resetting}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl disabled:opacity-60"
                  style={{ background: "#FFFFFF", color: "#000000", border: "1px solid #000000" }}
                >
                  <RotateCcw size={13} /> {resetting ? "Resetting…" : "Reset all to 0"}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {tabProducts
                .filter((p) => p.category === cat)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 rounded-2xl"
                    style={{ background: bg, border: `1px solid ${border}` }}
                  >
                    <div className="flex-1 min-w-0">
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
                    </div>
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
                ))}
            </div>
          </div>
        ))
      )}
    </Section>
  );
}
