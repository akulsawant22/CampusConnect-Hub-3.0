import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Empty, Stat } from "@/components/PageHeader";
import { errMsg, fmtDate } from "@/lib/format";
import { useMe, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/admin")({ component: Admin });

const ROLES: AppRole[] = ["student", "organizer", "admin"];

function Admin() {
  const { data: me } = useMe();
  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!me.roles.includes("admin")) return <Empty>Admins only.</Empty>;
  return (
    <div className="max-w-6xl">
      <PageHeader title="Admin" sub="Campus-wide users, analytics and audit trail." />
      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics" className="mt-4">
          <Analytics />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <Users selfId={me?.id} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <Audit />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Analytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [ev, regs, att, certs, users] = await Promise.all([
        supabase
          .from("events")
          .select("id,title,status,starts_at")
          .order("starts_at", { ascending: false })
          .limit(12),
        supabase.from("registrations").select("event_id").eq("status", "registered"),
        supabase.from("attendance").select("event_id"),
        supabase.from("certificates").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const tally = (rows: { event_id: string }[] | null) =>
        (rows ?? []).reduce<Record<string, number>>(
          (m, r) => ((m[r.event_id] = (m[r.event_id] ?? 0) + 1), m),
          {},
        );
      const r = tally(regs.data),
        a = tally(att.data);
      return {
        chart: (ev.data ?? [])
          .slice()
          .reverse()
          .map((e) => ({
            name: e.title.slice(0, 18),
            Registered: r[e.id] ?? 0,
            Attended: a[e.id] ?? 0,
          })),
        totals: {
          events: ev.data?.length ?? 0,
          regs: regs.data?.length ?? 0,
          att: att.data?.length ?? 0,
          certs: certs.count ?? 0,
          users: users.count ?? 0,
        },
      };
    },
  });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const t = data.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Users" value={t.users} />
        <Stat label="Recent events" value={t.events} />
        <Stat label="Registrations" value={t.regs} />
        <Stat label="Check-ins" value={t.att} />
        <Stat label="Certificates" value={t.certs} />
      </div>
      <div className="h-80 rounded-xl border bg-card p-4">
        {!data.chart.length ? (
          <Empty>No events yet.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.chart}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Bar dataKey="Registered" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Attended" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Users({ selfId }: { selfId: string | undefined }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,email,created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const roles = new Map<string, AppRole[]>();
      (r.data ?? []).forEach((x) =>
        roles.set(x.user_id, [...(roles.get(x.user_id) ?? []), x.role]),
      );
      return (p.data ?? []).map((u) => ({ ...u, roles: roles.get(u.id) ?? [] }));
    },
  });
  const toggle = useMutation({
    mutationFn: async (v: { id: string; role: AppRole; grant: boolean }) => {
      const { error } = await supabase.rpc("set_user_role", {
        _user_id: v.id,
        _role: v.role,
        _grant: v.grant,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = (data ?? []).filter(
    (u) => !q || `${u.full_name} ${u.email}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <Input
        className="max-w-xs"
        placeholder="Search name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="divide-y rounded-xl border bg-card">
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div>
              <div>{u.full_name || "—"}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </div>
            <div className="flex gap-4">
              {ROLES.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 text-xs capitalize text-muted-foreground"
                >
                  <Switch
                    disabled={u.id === selfId || toggle.isPending}
                    checked={u.roles.includes(role)}
                    onCheckedChange={(c) => toggle.mutate({ id: u.id, role, grant: c })}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        You can't change your own roles. Assign volunteers from an event's Volunteers tab.
      </p>
    </div>
  );
}

function Audit() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () =>
      (
        await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      ).data ?? [],
  });
  if (!data?.length) return <Empty>No audit entries yet.</Empty>;
  return (
    <div className="divide-y rounded-xl border bg-card font-mono text-xs">
      {data.map((a) => (
        <div key={a.id} className="flex flex-wrap gap-x-4 p-3">
          <span className="text-muted-foreground">{fmtDate(a.created_at)}</span>
          <span className="text-primary">{a.action}</span>
          <span className="text-muted-foreground">{a.actor_id?.slice(0, 8)}</span>
          <span className="truncate text-muted-foreground">{JSON.stringify(a.metadata)}</span>
        </div>
      ))}
    </div>
  );
}
