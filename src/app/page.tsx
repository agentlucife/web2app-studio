import Link from "next/link";
import {
  ArrowRight,
  Check,
  Layers,
  Lock,
  Smartphone,
  Sparkles,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";
import { Github } from "@/components/icons";

const FEATURES = [
  {
    icon: Wand2,
    title: "Real Capacitor projects",
    body: "Choose your name, icon, splash, colours, permissions and deep links. The server writes a genuine Capacitor project — not a WebView wrapper mock-up.",
  },
  {
    icon: Github,
    title: "Your GitHub, your runners",
    body: "Source is committed to your repository and compiled by GitHub Actions. You keep the code, signing keys and build minutes.",
  },
  {
    icon: Smartphone,
    title: "Android & iOS outputs",
    body: "Debug APKs, signed release APKs and Play Store AABs, plus iOS archives and installable IPAs when Apple signing is configured.",
  },
  {
    icon: Lock,
    title: "Private by default",
    body: "GitHub tokens are AES-256-GCM encrypted. Artifacts live in a private bucket and are served through short-lived signed URLs.",
  },
  {
    icon: Layers,
    title: "Honest build status",
    body: "Queued, preparing, building, verifying, completed or failed. Real GitHub logs, cancellation and retry — never a fake progress bar.",
  },
  {
    icon: Zap,
    title: "No local SDK",
    body: "No Android Studio or Xcode on your machine. Push a website URL, connect GitHub and download the verified build artifact.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Describe the app",
    body: "Add your website URL, app name, package ID, icon and splash. Pick the native features your site needs.",
  },
  {
    number: "02",
    title: "Connect GitHub",
    body: "Sign in with GitHub or add a scoped personal access token. Pick or create a private repository.",
  },
  {
    number: "03",
    title: "Build & download",
    body: "Start a build. GitHub Actions compiles it; Web2App Studio verifies the artifact and gives you a secure download link.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.16),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000,transparent)]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500 text-emerald-950 shadow-[0_0_30px_-8px_rgba(16,185,129,0.8)]">
            <Smartphone className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight text-white">Web2App Studio</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Website → app</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-xs font-medium text-zinc-400 md:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#pricing" className="hover:text-white">Limits</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-emerald-950 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.8)] transition-colors hover:bg-emerald-400"
          >
            Start building <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
              <Sparkles className="h-3 w-3" /> Real builds on GitHub Actions
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Turn any website into a{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                real mobile app
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
              Generate a native Capacitor project, compile it on your own GitHub Actions runners, and download a verified
              APK, AAB or IPA. No Android Studio or Xcode required.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 shadow-[0_12px_36px_-14px_rgba(16,185,129,0.9)] transition-colors hover:bg-emerald-400"
              >
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
              >
                Open dashboard
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-zinc-500">
              {["GitHub OAuth or PAT", "Encrypted tokens", "Private artifacts", "Real workflow logs"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-[3rem] bg-emerald-500/10 blur-3xl" />
            <div className="relative rounded-[2.5rem] border border-zinc-800 bg-zinc-900/80 p-3 shadow-2xl backdrop-blur">
              <div className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950">
                <div className="flex items-center justify-between bg-zinc-950 px-5 py-3">
                  <span className="text-[10px] font-medium text-zinc-500">9:41</span>
                  <div className="flex gap-1">
                    <span className="h-1.5 w-3 rounded-full bg-zinc-700" />
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>
                </div>
                <div className="bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.25),transparent_55%)] px-6 pb-8 pt-10 text-center">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/15 text-emerald-300">
                    <Smartphone className="h-7 w-7" />
                  </span>
                  <p className="mt-4 text-lg font-bold text-white">Your App</p>
                  <p className="mt-1 text-[11px] text-zinc-500">example.com</p>
                  <div className="mx-auto mt-5 h-1.5 w-24 rounded-full bg-emerald-500/60" />
                </div>
                <div className="space-y-2.5 px-5 pb-5">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Github className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold text-zinc-200">Android build</p>
                        <p className="text-[9px] text-zinc-500">GitHub Actions · main</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
                        Completed
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Upload className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold text-zinc-200">app-release.apk</p>
                        <p className="text-[9px] text-zinc-500">Verified · private artifact</p>
                      </div>
                      <span className="text-[9px] font-semibold text-emerald-400">Download</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-800 text-zinc-400">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold text-zinc-200">Signed URLs</p>
                        <p className="text-[9px] text-zinc-500">expire after 5 minutes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-zinc-800/70 bg-zinc-950/60 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Built for real delivery</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">Everything needed to ship, nothing faked</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                The product is wired to Supabase, GitHub and private object storage. If a build fails, you see the real
                failure and the actual runner log.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-emerald-500/25 hover:bg-zinc-900/70"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/15">
                    <feature.icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-100">{feature.title}</h3>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">How it works</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">From URL to installable file</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Three steps. No hidden native project, no pretend build queue. Each stage maps to a real database or GitHub
                action.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Create your first app <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {STEPS.map((step) => (
                <div key={step.number} className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                  <span className="text-xs font-bold text-emerald-400">{step.number}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">{step.title}</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-zinc-800/70 bg-zinc-950/60 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Plan limits</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">Start free, upgrade when you ship</h2>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-zinc-500">
                Builds use your GitHub Actions minutes. Web2App Studio charges for project and build limits, not for the
                compilation itself.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { name: "Free", projects: "3", builds: "30", ios: "2", note: "Personal projects and pipeline testing." },
                { name: "Pro", projects: "25", builds: "500", ios: "100", note: "Studios shipping client apps monthly.", featured: true },
                { name: "Enterprise", projects: "500", builds: "5,000", ios: "1,000", note: "Agencies with large app portfolios." },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={
                    plan.featured
                      ? "relative rounded-xl border border-emerald-500/35 bg-emerald-500/[0.04] p-6"
                      : "rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
                  }
                >
                  {plan.featured && (
                    <span className="absolute right-5 top-5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Popular
                    </span>
                  )}
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  <p className="mt-1 text-[11px] text-zinc-500">{plan.note}</p>
                  <p className="mt-5 text-2xl font-extrabold text-white">
                    {plan.projects}
                    <span className="ml-1 text-xs font-medium text-zinc-500">projects</span>
                  </p>
                  <p className="text-xs text-zinc-400">
                    {plan.builds} builds / month · {plan.ios} iOS builds
                  </p>
                  <Link
                    href="/login"
                    className={
                      plan.featured
                        ? "mt-5 block rounded-lg bg-emerald-500 py-2 text-center text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                        : "mt-5 block rounded-lg border border-zinc-700 py-2 text-center text-xs font-semibold text-zinc-200 hover:border-zinc-500"
                    }
                  >
                    Get started
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-[11px] text-zinc-600">
              Limits are enforced server-side from the database. Online payment is not enabled yet — upgrades are handled
              through support.
            </p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white">Questions, answered honestly</h2>
          <div className="mt-8 space-y-3">
            {[
              {
                q: "Does this really produce an APK or IPA?",
                a: "Android debug APKs are produced by Gradle on GitHub Actions. Signed release APKs and AABs require your Android keystore secrets. iOS produces an unsigned archive by default; an installable IPA requires Apple signing secrets. The UI states which one you are getting.",
              },
              {
                q: "Where do my GitHub tokens go?",
                a: "They are encrypted with AES-256-GCM on the server, stored in a column that browser roles cannot read, and decrypted only inside server routes that call GitHub. They are never returned by an API response.",
              },
              {
                q: "Do I need Android Studio or Xcode?",
                a: "No. The generated project is compiled on GitHub-hosted runners. You can still download the source archive and open it locally if you want.",
              },
              {
                q: "What happens if a build fails?",
                a: "The status becomes failed, the real error and the tail of the GitHub Actions log are stored, and the build can be retried as a new build. Nothing is marked successful without a verified artifact.",
              },
              {
                q: "Can I use a public repository?",
                a: "Yes for debug builds. Push-notification projects must use a private repository so signing/Firebase configuration is not exposed. Release builds should always use a private repo.",
              },
            ].map((item) => (
              <details key={item.q} className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 open:border-emerald-500/20">
                <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-200 marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-emerald-400 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-zinc-950 p-8 text-center sm:p-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.18),transparent_60%)]" />
            <h2 className="relative text-2xl font-bold text-white sm:text-3xl">Your website is already an app.</h2>
            <p className="relative mx-auto mt-2 max-w-xl text-sm text-zinc-400">
              Add the native shell, compile it on GitHub, and ship a file you can install or upload to the stores.
            </p>
            <Link
              href="/login"
              className="relative mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Start building free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-zinc-800/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500 text-emerald-950">
              <Smartphone className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold text-zinc-300">Web2App Studio</span>
          </div>
          <p className="text-[11px] text-zinc-600">
            Built with Next.js, Supabase, Capacitor and GitHub Actions. Artifacts stay in private storage.
          </p>
          <div className="flex gap-4 text-[11px] text-zinc-500">
            <Link href="/login" className="hover:text-white">Sign in</Link>
            <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
