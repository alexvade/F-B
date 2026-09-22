import Link from "next/link";
import { Martini, Wine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bg, border, inkSoft, navyText, orange } from "@/lib/design-tokens";

export default async function MenusPage() {
  const supabase = await createClient();
  const [{ count: cocktailCount }, { count: wineCount }] = await Promise.all([
    supabase.from("cocktails").select("*", { count: "exact", head: true }),
    supabase.from("wines").select("*", { count: "exact", head: true }),
  ]);

  const tiles = [
    { href: "/menus/cocktails", label: "Cocktails", icon: Martini, subtitle: `${cocktailCount ?? 0} drinks` },
    { href: "/menus/wines", label: "Wines", icon: Wine, subtitle: `${wineCount ?? 0} wines` },
  ];

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
        {tiles.map(({ href, label, icon: Icon, subtitle }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-3 rounded-3xl p-8"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <Icon size={36} style={{ color: orange }} />
            <span className="text-sm font-semibold text-center" style={{ color: navyText }}>
              {label}
            </span>
            {subtitle && (
              <span className="text-xs" style={{ color: inkSoft }}>
                {subtitle}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
