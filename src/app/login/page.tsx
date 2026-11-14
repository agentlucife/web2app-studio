"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Github } from "@/components/icons";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next");
    if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
      setNext(requested);
    }
    const message = params.get("error");
    if (message) setError(message);
  }, []);

  async function signInGitHub() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo,
          scopes: "read:user user:email repo workflow",
        },
      });
      if (oauthError) throw oauthError;
      // On success the browser is redirected to GitHub; keep the loading state
      // until that navigation happens.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start GitHub sign-in.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.16),_transparent_55%)]"
      />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4 text-emerald-400" />
          Web2App Studio
        </span>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-7 shadow-2xl backdrop-blur sm:p-9">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <Github className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Sign in to continue</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Use GitHub to authenticate. We use your account only for sign-in and to connect a
              repository when you choose to build.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="mt-6 w-full"
              loading={loading}
              onClick={signInGitHub}
            >
              {!loading && <Github className="h-4 w-4" />}
              {loading ? "Redirecting to GitHub…" : "Continue with GitHub"}
            </Button>

            <div className="mt-6 space-y-3 border-t border-zinc-800 pt-5 text-xs text-zinc-500">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Tokens are encrypted at rest and never exposed to the browser. You can also connect
                a personal access token from the GitHub page after signing in.
              </p>
              <p className="flex items-start gap-2">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
                GitHub OAuth must be enabled in your Supabase project (Authentication → Providers).
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Your GitHub password is never shared with Web2App Studio.
          </p>
        </div>
      </div>
    </main>
  );
}
