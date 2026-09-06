"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  BookOpen,
  LogOut,
  Award,
  Wine,
  MessageCircle,
  FileStack,
  Users,
  ClipboardList,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bg, border, ink, inkSoft, navy, orange, surface } from "@/lib/design-tokens";

const NAV_ITEMS = [
  { href: "/drinks", label: "Drinks", icon: Wine },
  { href: "/updates", label: "Updates", icon: MessageCircle },
  { href: "/rota", label: "Rota", icon: CalendarDays },
  { href: "/checklists", label: "Checklists", icon: CheckSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sops", label: "SOPs", icon: BookOpen },
  { href: "/colleague-of-the-month", label: "Colleague of the Month", icon: Award },
  { href: "/function-sheets", label: "Function Sheets", icon: FileStack },
  { href: "/stock-orders", label: "Stock Orders", icon: ClipboardList },
];

export function NavShell({
  name,
  isAdmin,
  children,
}: {
  name: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div
      className="flex w-full h-full min-h-screen"
      style={{ background: bg, color: ink }}
    >
      {/* Sidebar (desktop) */}
      <div
        className="hidden sm:flex flex-col w-56 shrink-0 p-4"
        style={{ borderRight: `1px solid ${border}` }}
      >
        <div className="mb-6 px-2">
          <div className="text-sm font-semibold">Team Ops</div>
          <div className="text-xs" style={{ color: inkSoft }}>
            Operations hub
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm text-left"
                style={{
                  background: active ? navy : "transparent",
                  color: active ? "#FFFFFF" : ink,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon size={16} style={{ color: orange }} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-4" style={{ borderTop: `1px solid ${border}` }}>
          <div className="px-2 py-2 text-sm">{name}</div>
          {isAdmin && (
            <Link
              href="/admin/staff"
              className="flex items-center gap-2 px-2 py-1.5 text-xs"
              style={{ color: isActive("/admin/staff") ? navy : inkSoft }}
            >
              <Users size={14} /> Manage staff
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-2 py-1.5 text-xs"
            style={{ color: inkSoft }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 flex justify-around py-2 z-10"
        style={{ background: surface, borderTop: `1px solid ${border}` }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="p-2.5 rounded-full"
              style={{
                background: active ? navy : "transparent",
                color: active ? orange : inkSoft,
              }}
            >
              <Icon size={20} />
            </Link>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-10 py-8 pb-20 sm:pb-8 max-w-3xl">
        {children}
      </div>
    </div>
  );
}
