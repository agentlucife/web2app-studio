"use client";

import { useEffect, useState } from "react";
import { Inbox, LifeBuoy, Mail, MessageSquarePlus, Send } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { apiFetch, formatDate, relativeTime } from "@/lib/client";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "closed";
  created_at: string;
  updated_at: string;
};

export function SupportClient({ initialSubject }: { initialSubject: string }) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [supportEmail, setSupportEmail] = useState("support@web2app.studio");
  const [error, setError] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{ tickets: Ticket[]; supportEmail: string }>("/api/support");
      setTickets(data.tickets);
      setSupportEmail(data.supportEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load support tickets");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      await apiFetch("/api/support", { method: "POST", json: { subject, message } });
      toast("Support ticket created. An admin will review it.", "success");
      setSubject("");
      setMessage("");
      setOpen(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create the ticket", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Help"
        title="Support"
        description="Open a ticket for build failures, configuration questions or plan upgrades."
        actions={
          <Button onClick={() => setOpen((value) => !value)}>
            <MessageSquarePlus className="h-4 w-4" /> New ticket
          </Button>
        }
      />

      {error && <Alert tone="error" className="mb-5" title="Could not load tickets">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(open || initialSubject) && (
            <Card>
              <CardHeader title="Open a support ticket" description="Include the build ID for build-specific issues." icon={MessageSquarePlus} />
              <form onSubmit={submit} className="space-y-4 p-5">
                <Field label="Subject" htmlFor="ticket-subject" required>
                  <Input
                    id="ticket-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="e.g. Android release build failed"
                    maxLength={140}
                    required
                  />
                </Field>
                <Field label="Message" htmlFor="ticket-message" hint={`${message.length}/4000`} required>
                  <Textarea
                    id="ticket-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="What happened, what did you expect, and what have you tried?"
                    maxLength={4000}
                    className="min-h-32"
                    required
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" loading={sending} disabled={!subject.trim() || message.trim().length < 10}>
                    <Send className="h-4 w-4" /> Send ticket
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card>
            <CardHeader title="Your tickets" description="Newest first." icon={Inbox} />
            {!tickets ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={LifeBuoy}
                  title="No support tickets"
                  description="You have not opened a ticket yet. Build errors usually include the exact GitHub Actions message in the build logs."
                  action={
                    <Button size="sm" onClick={() => setOpen(true)}>
                      Open a ticket
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-200">{ticket.subject}</p>
                      <Badge tone={ticket.status === "closed" ? "neutral" : ticket.status === "in_progress" ? "blue" : "amber"}>
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-500">{ticket.message}</p>
                    <p className="mt-2 text-[10px] text-zinc-600">
                      Opened {formatDate(ticket.created_at)} · updated {relativeTime(ticket.updated_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Mail className="h-4 w-4 text-emerald-400" /> Email
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Prefer email? Write to the platform support address.
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="mt-3 inline-flex items-center gap-1 break-all text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              {supportEmail}
            </a>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-zinc-200">Before you open a ticket</p>
            <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-zinc-500">
              <li>1. Open the build and read the log tail — it includes the real Gradle/Xcode error.</li>
              <li>2. Check the GitHub run link on the build page.</li>
              <li>3. Confirm the repository has the required signing secrets for release/IPA builds.</li>
              <li>4. Make sure the connected token still has repo/workflow permissions.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
