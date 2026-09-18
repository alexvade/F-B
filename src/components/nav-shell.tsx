"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  BookOpen,
  LogOut,
  Award,
  UtensilsCrossed,
  MessageCircle,
  FileStack,
  Users,
  ClipboardList,
  Sparkles,
  Cake,
  Menu as MenuIcon,
  Moon,
  Sun,
  X,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { bg, bgText, bgTextSoft, border, ink, inkSoft, navy, orange, panel, surface } from "@/lib/design-tokens";
import { ThemeContext } from "@/lib/theme-context";

const NAV_ITEMS = [
  { href: "/menus", label: "Menus", icon: UtensilsCrossed },
  { href: "/updates", label: "Noticeboard", icon: MessageCircle },
  { href: "/rota", label: "Rota", icon: CalendarDays },
  { href: "/checklists", label: "Checklists", icon: CheckSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sops", label: "SOPs", icon: BookOpen },
  { href: "/colleague-of-the-month", label: "Colleague of the Month", icon: Award },
  { href: "/function-sheets", label: "Function Sheets", icon: FileStack },
  { href: "/events", label: "Events", icon: Sparkles },
  { href: "/stock-orders", label: "Stock Orders", icon: ClipboardList, adminOnly: true },
  { href: "/birthdays", label: "Birthdays", icon: Cake, adminOnly: true },
  { href: "/training", label: "Training", icon: GraduationCap, adminOnly: true },
];

// Bottom island (mobile only): Dashboard in the middle, flanked by the
// most-used tabs. Everything else lives behind the top-left menu.
const ISLAND_LEFT = ["/menus", "/updates", "/checklists"];
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
  const profile = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setDark(localStorage.getItem("theme") === "dark");
    } catch {
      // ignore — private browsing / storage blocked
    }
  }, []);

  // Lock background scroll while the mobile all-tabs sheet is open — on
  // some mobile browsers, a `position: fixed` overlay left over a page
  // the user has scrolled gets sized/positioned against the wrong
  // viewport, so it can render below the visible screen until the page
  // itself is scrolled. Locking the body avoids that entirely.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  // Once per app load: if it's someone's birthday today, post it to the
  // Noticeboard — unless a post for them already went out today.
  useEffect(() => {
    const supabase = createClient();
    const checkBirthdays = async () => {
      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth() + 1;
      const { data: todays } = await supabase.from("birthdays").select("*").eq("day", day).eq("month", month);
      if (!todays || todays.length === 0) return;

      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      for (const b of todays) {
        const marker = `🎂 Happy birthday, ${b.name}`;
        const { data: existing } = await supabase
          .from("posts")
          .select("id")
          .ilike("text", `${marker}%`)
          .gte("created_at", startOfDay)
          .limit(1);
        if (existing && existing.length > 0) continue;
        await supabase.from("posts").insert({ author_id: profile.id, text: `${marker}! 🎉🎈` });
      }
    };
    checkBirthdays();
    // Deliberately once per mount — profile.id is stable for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If an admin deletes this account, its refresh token is invalidated
  // immediately — but a tab already sitting open here doesn't touch the
  // login-gate middleware again until its next navigation, so its access
  // token would otherwise keep working client-side until it naturally
  // expires (up to ~1hr). Supabase's client auto-refreshes shortly before
  // expiry and, finding the refresh token gone, fires SIGNED_OUT — catch
  // that here for an immediate, hard redirect instead of waiting for it.
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDark = () => {
    setDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {
        // ignore — private browsing / storage blocked
      }
      return next;
    });
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const findItem = (href: string) => NAV_ITEMS.find((item) => item.href === href)!;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <ThemeContext.Provider value={{ dark }}>
    <div
      className="flex w-full h-screen"
      style={{ background: dark ? "#000000" : bg, color: bgText }}
    >
      {/* Sidebar (desktop) */}
      <div
        className={`hidden sm:flex flex-col w-56 shrink-0 p-4${dark ? " dark-mode" : ""}`}
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
            onClick={toggleDark}
            className="flex items-center gap-2 px-2 py-1.5 text-xs w-full text-left"
            style={{ color: bgTextSoft }}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? "Light mode" : "Dark mode"}
          </button>
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
        className={`sm:hidden fixed top-4 left-4 z-20 p-2.5 rounded-full${dark ? " dark-mode" : ""}`}
        style={{ background: bg, border: `1px solid ${border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.10)" }}
        aria-label="Open menu"
      >
        <MenuIcon size={20} style={{ color: orange }} />
      </button>

      {/* All-tabs menu (mobile) */}
      {menuOpen && (
        <div
          className={`sm:hidden fixed inset-0 z-30 flex flex-col justify-end${dark ? " dark-mode" : ""}`}
          style={{ background: "rgba(0,0,0,0.4)", height: "100dvh" }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            ref={(el) => el?.scrollTo(0, 0)}
            className="rounded-t-3xl p-4 pb-8 overflow-y-auto"
            style={{ background: surface, maxHeight: "80dvh" }}
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
                onClick={toggleDark}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-left"
                style={{ color: ink }}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? "Light mode" : "Dark mode"}
              </button>
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
        className={`sm:hidden fixed bottom-4 left-4 right-4 z-10 flex items-center justify-between px-2 py-2 rounded-full${dark ? " dark-mode" : ""}`}
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
      <div className={`flex-1 overflow-y-auto p-3 sm:p-4${dark ? " dark-mode" : ""}`}>
        <div
          className="rounded-3xl px-5 sm:px-10 pt-16 sm:pt-8 pb-28 sm:pb-8 max-w-3xl"
          style={{ background: panel, minHeight: "calc(100vh - 24px)" }}
        >
          {children}
        </div>
      </div>
    </div>
    </ThemeContext.Provider>
  );
}
