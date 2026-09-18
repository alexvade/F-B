import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MenuGuide } from "@/components/menu-guide";
import { MenuPlaceholder } from "@/components/menu-placeholder";
import { navyText } from "@/lib/design-tokens";

export default async function AfternoonTeaMenuPage() {
  const supabase = await createClient();
  const { data: menu } = await supabase.from("menus").select("content").eq("slug", "afternoon-tea").maybeSingle();

  if (!menu?.content) return <MenuPlaceholder title="Afternoon Tea" />;
  return (
    <div>
      <Link href="/menus" className="text-xs mb-4 inline-block" style={{ color: navyText }}>
        ← Back to Menus
      </Link>
      <MenuGuide content={menu.content} />
    </div>
  );
}
