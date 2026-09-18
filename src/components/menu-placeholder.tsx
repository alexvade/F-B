import Link from "next/link";
import { inkSoft, navyText, orange } from "@/lib/design-tokens";

// Menu section pages that don't have real content yet — the tab exists so
// it's navigable now, and gets its items once the menu PDF is processed
// (same extraction workflow as Events — see docs/events-extraction.md).
export function MenuPlaceholder({ title }: { title: string }) {
  return (
    <div>
      <Link href="/menus" className="text-xs mb-4 inline-block" style={{ color: navyText }}>
        ← Back to Menus
      </Link>
      <h1
        className="text-lg font-semibold mb-1 inline-block pb-1"
        style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
      >
        {title}
      </h1>
      <p className="text-sm mt-3" style={{ color: inkSoft }}>
        This menu hasn&apos;t been added yet — check back soon.
      </p>
    </div>
  );
}
