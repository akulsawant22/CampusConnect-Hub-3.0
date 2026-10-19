import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Empty } from "@/components/PageHeader";
import { errMsg, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/volunteer")({
  component: Volunteer,
});

function Volunteer() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["my-staff"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) return [];
      const { data, error } = await supabase
        .from("event_staff")
        .select(
          "id, event_id, can_scan, can_view_registrations, can_view_attendance, events(title, starts_at, venue)",
        )
        .eq("user_id", u.user.id);
      if (error) throw error;
      const ids = (data ?? []).map((d) => d.event_id);
      if (ids.length === 0) return [];
      const [regs, att] = await Promise.all([
        supabase
          .from("registrations")
          .select("event_id")
          .in("event_id", ids)
          .eq("status", "registered")
          .limit(500),
        supabase.from("attendance").select("event_id").in("event_id", ids).limit(500),
      ]);
      if (regs.error) throw regs.error;
      if (att.error) throw att.error;
      const count = (rows: { event_id: string }[] | null, id: string) =>
        (rows ?? []).filter((r) => r.event_id === id).length;
      return (data ?? []).map((d) => ({
        ...d,
        regs: count(regs.data, d.event_id),
        att: count(att.data, d.event_id),
      }));
    },
  });
  return (
    <div className="max-w-4xl">
      <PageHeader title="Volunteer workspace" sub="Events you've been assigned to help with." />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center"
        >
          <h2 className="font-semibold text-destructive">Failed to load volunteer assignments</h2>
          <p className="mt-1 text-sm text-muted-foreground">{errMsg(error)}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !data?.length ? (
        <Empty>You have no volunteer assignments.</Empty>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {data.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">{s.events?.title}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(s.events?.starts_at)} · {s.events?.venue}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {s.can_view_registrations && `${s.regs} registered `}
                  {s.can_view_attendance && `· ${s.att} checked in`}
                </div>
              </div>
              {s.can_scan && (
                <Button size="sm" asChild>
                  <Link to="/dashboard/scan/$eventId" params={{ eventId: s.event_id }}>
                    Open scanner
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
