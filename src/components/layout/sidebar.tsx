"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactElement } from "react";
import type { User, Organization } from "@/lib/types/database";
import { hasPermission } from "@/lib/permissions";

interface SidebarProps {
  user: User;
  org: Organization;
}

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: "home" },
  { href: "/contacts", label: "Contacts", icon: "users" },
  { href: "/pipeline", label: "Pipeline", icon: "kanban" },
  { href: "/inbox", label: "Inbox", icon: "inbox", badge: 0 },
  { href: "/insights", label: "Insights", icon: "chart", permission: "view_team_analytics" as const },
  { href: "/commissions", label: "Commissions", icon: "dollar" },
  { href: "/workflows", label: "Workflows", icon: "zap", permission: "create_workflows" as const },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, ReactElement> = {
    home: <svg {...props}><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>,
    users: <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    kanban: <svg {...props}><rect width="6" height="14" x="2" y="6" rx="2" /><rect width="6" height="10" x="9" y="2" rx="2" /><rect width="6" height="12" x="16" y="8" rx="2" /></svg>,
    inbox: <svg {...props}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>,
    chart: <svg {...props}><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></svg>,
    dollar: <svg {...props}><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    zap: <svg {...props}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>,
    settings: <svg {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
    sun: <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>,
    moon: <svg {...props}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>,
    logout: <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>,
  };
  return icons[name] ?? null;
}

export function Sidebar({ user, org }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(user, item.permission);
  });

  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-[240px] flex-col bg-[var(--color-sidebar-bg)] select-none">
      {/* Logo + Org */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] shadow-md shadow-[var(--color-accent)]/25">
            <span className="text-sm font-bold text-white leading-none">K</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white leading-tight">kove</p>
            <p className="text-[11px] text-[var(--color-sidebar-text)] leading-tight truncate max-w-[140px]">{org.name}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-sidebar-text)]">
          Menu
        </p>
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text-active)]"
                  : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-active)] hover:text-[var(--color-sidebar-text-active)]"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--color-accent)]" />
              )}
              <span className={`transition-colors ${isActive ? "text-[var(--color-accent)]" : "group-hover:text-[var(--color-sidebar-text-active)]"}`}>
                <Icon name={item.icon} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[var(--color-sidebar-border)] p-3 space-y-1">
        {(user.is_owner || hasPermission(user, "manage_users")) && (
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-active)] hover:text-[var(--color-sidebar-text-active)] transition-all duration-150"
          >
            <Icon name="settings" size={16} />
            Settings
          </Link>
        )}

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-active)] hover:text-[var(--color-sidebar-text-active)] transition-all duration-150"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[var(--color-sidebar-text)] hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
        >
          <Icon name="logout" size={16} />
          Log Out
        </button>

        {/* User card */}
        <div className="mt-2 rounded-lg bg-white/[0.04] px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-[11px] font-bold text-white shadow-inner">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-[13px] font-medium text-white/90">
                {user.full_name}
              </p>
              <p className="truncate text-[11px] text-white/40">
                {user.is_owner ? "Owner" : "Member"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
