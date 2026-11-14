"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  ShieldOff,
  UserCog,
  Users,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Checkbox,
  useToast,
} from "@/components/ui";
import { apiFetch, formatDate } from "@/lib/client";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  github_username: string | null;
  role: "user" | "admin";
  suspended: boolean;
  created_at: string;
  subscription: { plan: string; status: string };
  project_count: number;
  build_count: number;
  running_builds: number;
  failed_builds: number;
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<"user" | "admin">("user");
  const [plan, setPlan] = useState<"free" | "pro" | "enterprise">("free");
  const [suspended, setSuspended] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (targetPage: number, term: string) => {
    setError("");
    try {
      const data = await apiFetch<{ users: AdminUser[]; total: number; perPage: number }>(
        `/api/admin/users?page=${targetPage}&search=${encodeURIComponent(term)}`
      );
      setUsers(data.users);
      setTotal(data.total);
      setPerPage(data.perPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    }
  }, []);

  useEffect(() => {
    load(page, query);
  }, [load, page, query]);

  function edit(user: AdminUser) {
    setEditing(user);
    setRole(user.role);
    setPlan((user.subscription.plan as "free" | "pro" | "enterprise") ?? "free");
    setSuspended(user.suspended);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const data = await apiFetch<{ user: AdminUser }>("/api/admin/users", {
        method: "PATCH",
        json: { userId: editing.id, role, plan, suspended },
      });
      setUsers((rows) =>
        (rows ?? []).map((row) =>
          row.id === editing.id
            ? { ...row, role: data.user.role, suspended: data.user.suspended, subscription: { ...row.subscription, plan } }
            : row
        )
      );
      toast("User updated.", "success");
      setEditing(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update the user", "error");
    } finally {
      setSaving(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Suspend accounts, grant admin access and change plan limits. Every change is authenticated server-side."
        actions={<Badge tone="purple"><Users className="h-3 w-3" /> {total} users</Badge>}
      />

      {error && <Alert tone="error" className="mb-5" title="Could not load users">{error}</Alert>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
        className="mb-5 flex gap-2"
      >
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search email, name or GitHub username…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
        {query && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setQuery("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {!users ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try a different search term." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-zinc-800/70">
            {users.map((user) => (
              <div key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-400">
                    {(user.full_name ?? user.email ?? "U")[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-zinc-200">{user.full_name || user.email}</p>
                      {user.role === "admin" && <Badge tone="purple">admin</Badge>}
                      {user.suspended && <Badge tone="red">suspended</Badge>}
                      <Badge tone="neutral">{user.subscription.plan}</Badge>
                    </div>
                    <p className="truncate text-[11px] text-zinc-500">
                      {user.email}
                      {user.github_username ? ` · @${user.github_username}` : ""} · joined {formatDate(user.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-12 text-[10px] text-zinc-500 sm:pl-0">
                  <span>{user.project_count} projects</span>
                  <span>{user.build_count} builds</span>
                  {user.running_builds > 0 && <Badge tone="amber">{user.running_builds} running</Badge>}
                  {user.failed_builds > 0 && <Badge tone="red">{user.failed_builds} failed</Badge>}
                  <Button variant="outline" size="sm" onClick={() => edit(user)}>
                    <UserCog className="h-3.5 w-3.5" /> Manage
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
            <p className="text-[11px] text-zinc-500">Page {page} of {pages} · {total} total</p>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Manage ${editing.full_name || editing.email}` : "Manage user"}
        description="Changes take effect immediately. You cannot suspend or demote your own admin account."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Role" htmlFor="user-role">
            <Select id="user-role" value={role} onChange={(event) => setRole(event.target.value as "user" | "admin")}>
              <option value="user">User</option>
              <option value="admin">Administrator</option>
            </Select>
          </Field>
          <Field label="Plan" htmlFor="user-plan">
            <Select id="user-plan" value={plan} onChange={(event) => setPlan(event.target.value as "free" | "pro" | "enterprise")}>
              <option value="free">Free — 3 projects / 30 builds</option>
              <option value="pro">Pro — 25 projects / 500 builds</option>
              <option value="enterprise">Enterprise — 500 projects / 5000 builds</option>
            </Select>
          </Field>
          <Checkbox
            label={suspended ? "Account suspended" : "Account active"}
            description="Suspended users cannot use the API or dashboard. Their data is preserved."
            checked={suspended}
            onChange={setSuspended}
          />
          {editing?.role === "admin" && (
            <Alert tone="warning" title="Admin account">
              Administrators can manage every user and platform setting. Only grant this to trusted staff.
            </Alert>
          )}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            {suspended ? <ShieldOff className="h-3.5 w-3.5 text-red-400" /> : <Shield className="h-3.5 w-3.5 text-emerald-400" />}
            {suspended ? "Sign-in is blocked by the API." : "Account can sign in and build."}
          </div>
        </div>
      </Modal>
    </div>
  );
}
