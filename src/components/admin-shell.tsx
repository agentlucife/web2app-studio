"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { Button, cn } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Overview", icon: Shield, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/settings", label: "Platform settings", icon: Settings },
];

export function AdminShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: { email: string | null; full_name: string | null; avatar_url: string | null };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const response = await fetch("/auth/signout", { method: "POST" });
    window.location.href = response.redirected ? response.url : "/login";
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-800/80 px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500 text-violet-950">
          <Shield className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Admin</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Web2App Studio</p>
        </div>
        <span className="ml-auto rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
          staff
        </span>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
              isActive(item.href, item.exact)
                ? "bg-violet-500/10 text-violet-200"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </div>
      <div className="border-t border-zinc-800/80 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full border border-zinc-700" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-300">
              {(profile.full_name ?? profile.email ?? "A")[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-200">{profile.full_name || "Administrator"}</p>
            <p className="truncate text-[11px] text-zinc-500">{profile.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="px-2" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-800/80 lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="relative h-full w-72 border-r border-zinc-800 bg-zinc-950">
            <button className="absolute right-3 top-4 p-1.5 text-zinc-400" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/85 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden items-center gap-2 text-xs text-zinc-500 lg:flex">
            <Shield className="h-3.5 w-3.5 text-violet-400" />
            Administrator area. Actions are logged with your user ID.
          </div>
          <Link href="/dashboard" className="text-xs font-medium text-zinc-400 hover:text-white">
            Exit admin →
          </Link>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
