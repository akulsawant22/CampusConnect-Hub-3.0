import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Empty } from "@/components/PageHeader";
import { errMsg, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({
  component: Notifications,
});

export const notificationsQuery = {
  queryKey: ["notifications"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  },
};

function Notifications() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery(notificationsQuery);
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        action={
          <Button
            size="sm"
            variant="secondary"
            disabled={markAll.isPending || !data?.some((n) => !n.read_at)}
            aria-busy={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {markAll.isPending ? "Marking…" : "Mark all read"}
          </Button>
        }
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center"
        >
          <h2 className="font-semibold text-destructive">Failed to load notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">{errMsg(error)}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !data?.length ? (
        <Empty>No notifications.</Empty>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {data.map((n) => (
            <div key={n.id} className="flex gap-3 p-4">
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-muted" : "bg-primary"}`}
              />
              <div>
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {fmtDate(n.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
