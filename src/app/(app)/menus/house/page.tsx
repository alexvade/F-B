"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Crown, GlassWater } from "lucide-react";
import { useProfile } from "@/lib/profile-context";
import { HOUSE_COCKTAILS, type HouseCocktail } from "@/lib/house-cocktails";
import { bg, border, fill, ink, inkSoft, navyText, orange } from "@/lib/design-tokens";

type Filter = "all" | "cocktail" | "alcohol-free";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cocktail", label: "Cocktails" },
  { key: "alcohol-free", label: "Alcohol-free" },
];

const price = (n: number) => `£${n % 1 === 0 ? n : n.toFixed(2)}`;

function SignatureBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide px-2.5 py-1 rounded-full"
      style={{ background: ink, color: bg }}
    >
      <Crown size={12} fill={bg} /> SIGNATURE
    </span>
  );
}

function SpecNote({ text }: { text: string }) {
  return (
    <div className="flex gap-2 p-3 rounded-2xl mb-5 text-sm" style={{ border: `1px dashed ${border}`, color: ink }}>
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

function Detail({ drink, isAdmin, onBack }: { drink: HouseCocktail; isAdmin: boolean; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="text-xs mb-4" style={{ color: navyText }}>
        ← Back to House Menu
      </button>

      <div className="relative w-full overflow-hidden rounded-3xl mb-5" style={{ aspectRatio: "4 / 5", border: `1px solid ${border}` }}>
        <Image src={drink.image} alt={drink.name} fill sizes="(max-width: 640px) 100vw, 480px" className="object-cover" preload />
      </div>

      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          {drink.signature && (
            <div className="mb-2">
              <SignatureBadge />
            </div>
          )}
          <div className="text-xs font-semibold mb-1 tracking-wide" style={{ color: orange }}>
            {drink.kind === "alcohol-free" ? "ALCOHOL-FREE" : "COCKTAIL"} · {drink.glass.toUpperCase()}
          </div>
          <h2 className="text-2xl font-semibold" style={{ color: navyText }}>
            {drink.name}
          </h2>
        </div>
        {drink.price != null && (
          <div className="text-2xl font-semibold shrink-0" style={{ color: navyText }}>
            {price(drink.price)}
          </div>
        )}
      </div>

      {drink.specNote && <SpecNote text={drink.specNote} />}

      <div className="mb-6">
        <div className="text-sm font-semibold mb-2" style={{ color: navyText }}>
          Spec
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
          {drink.ingredients.map((ing, i) => (
            <div
              key={i}
              className="flex text-sm"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${border}` }}
            >
              <div className="w-20 shrink-0 px-3 py-2 font-semibold tabular-nums" style={{ color: ink }}>
                {ing.qty}
              </div>
              <div className="px-3 py-2" style={{ color: ink, borderLeft: `1px solid ${border}` }}>
                {ing.item}
              </div>
            </div>
          ))}
        </div>
      </div>

      {drink.method.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold mb-2" style={{ color: navyText }}>
            Method
          </div>
          <ol className="flex flex-col gap-2.5">
            {drink.method.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: ink }}>
                <span
                  className="flex items-center justify-center shrink-0 rounded-full text-xs font-medium"
                  style={{ width: 22, height: 22, border: `1px solid ${border}`, color: navyText, marginTop: 1 }}
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }}>
          <div className="text-xs font-semibold mb-1" style={{ color: orange }}>
            GARNISH
          </div>
          <div className="text-sm" style={{ color: ink }}>
            {drink.garnish}
          </div>
        </div>
        <div className="p-3 rounded-2xl" style={{ background: bg, border: `1px solid ${border}` }}>
          <div className="text-xs font-semibold mb-1" style={{ color: orange }}>
            {drink.allergensMayContain ? "MAY CONTAIN" : "ALLERGENS"}
          </div>
          <div className="text-sm" style={{ color: ink }}>
            {drink.allergens.length > 0 ? drink.allergens.join(", ") : "None listed"}
          </div>
        </div>
      </div>

      {isAdmin && drink.cost != null && drink.gp != null && drink.targetGp != null && (
        <div className="p-4 rounded-2xl mb-4" style={{ background: fill, border: `1px solid ${border}` }}>
          <div className="text-xs font-semibold mb-3" style={{ color: orange }}>
            COSTING · ADMINS ONLY
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs" style={{ color: inkSoft }}>Cost</div>
              <div className="text-base font-semibold" style={{ color: ink }}>{price(drink.cost)}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: inkSoft }}>GP</div>
              <div className="text-base font-semibold" style={{ color: ink }}>{drink.gp.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: inkSoft }}>Target</div>
              <div className="text-base font-semibold" style={{ color: ink }}>{drink.targetGp}%</div>
            </div>
          </div>
          {drink.gp < drink.targetGp && (
            <div className="text-xs mt-3 text-center font-medium" style={{ color: ink }}>
              Below target GP
            </div>
          )}
          <div className="text-xs mt-3 text-center" style={{ color: inkSoft }}>
            EPOS {drink.epos} · spec {drink.specDate}
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed" style={{ color: inkSoft }}>
        All drinks are made where allergens are present. If a guest asks for more allergen information, check with a
        manager.
      </p>
    </div>
  );
}

export default function HouseMenuPage() {
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<HouseCocktail | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [active]);

  if (active) return <Detail drink={active} isAdmin={isAdmin} onBack={() => setActive(null)} />;

  const shown = HOUSE_COCKTAILS.filter((d) => filter === "all" || d.kind === filter);
  const signatures = shown.filter((d) => d.signature);
  const groups: { kind: HouseCocktail["kind"]; label: string }[] = [
    { kind: "cocktail", label: "COCKTAILS" },
    { kind: "alcohol-free", label: "ALCOHOL-FREE" },
  ];

  return (
    <div>
      <Link href="/menus" className="text-xs mb-4 inline-block" style={{ color: navyText }}>
        ← Back to Drinks
      </Link>
      <h1
        className="text-lg font-semibold mb-1 inline-block pb-1"
        style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
      >
        House Menu
      </h1>
      <p className="text-sm mb-4 mt-2" style={{ color: inkSoft }}>
        Our current cocktail menu — tap a drink for the spec, method and allergens
      </p>

      <div className="flex gap-2 mb-6">
        {FILTERS.map(({ key, label }) => {
          const on = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="text-xs font-medium px-3.5 py-1.5 rounded-full"
              style={{ border: `1px solid ${border}`, background: on ? ink : bg, color: on ? bg : ink }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {signatures.map((d) => (
        <button
          key={d.slug}
          onClick={() => setActive(d)}
          className="w-full text-left rounded-3xl overflow-hidden mb-8 flex flex-col sm:flex-row"
          style={{ background: bg, border: `2px solid ${border}` }}
        >
          <div className="relative w-full sm:w-1/2 shrink-0" style={{ aspectRatio: "4 / 5" }}>
            <Image src={d.image} alt={d.name} fill sizes="(max-width: 640px) 100vw, 360px" className="object-cover" preload />
            <span className="absolute" style={{ top: 12, left: 12 }}>
              <SignatureBadge />
            </span>
          </div>
          <div className="p-5 flex flex-col justify-center" style={{ borderTop: `2px solid ${border}` }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide mb-2" style={{ color: orange }}>
              <Crown size={13} /> OUR SIGNATURE COCKTAIL
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-2xl font-semibold leading-tight" style={{ color: navyText }}>
                {d.name}
              </h2>
              {d.price != null && (
                <span className="text-xl font-semibold shrink-0" style={{ color: ink }}>
                  {price(d.price)}
                </span>
              )}
            </div>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: inkSoft }}>
              {d.ingredients.map((i) => i.item).join(" · ")}
            </p>
            <div className="text-xs mt-3 font-medium" style={{ color: ink }}>
              {d.glass} · tap for the full spec →
            </div>
          </div>
        </button>
      ))}

      {groups.map(({ kind, label }) => {
        const drinks = shown.filter((d) => d.kind === kind && !d.signature);
        if (drinks.length === 0) return null;
        return (
          <div key={kind} className="mb-8">
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-3" style={{ color: orange }}>
              <GlassWater size={12} /> {label}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {drinks.map((d) => (
                <button
                  key={d.slug}
                  onClick={() => setActive(d)}
                  className="text-left rounded-3xl overflow-hidden"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <div className="relative w-full" style={{ aspectRatio: "4 / 5" }}>
                    <Image src={d.image} alt={d.name} fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" />
                    {d.specNote && (
                      <span
                        className="absolute flex items-center justify-center rounded-full"
                        style={{ top: 8, right: 8, width: 24, height: 24, background: bg, border: `1px solid ${border}` }}
                        title="Spec needs checking"
                      >
                        <AlertTriangle size={13} color={ink} />
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2.5" style={{ borderTop: `1px solid ${border}` }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold leading-tight" style={{ color: ink }}>
                        {d.name}
                      </span>
                      {d.price != null && (
                        <span className="text-sm font-semibold shrink-0" style={{ color: ink }}>
                          {price(d.price)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: inkSoft }}>
                      {d.glass}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
