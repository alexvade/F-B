"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Section } from "@/components/section";
import { bg, border, ink, inkSoft, navy, navyText, orange, surface } from "@/lib/design-tokens";

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
};

export default function StockOrdersPage() {
  const supabase = createClient();
  const [tabs, setTabs] = useState<string[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

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

  const tabProducts = products.filter((p) => p.tab_label === tab);
  const categories = Array.from(new Set(tabProducts.map((p) => p.category)));

  return (
    <Section title="Stock Orders" subtitle="Add a quantity for anything that needs ordering">
      <div className="flex gap-1.5 overflow-x-auto mb-6 pb-1" style={{ scrollbarWidth: "thin" }}>
        {tabs.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-xs px-3.5 py-1.5 rounded-2xl shrink-0 whitespace-nowrap"
              style={{
                background: active ? navy : surface,
                color: active ? "#FFFFFF" : ink,
                border: `1px solid ${active ? navy : border}`,
                fontWeight: active ? 600 : 400,
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tabProducts.length === 0 ? (
        <p className="text-sm" style={{ color: inkSoft }}>
          {tabs.length === 0 ? "No stock sheet synced yet." : "Nothing in this tab yet."}
        </p>
      ) : (
        categories.map((cat) => (
          <div key={cat} className="mb-6">
            <div className="text-xs font-semibold mb-2" style={{ color: orange }}>
              {cat.toUpperCase()}
            </div>
            <div className="flex flex-col gap-1">
              {tabProducts
                .filter((p) => p.category === cat)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 rounded-2xl"
                    style={{ background: surface, border: `1px solid ${border}` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: ink }}>
                        {p.product}
                      </div>
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
                        background: bg,
                      }}
                    />
                  </div>
                ))}
            </div>
          </div>
        ))
      )}
    </Section>
  );
}
