import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Empty } from "@/components/PageHeader";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({ component: Notifications });

export const notificationsQuery = {
  queryKey: ["notifications"],
  queryFn: async () => {
    const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data;
  },
};

function Notifications() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(notificationsQuery);
  const markAll = useMutation({
    mutationFn: async () => { await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" action={<Button size="sm" variant="secondary" onClick={() => markAll.mutate()}>Mark all read</Button>} />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data?.length ? <Empty>No notifications.</Empty> : (
        <div className="divide-y rounded-xl border bg-card">
          {data.map((n) => (
            <div key={n.id} className="flex gap-3 p-4">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-muted" : "bg-primary"}`} />
              <div>
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{fmtDate(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}