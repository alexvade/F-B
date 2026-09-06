import Link from "next/link";
import { Martini, Wine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { border, inkSoft, navy, navySoft, navyText, orange, orangeSoft, surface } from "@/lib/design-tokens";

export default async function DrinksPage() {
  const supabase = await createClient();
  const [{ count: cocktailCount }, { count: wineCount }] = await Promise.all([
    supabase.from("cocktails").select("*", { count: "exact", head: true }),
    supabase.from("wines").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <h1
        className="text-lg font-semibold mb-1 inline-block pb-1"
        style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
      >
        Drinks
      </h1>
      <p className="text-sm mb-6 mt-2" style={{ color: inkSoft }}>
        Choose a menu to browse
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/drinks/cocktails"
          className="flex flex-col items-center justify-center gap-3 rounded-3xl p-8"
          style={{ background: `linear-gradient(135deg, ${orangeSoft} 0%, ${surface} 100%)`, border: `1px solid ${border}` }}
        >
          <Martini size={36} style={{ color: orange }} />
          <span className="text-sm font-semibold" style={{ color: navyText }}>
            Cocktails
          </span>
          <span className="text-xs" style={{ color: inkSoft }}>
            {cocktailCount ?? 0} drinks
          </span>
        </Link>
        <Link
          href="/drinks/wines"
          className="flex flex-col items-center justify-center gap-3 rounded-3xl p-8"
          style={{ background: `linear-gradient(135deg, ${navySoft} 0%, ${surface} 100%)`, border: `1px solid ${border}` }}
        >
          <Wine size={36} style={{ color: navy }} />
          <span className="text-sm font-semibold" style={{ color: navyText }}>
            Wines
          </span>
          <span className="text-xs" style={{ color: inkSoft }}>
            {wineCount ?? 0} wines
          </span>
        </Link>
      </div>
    </div>
  );
}
