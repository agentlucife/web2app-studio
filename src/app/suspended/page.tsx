import Link from "next/link";
import { Ban, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui";
import { getPlatformSettings } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const settings = await getPlatformSettings();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <Ban className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Account suspended</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          This account has been suspended and cannot access the dashboard, build projects or
          download artifacts. If you believe this is a mistake, contact support and include the
          email address you signed up with.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a href={`mailto:${settings.supportEmail}?subject=Account%20suspension%20appeal`}>
            <Button variant="secondary" className="w-full sm:w-auto">
              <Mail className="h-4 w-4" />
              Email support
            </Button>
          </a>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
        <p className="mt-6 text-xs text-zinc-600">
          You can also return to the{" "}
          <Link href="/" className="underline underline-offset-2 hover:text-zinc-400">
            home page
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
