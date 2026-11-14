"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  CreditCard,
  Download,
  FolderKanban,
  Hammer,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Github } from "@/components/icons";
import { Button, cn } from "@/components/ui";
import { apiFetch, relativeTime } from "@/lib/client";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  build_id: string | null;
  created_at: string;
};

const mainNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/builder", label: "Builder", icon: Wand2 },
  { href: "/dashboard/builds", label: "Builds", icon: Hammer },
  { href: "/dashboard/downloads", label: "Downloads", icon: Download },
];

const secondaryNav = [
  { href: "/dashboard/github", label: "GitHub", icon: Github },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: {
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    github_username: string | null;
    role: "user" | "admin";
  };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setNotifyOpen(false);
  }, [pathname]);

  async function loadNotifications() {
    try {
      const data = await apiFetch<{ notifications: NotificationRow[]; unread: number }>(
        "/api/notifications"
      );
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {
      /* dashboard can still work if notifications fail */
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setNotifyOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications", { method: "PATCH", json: { all: true, read: true } });
      setNotifications((rows) => rows.map((row) => ({ ...row, read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/auth/signout", { method: "POST" });
    } catch {
      /* The session may already be gone; send the user to login anyway. */
    }
    router.replace("/login");
    router.refresh();
  }

  const initials =
    (profile.full_name ?? profile.email ?? "U")
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-800/80 px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-emerald-950">
          <Smartphone className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-white">Web2App Studio</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
            Website → App
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
          Build
        </p>
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <SidebarLink key={item.href} {...item} active={isActive(item.href, item.exact)} />
          ))}
        </div>
        <p className="px-2 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
          Account
        </p>
        <div className="space-y-0.5">
          {secondaryNav.map((item) => (
            <SidebarLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
          {profile.role === "admin" && (
            <SidebarLink href="/admin" label="Admin" icon={Shield} active={isActive("/admin")} />
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800/80 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar profile={profile} initials={initials} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-200">
              {profile.full_name || profile.github_username || "Your account"}
            </p>
            <p className="truncate text-[11px] text-zinc-500">{profile.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            loading={signingOut}
            title="Sign out"
            aria-label="Sign out"
            className="px-2"
          >
            {!signingOut && <LogOut className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-800/80 bg-zinc-950 lg:block">
        {nav}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative h-full w-72 border-r border-zinc-800 bg-zinc-950">
            <button
              className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-950/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link
              href="/dashboard/builder"
              className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 sm:inline-flex"
            >
              <Sparkles className="h-3 w-3" />
              New build
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                onClick={() => {
                  setNotifyOpen((open) => !open);
                  if (!notifyOpen) loadNotifications();
                }}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-emerald-950">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {notifyOpen && (
                <div className="absolute right-0 top-11 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <p className="text-xs font-semibold text-zinc-200">Notifications</p>
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-zinc-500">
                        No notifications yet. Build results will appear here.
                      </p>
                    ) : (
                      notifications.map((item) => {
                        const content = (
                          <div
                            className={cn(
                              "border-b border-zinc-800/60 px-4 py-3 transition-colors hover:bg-zinc-900/60",
                              !item.read && "bg-emerald-500/[0.04]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-zinc-200">{item.title}</p>
                              {!item.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                              {item.body}
                            </p>
                            <p className="mt-1 text-[10px] text-zinc-600">{relativeTime(item.created_at)}</p>
                          </div>
                        );
                        return item.build_id ? (
                          <Link key={item.id} href={`/dashboard/builds/${item.build_id}`}>
                            {content}
                          </Link>
                        ) : (
                          <div key={item.id}>{content}</div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="ml-1 hidden items-center gap-2 border-l border-zinc-800 pl-3 sm:flex">
              <Avatar profile={profile} initials={initials} />
              <div className="leading-tight">
                <p className="max-w-32 truncate text-xs font-medium text-zinc-200">
                  {profile.full_name || profile.github_username || "Account"}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {profile.role === "admin" ? "Admin" : "Member"}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-emerald-500/10 text-emerald-300"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300")} />
      {label}
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
    </Link>
  );
}

function Avatar({
  profile,
  initials,
}: {
  profile: { avatar_url: string | null; email: string | null };
  initials: string;
}) {
  return profile.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar_url}
      alt=""
      className="h-8 w-8 rounded-full border border-zinc-700 object-cover"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className="grid h-8 w-8 place-items-center rounded-full border border-zinc-700 bg-zinc-800 text-[11px] font-bold text-zinc-300">
      {initials}
    </span>
  );
}
