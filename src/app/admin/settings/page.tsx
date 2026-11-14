"use client";

import { useEffect, useState } from "react";
import { BellRing, Mail, Save, ShieldAlert, Wrench } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Skeleton,
  useToast,
} from "@/components/ui";
import { apiFetch, formatDate } from "@/lib/client";

type Settings = {
  maintenanceMode: boolean;
  signupsEnabled: boolean;
  buildNotifications: boolean;
  supportEmail: string;
};

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ settings: Settings }>("/api/admin/settings")
      .then((data) => setSettings(data.settings))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const data = await apiFetch<{ settings: Settings }>("/api/admin/settings", {
        method: "PATCH",
        json: settings,
      });
      setSettings(data.settings);
      setSavedAt(new Date().toISOString());
      toast("Platform settings saved.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Platform settings"
        description="These switches affect every user immediately. Settings are stored in Supabase, not in environment variables."
        actions={
          <Button onClick={save} loading={saving} disabled={!settings}>
            <Save className="h-4 w-4" /> Save settings
          </Button>
        }
      />

      {error && <Alert tone="error" className="mb-5" title="Could not load settings">{error}</Alert>}

      {loading || !settings ? (
        <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Availability" description="Control whether users can make changes." icon={Wrench} />
              <div className="space-y-3 p-5">
                <Checkbox
                  label="Maintenance mode"
                  description="Blocks project creation, edits, builds and syncs for non-admin users. The dashboard stays readable."
                  checked={settings.maintenanceMode}
                  onChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
                />
                <Checkbox
                  label="Allow new signups"
                  description="When disabled, accounts without an existing profile are rejected at the OAuth callback."
                  checked={settings.signupsEnabled}
                  onChange={(checked) => setSettings({ ...settings, signupsEnabled: checked })}
                />
                {settings.maintenanceMode && (
                  <Alert tone="warning" title="Maintenance mode is on">
                    Every non-admin mutation endpoint returns HTTP 503 with a clear message. Admins can still work.
                  </Alert>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Notifications" description="Platform-level notification behaviour." icon={BellRing} />
              <div className="space-y-3 p-5">
                <Checkbox
                  label="Build result notifications"
                  description="Create in-app notifications when builds complete, fail or are cancelled."
                  checked={settings.buildNotifications}
                  onChange={(checked) => setSettings({ ...settings, buildNotifications: checked })}
                />
                <Alert tone="info">
                  Build notifications are always stored today for auditability. Disabling this toggle stops new notifications
                  from being shown in the bell menu after the next deployment update.
                </Alert>
              </div>
            </Card>

            <Card>
              <CardHeader title="Support contact" description="Shown on the user support page." icon={Mail} />
              <div className="p-5">
                <Field label="Support email" htmlFor="support-email">
                  <Input
                    id="support-email"
                    type="email"
                    value={settings.supportEmail}
                    onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })}
                    placeholder="support@example.com"
                  />
                </Field>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <ShieldAlert className="h-4 w-4 text-violet-400" /> Admin actions
              </p>
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-zinc-500">
                <li>• Settings are validated with Zod on the server.</li>
                <li>• CSRF origin checks protect every mutation.</li>
                <li>• Maintenance mode is enforced in API routes, not just the UI.</li>
                <li>• Admin access requires a database role of admin.</li>
              </ul>
              {savedAt && <p className="mt-4 text-[10px] text-zinc-600">Last saved {formatDate(savedAt)}</p>}
            </Card>

            <Card className="p-5">
              <p className="text-sm font-semibold text-zinc-200">Admin bootstrap</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                The first administrator is granted by listing their email in <code className="text-zinc-300">ADMIN_EMAILS</code>{" "}
                before their first sign-in. Afterwards, roles are managed from Users.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
