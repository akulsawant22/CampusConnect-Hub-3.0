import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { Stat } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { isStaff, roleLabel } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Overview,
});

function Card({ title, to, desc }: { title: string; to: string; desc: string }) {
  return (
    <Link to={to} className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

function Overview() {
  const { data: me, isLoading } = useMe();
  const { data: counts } = useQuery({
    queryKey: ["overview", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const [r, c, n] = await Promise.all([
        supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", me!.id)
          .eq("status", "registered"),
        supabase
          .from("certificates")
          .select("id", { count: "exact", head: true })
          .eq("user_id", me!.id),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null),
      ]);
      if (r.error) throw r.error;
      if (c.error) throw c.error;
      if (n.error) throw n.error;
      return { regs: r.count ?? 0, certs: c.count ?? 0, unread: n.count ?? 0 };
    },
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!me)
    return (
      <div role="alert" className="text-sm text-destructive">
        Your account couldn't be loaded. Refresh or sign in again.
      </div>
    );
  const has = (r: string) => me.roles.includes(r as never);
  const staff = isStaff(me.roles);
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hi{me.fullName ? `, ${me.fullName}` : ""}
          </h1>
          <Badge>{roleLabel(me.roles)}</Badge>
          {me.volunteerEventCount > 0 && <Badge variant="outline">Volunteer</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Your workspace adapts to your roles.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Active registrations" value={counts?.regs ?? "—"} />
        <Stat label="Certificates" value={counts?.certs ?? "—"} />
        <Stat label="Unread notifications" value={counts?.unread ?? "—"} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="Browse events"
          to="/dashboard/events"
          desc="Find and register for upcoming events."
        />
        {has("student") && (
          <Card
            title="My tickets"
            to="/dashboard/tickets"
            desc="QR tickets, certificates and feedback."
          />
        )}
        <Card
          title="Notifications"
          to="/dashboard/notifications"
          desc="Updates about your events."
        />
        {me.volunteerEventCount > 0 && (
          <Card
            title="Volunteer"
            to="/dashboard/volunteer"
            desc={`${me.volunteerEventCount} assigned event(s) · scan tickets`}
          />
        )}
        {staff && (
          <Card
            title="Manage events"
            to="/dashboard/manage"
            desc="Create, publish, track attendance, issue certificates."
          />
        )}
        {has("admin") && (
          <Card title="Admin" to="/dashboard/admin" desc="Roles, analytics and audit log." />
        )}
      </div>
      {!staff && (
        <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Looking for Admin or Manage events?</p>
          <p className="mt-1">
            Staff features appear here once the college administrator grants your account Organizer
            or Admin access. Volunteer tools appear when you're assigned to an event.
          </p>
        </div>
      )}
    </div>
  );
}
