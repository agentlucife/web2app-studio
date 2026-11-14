"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CreditCard,
  Gauge,
  Hammer,
  Mail,
  Sparkles,
  Smartphone,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { apiFetch, formatDate } from "@/lib/client";

type Billing = {
  plan: "free" | "pro" | "enterprise";
  status: string;
  currentPeriodEnd: string | null;
  limits: { projects: number; buildsPerMonth: number; maxIos: number };
  usage: {
    projects: number;
    buildsThisMonth: number;
    iosBuildsThisMonth: number;
    artifacts: number;
  };
  plans: Record<
    "free" | "pro" | "enterprise",
    { projects: number; buildsPerMonth: number; maxIos: number }
  >;
};

const PLAN_DETAILS = {
  free: {
    name: "Free",
    blurb: "For personal projects and testing the pipeline.",
    features: ["Debug and signed builds", "GitHub Actions only", "Private artifacts"],
  },
  pro: {
    name: "Pro",
    blurb: "For studios shipping client apps every month.",
    features: ["Higher project and build limits", "Priority support", "More iOS builds"],
  },
  enterprise: {
    name: "Enterprise",
    blurb: "For agencies with many apps and compliance needs.",
    features: ["Large limits", "Dedicated support channel", "Custom onboarding"],
  },
} as const;

export default function BillingPage() {
  const [data, setData] = useState<Billing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Billing>("/api/billing")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load billing"));
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Plan & usage"
        title="Billing"
        description="Transparent limits, real usage from the database. Online payments are not enabled yet — upgrades are handled through support."
      />

      {error && <Alert tone="error" className="mb-5" title="Could not load billing">{error}</Alert>}

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-44" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <Card className="mb-6 overflow-hidden">
            <div className="grid gap-6 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Current plan</p>
                <p className="mt-1 text-2xl font-bold capitalize text-white">{data.plan}</p>
                <Badge tone={data.status === "active" ? "green" : "amber"} className="mt-1.5">
                  {data.status.replace("_", " ")}
                </Badge>
              </div>
              <Usage
                label="Projects"
                used={data.usage.projects}
                limit={data.limits.projects}
                icon={Smartphone}
              />
              <Usage
                label="Builds this month"
                used={data.usage.buildsThisMonth}
                limit={data.limits.buildsPerMonth}
                icon={Hammer}
              />
              <Usage
                label="iOS builds this month"
                used={data.usage.iosBuildsThisMonth}
                limit={data.limits.maxIos}
                icon={Gauge}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-5 py-3 text-[11px] text-zinc-500">
              <span>
                {data.currentPeriodEnd
                  ? `Current period ends ${formatDate(data.currentPeriodEnd)}`
                  : "No renewal date — free plans do not expire."}
              </span>
              <span>{data.usage.artifacts} stored artifact{data.usage.artifacts === 1 ? "" : "s"}</span>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {(Object.keys(PLAN_DETAILS) as Array<keyof typeof PLAN_DETAILS>).map((planId) => {
              const details = PLAN_DETAILS[planId];
              const limits = data.plans[planId];
              const current = data.plan === planId;
              return (
                <Card
                  key={planId}
                  className={
                    current
                      ? "relative border-emerald-500/40 bg-emerald-500/[0.03] p-5"
                      : "relative p-5"
                  }
                >
                  {current && (
                    <span className="absolute right-4 top-4">
                      <Badge tone="green">Current</Badge>
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {planId === "free" ? (
                      <CreditCard className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <Sparkles className={planId === "pro" ? "h-4 w-4 text-emerald-400" : "h-4 w-4 text-violet-400"} />
                    )}
                    <h2 className="text-base font-bold text-white">{details.name}</h2>
                  </div>
                  <p className="mt-1 min-h-8 text-[11px] leading-relaxed text-zinc-500">{details.blurb}</p>
                  <ul className="mt-4 space-y-1.5 text-[11px] text-zinc-400">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> {limits.projects} projects
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> {limits.buildsPerMonth} builds / month
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> {limits.maxIos} iOS builds / month
                    </li>
                    {details.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {current ? (
                      <Button variant="outline" className="w-full" disabled>
                        Your current plan
                      </Button>
                    ) : (
                      <Link
                        href={`/dashboard/support?subject=${encodeURIComponent(`Upgrade to ${details.name}`)}`}
                        className="block"
                      >
                        <Button variant={planId === "pro" ? "primary" : "outline"} className="w-full">
                          <Mail className="h-4 w-4" /> Request {details.name}
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="mt-6">
            <CardHeader
              title="How upgrades work today"
              description="No card details are collected by this deployment."
              icon={CreditCard}
            />
            <div className="space-y-3 p-5 text-xs leading-relaxed text-zinc-400">
              <p>
                Open a support ticket with the plan you need. An administrator updates the subscription in the admin
                dashboard after confirming payment out of band. Your limits change immediately — build usage is counted from
                the database.
              </p>
              <Alert tone="info">
                This keeps the product honest: there is no fake checkout and no payment provider pretending to charge you.
                Connect Stripe later if you want self-serve billing.
              </Alert>
              <Link
                href="/dashboard/support"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Contact support <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Usage({
  label,
  used,
  limit,
  icon: Icon,
}: {
  label: string;
  used: number;
  limit: number;
  icon: typeof Gauge;
}) {
  const percent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          <Icon className="h-3 w-3" /> {label}
        </p>
        <span className="text-[10px] text-zinc-500">
          {used}/{limit}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={percent > 90 ? "h-full rounded-full bg-red-400" : "h-full rounded-full bg-emerald-500"}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-zinc-600">{percent}% used</p>
    </div>
  );
}
