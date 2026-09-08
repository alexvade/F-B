"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Pencil, Plus, Trash2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { CocktailGlass } from "@/components/cocktail-glass";
import { buildHaystack, cocktailInStock, type StockHaystack } from "@/lib/cocktail-stock-match";
import { bg, border, ink, inkSoft, navy, navyText, orange, orangeSoft, surface } from "@/lib/design-tokens";

type Cocktail = {
  id: number;
  name: string;
  category: string;
  glass_shape: string | null;
  colour: string | null;
  garnish: string | null;
  ingredients: string[];
  method: string[];
};

const SHAPES = ["balloon", "rocks", "highball", "coupe", "martini", "flute", "mug"];

const EMPTY_FORM = {
  id: null as number | null,
  name: "",
  category: "Cocktail",
  glass_shape: "balloon",
  colour: "#E8A33D",
  garnish: "",
  ingredients: "",
  method: "",
};

export default function CocktailsPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const supabase = createClient();

  const [cocktails, setCocktails] = useState<Cocktail[]>([]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Cocktail | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);
  const [stockHaystack, setStockHaystack] = useState<StockHaystack | null>(null);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from("cocktails").select("*").order("sort_order").order("name");
    setCocktails(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    supabase
      .from("stock_products")
      .select("category, product")
      .then(({ data }) => setStockHaystack(buildHaystack(data ?? [])));
  }, [supabase]);

  const openEdit = (c?: Cocktail) => {
    setForm(
      c
        ? {
            id: c.id,
            name: c.name,
            category: c.category,
            glass_shape: c.glass_shape ?? "balloon",
            colour: c.colour ?? "#E8A33D",
            garnish: c.garnish ?? "",
            ingredients: c.ingredients.join("\n"),
            method: c.method.join("\n"),
          }
        : { ...EMPTY_FORM }
    );
  };

  const saveForm = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        glass_shape: form.glass_shape,
        colour: form.colour,
        garnish: form.garnish.trim() || null,
        ingredients: form.ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
        method: form.method.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      if (form.id) {
        await supabase.from("cocktails").update(payload).eq("id", form.id);
      } else {
        await supabase.from("cocktails").insert(payload);
      }
      setForm(null);
      setActive(null);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const deleteCocktail = async (id: number) => {
    await supabase.from("cocktails").delete().eq("id", id);
    setActive(null);
    loadData();
  };

  if (form) {
    return (
      <div>
        <button onClick={() => setForm(null)} className="text-xs mb-4" style={{ color: navyText }}>
          ← Cancel
        </button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: navyText }}>
          {form.id ? "Edit cocktail" : "New cocktail"}
        </h2>
        <div className="flex flex-col gap-3 max-w-md">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <div className="flex gap-2">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="text-sm px-3 py-2 rounded-full outline-none flex-1"
              style={{ border: `1px solid ${border}`, background: bg, color: ink }}
            >
              <option value="Cocktail">Cocktail</option>
              <option value="Mocktail">Mocktail</option>
            </select>
            <select
              value={form.glass_shape}
              onChange={(e) => setForm({ ...form, glass_shape: e.target.value })}
              className="text-sm px-3 py-2 rounded-full outline-none flex-1"
              style={{ border: `1px solid ${border}`, background: bg, color: ink }}
            >
              {SHAPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="color"
              value={form.colour}
              onChange={(e) => setForm({ ...form, colour: e.target.value })}
              className="w-11 h-9 rounded-full overflow-hidden"
            />
          </div>
          <textarea
            placeholder="Ingredients, one per line"
            value={form.ingredients}
            onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
            rows={5}
            className="text-sm px-4 py-3 rounded-2xl outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <textarea
            placeholder="Method steps, one per line"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            rows={5}
            className="text-sm px-4 py-3 rounded-2xl outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <input
            placeholder="Garnish"
            value={form.garnish}
            onChange={(e) => setForm({ ...form, garnish: e.target.value })}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={{ border: `1px solid ${border}`, background: bg, color: ink }}
          />
          <button
            onClick={saveForm}
            disabled={saving}
            className="text-sm font-medium py-2.5 rounded-full disabled:opacity-60"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setActive(null)} className="text-xs" style={{ color: navyText }}>
            ← Back to Cocktails
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => openEdit(active)} style={{ color: navyText }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => deleteCocktail(active.id)} style={{ color: "#C24A3B" }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div
            className="shrink-0 rounded-3xl p-3"
            style={{ width: 100, height: 130, background: surface, border: `1px solid ${border}` }}
          >
            <CocktailGlass shape={active.glass_shape} color={active.colour} />
          </div>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: orange }}>
              {active.category.toUpperCase()}
            </div>
            <h2 className="text-lg font-semibold" style={{ color: navyText }}>
              {active.name}
            </h2>
          </div>
        </div>

        <div className="mb-5">
          <div className="text-sm font-semibold mb-2" style={{ color: navyText }}>
            Ingredients
          </div>
          <ul className="flex flex-col gap-1.5">
            {active.ingredients.map((ing, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: ink }}>
                <span style={{ color: orange }}>•</span>
                {ing}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-5">
          <div className="text-sm font-semibold mb-2" style={{ color: navyText }}>
            Method
          </div>
          <ol className="flex flex-col gap-2">
            {active.method.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: ink }}>
                <span
                  className="flex items-center justify-center shrink-0 rounded-full text-xs font-medium"
                  style={{ width: 20, height: 20, background: orangeSoft, color: navyText, marginTop: 2 }}
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {active.garnish && (
          <div className="p-3 rounded-2xl" style={{ background: surface, border: `1px solid ${border}` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: orange }}>
              GARNISH
            </div>
            <div className="text-sm" style={{ color: ink }}>
              {active.garnish}
            </div>
          </div>
        )}
      </div>
    );
  }

  const filtered = cocktails.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <Link href="/drinks" className="text-xs mb-4 inline-block" style={{ color: navyText }}>
        ← Back to Drinks
      </Link>
      <div className="flex items-center justify-between">
        <h1
          className="text-lg font-semibold mb-1 inline-block pb-1"
          style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
        >
          Cocktails
        </h1>
        {isAdmin && (
          <button
            onClick={() => openEdit()}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-2xl"
            style={{ background: orangeSoft, color: navy }}
          >
            <Plus size={13} /> Add
          </button>
        )}
      </div>
      <p className="text-sm mb-4 mt-2" style={{ color: inkSoft }}>
        Tap a drink for its full spec — ingredients, method and garnish
      </p>

      <div className="relative mb-6">
        <Search size={16} style={{ color: inkSoft, position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cocktails…"
          className="w-full text-sm pl-10 pr-4 py-2.5 rounded-full outline-none"
          style={{ border: `1px solid ${border}`, color: ink, background: bg }}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-sm" style={{ color: inkSoft }}>
          No cocktails match &quot;{search}&quot;.
        </p>
      )}

      {["Cocktail", "Mocktail"].map((cat) => {
        const matches = filtered.filter((c) => c.category === cat).sort((a, b) => a.name.localeCompare(b.name));
        if (matches.length === 0) return null;
        return (
          <div key={cat} className="mb-6">
            <div className="text-xs font-semibold mb-3" style={{ color: orange }}>
              {cat.toUpperCase()}S
            </div>
            <div className="grid grid-cols-3 gap-3">
              {matches.map((c) => {
                const inStock = stockHaystack ? cocktailInStock(c.ingredients, stockHaystack) : false;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActive(c)}
                    className="relative flex flex-col items-center text-center rounded-3xl p-2"
                    style={{ background: surface, border: `1px solid ${border}` }}
                  >
                    <div style={{ width: 56, height: 78 }}>
                      <CocktailGlass shape={c.glass_shape} color={c.colour} />
                    </div>
                    <span className="text-xs mt-1 leading-tight" style={{ color: ink }}>
                      {c.name}
                    </span>
                    {inStock && (
                      <span
                        className="absolute flex items-center justify-center rounded-full"
                        style={{ top: 4, right: 4, width: 16, height: 16, background: "#4CAF6E" }}
                        title="We have ingredients for this"
                      >
                        <Check size={11} strokeWidth={3} color="#FFFFFF" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
