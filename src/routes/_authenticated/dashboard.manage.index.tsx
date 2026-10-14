import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, Empty } from "@/components/PageHeader";
import { EventForm, type EventInput } from "@/components/EventForm";
import { errMsg, fmtDate } from "@/lib/format";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard/manage/")({ component: Manage });

function Manage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isAdmin = me?.roles.includes("admin");
  const canCreate = isAdmin || me?.roles.includes("organizer");
  const { data, isLoading } = useQuery({
    queryKey: ["manage-events", me?.id, isAdmin],
    enabled: !!me,
    queryFn: async () => {
      let q = supabase.from("events").select("id,title,status,starts_at,capacity,registrations(count)").order("starts_at", { ascending: false });
      if (!isAdmin) q = q.eq("organizer_id", me!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const create = useMutation({
    mutationFn: async (v: EventInput) => {
      const { data, error } = await supabase.from("events").insert({ ...v, organizer_id: me!.id }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => { toast.success("Draft created"); setOpen(false); navigate({ to: "/dashboard/manage/$eventId", params: { eventId: id } }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!canCreate) return <Empty>Only organizers and admins can manage events.</Empty>;
  return (
    <div className="max-w-5xl">
      <PageHeader title={isAdmin ? "All events" : "My events"} sub="Drafts are private until published."
        action={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm">New event</Button></DialogTrigger>
          <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader><EventForm busy={create.isPending} onSubmit={(v) => create.mutate(v)} /></DialogContent></Dialog>} />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data?.length ? <Empty>No events yet. Create your first one.</Empty> : (
        <div className="divide-y rounded-xl border bg-card">
          {data.map((e) => (
            <Link key={e.id} to="/dashboard/manage/$eventId" params={{ eventId: e.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-accent">
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(e.starts_at)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{e.registrations?.[0]?.count ?? 0}/{e.capacity}</span>
                <Badge variant={e.status === "published" ? "default" : "secondary"} className="capitalize">{e.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}