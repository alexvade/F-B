"use client";

import { useState } from "react";
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
  Sparkles,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bg, bgText, bgTextSoft, border, ink, inkSoft, navy, orange, panel, surface } from "@/lib/design-tokens";

const NAV_ITEMS = [
  { href: "/drinks", label: "Drinks", icon: Wine },
  { href: "/updates", label: "Updates", icon: MessageCircle },
  { href: "/rota", label: "Rota", icon: CalendarDays },
  { href: "/checklists", label: "Checklists", icon: CheckSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sops", label: "SOPs", icon: BookOpen },
  { href: "/colleague-of-the-month", label: "Colleague of the Month", icon: Award },
  { href: "/function-sheets", label: "Function Sheets", icon: FileStack },
  { href: "/events", label: "Events", icon: Sparkles },
  { href: "/stock-orders", label: "Stock Orders", icon: ClipboardList, adminOnly: true },
];

// Bottom island (mobile only): Dashboard in the middle, flanked by the
// most-used tabs. Everything else lives behind the top-left menu.
const ISLAND_LEFT = ["/drinks", "/updates", "/checklists"];
const ISLAND_RIGHT = ["/events", "/function-sheets", "/sops"];

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
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const findItem = (href: string) => NAV_ITEMS.find((item) => item.href === href)!;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div
      className="flex w-full h-screen"
      style={{ background: bg, color: bgText }}
    >
      {/* Sidebar (desktop) */}
      <div
        className="hidden sm:flex flex-col w-56 shrink-0 p-4"
        style={{ borderRight: `1px solid rgba(0,0,0,0.15)` }}
      >
        <div className="mb-6 px-2">
          <div className="text-sm font-semibold" style={{ color: bgText }}>
            Team Ops
          </div>
          <div className="text-xs" style={{ color: bgTextSoft }}>
            Operations hub
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm text-left"
                style={{
                  background: active ? navy : "transparent",
                  color: active ? bg : bgTextSoft,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon size={16} style={{ color: active ? bg : bgTextSoft }} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-4" style={{ borderTop: `1px solid rgba(0,0,0,0.15)` }}>
          <div className="px-2 py-2 text-sm" style={{ color: bgText }}>
            {name}
          </div>
          {isAdmin && (
            <Link
              href="/admin/staff"
              className="flex items-center gap-2 px-2 py-1.5 text-xs"
              style={{ color: isActive("/admin/staff") ? orange : bgTextSoft }}
            >
              <Users size={14} /> Manage staff
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-2 py-1.5 text-xs"
            style={{ color: bgTextSoft }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {/* Menu button (mobile) */}
      <button
        onClick={() => setMenuOpen(true)}
        className="sm:hidden fixed top-4 left-4 z-20 p-2.5 rounded-full"
        style={{ background: bg, border: `1px solid ${border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.10)" }}
        aria-label="Open menu"
      >
        <MenuIcon size={20} style={{ color: orange }} />
      </button>

      {/* All-tabs menu (mobile) */}
      {menuOpen && (
        <div
          className="sm:hidden fixed inset-0 z-30 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="rounded-t-3xl p-4 pb-8 max-h-[80vh] overflow-y-auto"
            style={{ background: surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="text-sm font-semibold">All tabs</div>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-full" style={{ color: inkSoft }} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.filter((item) => item.href !== "/dashboard" && (!item.adminOnly || isAdmin)).map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm"
                    style={{
                      background: active ? navy : "transparent",
                      color: active ? bg : ink,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <Icon size={18} style={{ color: active ? bg : ink }} />
                    {label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin/staff"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm"
                  style={{ color: ink }}
                >
                  <Users size={18} style={{ color: orange }} /> Manage staff
                </Link>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleSignOut();
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-left"
                style={{ color: inkSoft }}
              >
                <LogOut size={18} /> Sign out
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Bottom nav island (mobile) */}
      <div
        className="sm:hidden fixed bottom-4 left-4 right-4 z-10 flex items-center justify-between px-2 py-2 rounded-full"
        style={{ background: surface, border: `1px solid ${border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.14)" }}
      >
        <div className="flex items-center gap-1">
          {ISLAND_LEFT.map((href) => {
            const { icon: Icon } = findItem(href);
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="p-2.5 rounded-full"
                style={{ background: active ? navy : "transparent", color: active ? "#FFFFFF" : inkSoft }}
              >
                <Icon size={20} />
              </Link>
            );
          })}
        </div>

        <Link
          href="/dashboard"
          className="p-3 rounded-full -mt-6"
          style={{ background: navy, color: "#FFFFFF", border: `4px solid ${surface}`, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
        >
          <LayoutDashboard size={22} />
        </Link>

        <div className="flex items-center gap-1">
          {ISLAND_RIGHT.map((href) => {
            const { icon: Icon } = findItem(href);
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="p-2.5 rounded-full"
                style={{ background: active ? navy : "transparent", color: active ? "#FFFFFF" : inkSoft }}
              >
                <Icon size={20} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div
          className="rounded-3xl px-5 sm:px-10 pt-16 sm:pt-8 pb-28 sm:pb-8 max-w-3xl"
          style={{ background: panel, minHeight: "calc(100vh - 24px)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
