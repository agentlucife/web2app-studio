"use client";

import { useEffect, useMemo, useState } from "react";
import { Inbox, LifeBuoy, Mail, RefreshCw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  cn,
  useToast,
} from "@/components/ui";
import { apiFetch, formatDate, relativeTime } from "@/lib/client";

type Ticket = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "closed";
  created_at: string;
  updated_at: string;
};

const FILTERS = ["all", "open", "in_progress", "closed"] as const;

export default function AdminSupportPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("open");
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ tickets: Ticket[] }>("/api/admin/support");
      setTickets(data.tickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load support tickets");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const rows = tickets ?? [];
    if (filter === "all") return rows;
    return rows.filter((ticket) => ticket.status === filter);
  }, [tickets, filter]);

  async function updateStatus(ticket: Ticket, status: Ticket["status"]) {
    setUpdating(ticket.id);
    try {
      await apiFetch("/api/admin/support", { method: "PATCH", json: { id: ticket.id, status } });
      setTickets((rows) => (rows ?? []).map((row) => (row.id === ticket.id ? { ...row, status } : row)));
      toast("Ticket status updated.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update the ticket", "error");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Support inbox"
        description="Every ticket opened by users. Update the status as you work through them."
        actions={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />

      {error && <Alert tone="error" className="mb-5" title="Could not load tickets">{error}</Alert>}

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((value) => {
          const count = value === "all" ? tickets?.length ?? 0 : (tickets ?? []).filter((ticket) => ticket.status === value).length;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                filter === value
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200"
              )}
            >
              {value.replace("_", " ")}
              <span className="rounded-full bg-black/20 px-1.5 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>

      {!tickets ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="No tickets in this view" description="Change the filter or wait for new support requests." />
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <Card key={ticket.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-100">{ticket.subject}</h2>
                    <Badge tone={ticket.status === "open" ? "amber" : ticket.status === "in_progress" ? "blue" : "neutral"}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {ticket.user_name || "Unnamed user"} · {ticket.user_email ?? ticket.user_id} · opened{" "}
                    {formatDate(ticket.created_at)} ({relativeTime(ticket.created_at)})
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{ticket.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-600">
                    <span className="inline-flex items-center gap-1"><LifeBuoy className="h-3 w-3" /> Ticket {ticket.id.slice(0, 8)}</span>
                    {ticket.user_email && (
                      <a href={`mailto:${ticket.user_email}?subject=Re: ${encodeURIComponent(ticket.subject)}`} className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300">
                        <Mail className="h-3 w-3" /> Reply by email
                      </a>
                    )}
                  </div>
                </div>
                <div className="w-full shrink-0 sm:w-44">
                  <Select
                    value={ticket.status}
                    disabled={updating === ticket.id}
                    onChange={(event) => updateStatus(ticket, event.target.value as Ticket["status"])}
                    className="text-xs"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="closed">Closed</option>
                  </Select>
                  <p className="mt-1 text-[10px] text-zinc-600">Updated {relativeTime(ticket.updated_at)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
