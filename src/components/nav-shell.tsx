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
  Martini,
  MessageCircle,
  FileStack,
  Users,
  ClipboardList,
  Sparkles,
  Cake,
  ListOrdered,
  Menu as MenuIcon,
  Moon,
  Sun,
  X,
  GraduationCap,
  SlidersHorizontal,
  Star,
  CalendarOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { usePresenceTracking } from "@/lib/presence";
import type { FeatureFlags } from "@/lib/feature-flags-context";
import { bg, bgText, bgTextSoft, border, ink, inkSoft, navy, orange, panel, surface } from "@/lib/design-tokens";
import { ThemeContext } from "@/lib/theme-context";

export const NAV_ITEMS = [
  { href: "/menus", label: "Drinks", icon: Martini, adminOnly: true, staffFlag: "page_access_menus" },
  { href: "/updates", label: "Noticeboard", icon: MessageCircle, adminOnly: true, staffFlag: "page_access_updates" },
  { href: "/rota", label: "Rota", icon: CalendarDays, adminOnly: true, staffFlag: "page_access_rota" },
  { href: "/checklists", label: "Checklists", icon: CheckSquare, adminOnly: true, staffFlag: "page_access_checklists" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sops", label: "SOPs", icon: BookOpen, adminOnly: true, staffFlag: "page_access_sops" },
  { href: "/colleague-of-the-month", label: "Colleague of the Month", icon: Award, adminOnly: true, staffFlag: "page_access_colleague_of_the_month" },
  { href: "/function-sheets", label: "Function Sheets", icon: FileStack, adminOnly: true, staffFlag: "page_access_function_sheets" },
  { href: "/events", label: "Events", icon: Sparkles, adminOnly: true, staffFlag: "page_access_events" },
  { href: "/running-order", label: "Running Order", icon: ListOrdered, adminOnly: true, staffFlag: "page_access_running_order" },
  { href: "/guest-surveys", label: "Guest Surveys", icon: Star, adminOnly: true, staffFlag: "page_access_guest_surveys" },
  { href: "/stock-orders", label: "Stock Orders", icon: ClipboardList, adminOnly: true, staffFlag: "stock_orders_edit" },
  { href: "/birthdays", label: "Birthdays", icon: Cake, adminOnly: true, staffFlag: "birthdays_access" },
  { href: "/training", label: "Training", icon: GraduationCap, adminOnly: true, staffFlag: "page_access_training" },
  // Shown to casual staff (to submit) and admins (to see the compiled
  // view) — a distinct gate from the adminOnly+staffFlag pattern above,
  // since it's keyed off a per-person tag rather than a global toggle.
  { href: "/availability", label: "Availability", icon: CalendarOff, requiresCasual: true },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

export function canSeeNavItem(
  item: (typeof NAV_ITEMS)[number],
  isAdmin: boolean,
  isSuperAdmin: boolean,
  flags: FeatureFlags,
  isCasual: boolean = false
): boolean {
  if ("superAdminOnly" in item && item.superAdminOnly) return isSuperAdmin;
  if ("requiresCasual" in item && item.requiresCasual) return isAdmin || isCasual;
  if (!item.adminOnly) return true;
  if (isAdmin) return true;
  return Boolean(item.staffFlag && flags[item.staffFlag]);
}

// Bottom island (mobile only): Dashboard in the middle, flanked by the
// most-used tabs. Everything else lives behind the top-left menu. A user
// can swap these in Settings (profiles.task_bar, 6 hrefs: 3 left + 3
// right) — these are only the defaults for anyone who hasn't.
export const DEFAULT_ISLAND_LEFT = ["/menus", "/updates", "/checklists"];
export const DEFAULT_ISLAND_RIGHT = ["/events", "/function-sheets", "/sops"];

export function NavShell({
  name,
  isAdmin,
  isSuperAdmin,
  flags,
  children,
}: {
  name: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  flags: FeatureFlags;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  usePresenceTracking(profile.id, profile.name);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      // ignore — private browsing / storage blocked
    }
    // An explicit choice (from the toggle below) always wins. Otherwise,
    // follow the device's own light/dark setting, live — so the app
    // matches system dark mode without anyone having to flip it by hand.
    if (stored === "dark" || stored === "light") {
      setDark(stored === "dark");
      return;
    }
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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

  // Birthdays post to the Noticeboard (and push) from the server-side cron
  // job now (src/app/api/cron/tick), not from whoever happens to have the
  // app open that day — see docs/push-notifications.md.

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

  const taskBar = profile.task_bar?.length === 6 ? profile.task_bar : [...DEFAULT_ISLAND_LEFT, ...DEFAULT_ISLAND_RIGHT];
  const islandLeft = taskBar.slice(0, 3);
  const islandRight = taskBar.slice(3, 6);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <ThemeContext.Provider value={{ dark }}>
    <div
      className="flex w-full h-screen overflow-hidden"
      style={{ background: dark ? "#000000" : bg, color: bgText }}
    >
      {/* Sidebar (desktop) */}
      <div
        className={`hidden sm:flex flex-col w-56 shrink-0 p-4 overflow-y-auto${dark ? " dark-mode" : ""}`}
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
          {(() => {
            const visible = NAV_ITEMS.filter((item) => canSeeNavItem(item, isAdmin, isSuperAdmin, flags, profile.is_casual));
            const dashboardItem = visible.find((item) => item.href === "/dashboard");
            const rest = visible.filter((item) => item.href !== "/dashboard");
            const ordered = dashboardItem ? [dashboardItem, ...rest] : rest;
            return ordered.map(({ href, label, icon: Icon }, i) => {
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
                    marginBottom: i === 0 && dashboardItem ? 12 : 0,
                  }}
                >
                  <Icon size={16} style={{ color: active ? bg : bgTextSoft }} />
                  {label}
                </Link>
              );
            });
          })()}
        </nav>
        <div className="mt-auto pt-4" style={{ borderTop: `1px solid rgba(0,0,0,0.15)` }}>
          <div className="px-2 py-2 text-sm" style={{ color: bgText }}>
            {name}
          </div>
          {isSuperAdmin && (
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
              {NAV_ITEMS.filter((item) => item.href !== "/dashboard" && canSeeNavItem(item, isAdmin, isSuperAdmin, flags, profile.is_casual)).map(({ href, label, icon: Icon }) => {
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
              {isSuperAdmin && (
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
          {islandLeft.map((href) => {
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
          {islandRight.map((href) => {
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
