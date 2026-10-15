import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Empty } from "@/components/PageHeader";
import { errMsg, fmtDate } from "@/lib/format";
import { useMe } from "@/lib/auth";
import { EventCover } from "@/components/EventCover";

export const Route = createFileRoute("/_authenticated/dashboard/events")({ component: Browse });

function Browse() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["browse"],
    queryFn: async () => {
      const [ev, mine] = await Promise.all([
        supabase
          .from("events")
          .select("*")
          .eq("status", "published")
          .gte("ends_at", new Date().toISOString())
          .order("starts_at"),
        supabase.from("registrations").select("event_id,status"),
      ]);
      if (ev.error) throw ev.error;
      return {
        events: ev.data,
        mine: new Map((mine.data ?? []).map((r) => [r.event_id, r.status])),
      };
    },
  });
  const reg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("register_for_event", { _event_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registered — your ticket is in My tickets");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const isStudent = me?.roles.includes("student");

  return (
    <div className="max-w-5xl">
      <PageHeader title="Events" sub="Upcoming published events on campus." />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.events.length ? (
        <Empty>No upcoming events yet.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.events.map((e) => {
            const status = data.mine.get(e.id);
            const closed = new Date(e.registration_deadline) < new Date();
            return (
              <div key={e.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                <EventCover path={e.cover_url} className="aspect-[3/1]" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {e.category}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      cap {e.capacity}
                    </span>
                  </div>
                  <h3 className="mt-3 font-medium">{e.title}</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{e.description}</p>
                  <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                    <div>
                      {fmtDate(e.starts_at)} · {e.venue}
                    </div>
                    <div>Register by {fmtDate(e.registration_deadline)}</div>
                  </div>
                  <div className="mt-4">
                    {status === "registered" ? (
                      <Badge>Registered</Badge>
                    ) : !isStudent ? null : (
                      <Button
                        size="sm"
                        disabled={closed || reg.isPending}
                        onClick={() => reg.mutate(e.id)}
                      >
                        {closed ? "Registration closed" : "Register"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
