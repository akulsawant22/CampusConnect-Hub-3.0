import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Empty, Stat } from "@/components/PageHeader";
import { EventForm, type EventInput } from "@/components/EventForm";
import { CoverUploader } from "@/components/EventCover";
import { errMsg, fmtDate } from "@/lib/format";
import { useMe } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["event_status"];

export const Route = createFileRoute("/_authenticated/dashboard/manage/$eventId")({
  component: EventAdmin,
});

function EventAdmin() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const isAdmin = me?.roles.includes("admin");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["event-admin", eventId],
    queryFn: async () => {
      const [ev, regs, att, fb, stats] = await Promise.all([
        supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
        supabase
          .from("registrations")
          .select("id,status,created_at,user_id,profiles(full_name,email)")
          .eq("event_id", eventId)
          .order("created_at")
          .limit(500),
        supabase.from("attendance").select("registration_id,checked_in_at").eq("event_id", eventId),
        supabase
          .from("feedback")
          .select("rating,comment,created_at")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.rpc("event_stats", { _event_id: eventId }),
      ]);
      if (ev.error) throw ev.error;
      if (regs.error) throw regs.error;
      if (att.error) throw att.error;
      if (fb.error) throw fb.error;
      if (stats.error) throw stats.error;
      return {
        ev: ev.data,
        regs: regs.data ?? [],
        att: new Map((att.data ?? []).map((a) => [a.registration_id, a.checked_in_at])),
        fb: fb.data ?? [],
        stats: stats.data as {
          registered?: number;
          attended?: number;
          certificates?: number;
          avg_rating?: number | null;
        } | null,
      };
    },
  });
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["event-admin", eventId] });
    qc.invalidateQueries({ queryKey: ["manage-events"] });
    qc.invalidateQueries({ queryKey: ["browse"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  };
  const update = useMutation({
    mutationFn: async (patch: Partial<EventInput> & { status?: Status }) => {
      const { error } = await supabase.from("events").update(patch).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      inv();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted");
      inv();
      navigate({ to: "/dashboard/manage" });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const certs = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("issue_certificates", { _event_id: eventId });
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      toast.success(`${n} new certificate(s) issued`);
      inv();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center"
      >
        <h2 className="font-semibold text-destructive">Couldn't load event</h2>
        <p className="mt-1 text-sm text-muted-foreground">{errMsg(error)}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data?.ev) return <Empty>Event not found or you don't have access.</Empty>;
  const ev = data.ev;
  const s = data.stats ?? {};

  return (
    <div className="max-w-5xl">
      <Link to="/dashboard/manage" className="text-xs text-muted-foreground hover:text-foreground">
        ← Events
      </Link>
      <PageHeader
        title={ev.title}
        sub={`${fmtDate(ev.starts_at)} · ${ev.venue}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {ev.status}
            </Badge>
            {ev.status === "draft" && (
              <Button
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate({ status: "published" })}
              >
                Publish
              </Button>
            )}
            {ev.status === "published" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={update.isPending}
                onClick={() => update.mutate({ status: "completed" })}
              >
                Mark completed
              </Button>
            )}
            {ev.status !== "cancelled" && ev.status !== "completed" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={update.isPending}
                onClick={() => update.mutate({ status: "cancelled" })}
              >
                Cancel event
              </Button>
            )}
            {ev.status === "draft" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={del.isPending}
                onClick={() => del.mutate()}
              >
                Delete
              </Button>
            )}
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered" value={`${s.registered ?? 0}/${ev.capacity}`} />
        <Stat label="Checked in" value={s.attended ?? 0} />
        <Stat label="Certificates" value={s.certificates ?? 0} />
        <Stat label="Avg rating" value={s.avg_rating ?? "—"} />
      </div>
      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">Registrations</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" asChild>
              <Link to="/dashboard/scan/$eventId" params={{ eventId }}>
                Open scanner
              </Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={certs.isPending}
              onClick={() => certs.mutate()}
            >
              Issue certificates to attendees
            </Button>
          </div>
          {!data.regs.length ? (
            <Empty>No registrations yet.</Empty>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {data.regs.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <div>{r.profiles?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.profiles?.email}</div>
                  </div>
                  {r.status === "cancelled" ? (
                    <Badge variant="outline">Cancelled</Badge>
                  ) : data.att.get(r.id) ? (
                    <Badge>In · {new Date(data.att.get(r.id)!).toLocaleTimeString()}</Badge>
                  ) : (
                    <Badge variant="secondary">Registered</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="details" className="mt-4 rounded-xl border bg-card p-5">
          <div className="mb-5">
            <CoverUploader eventId={eventId} path={ev.cover_url} />
          </div>
          <EventForm
            initial={ev}
            busy={update.isPending}
            currentRegisteredCount={data.regs.filter((r) => r.status === "registered").length}
            onSubmit={(v) => update.mutate(v)}
          />
        </TabsContent>
        <TabsContent value="volunteers" className="mt-4">
          <Volunteers eventId={eventId} isAdmin={!!isAdmin} />
        </TabsContent>
        <TabsContent value="feedback" className="mt-4">
          {!data.fb.length ? (
            <Empty>No feedback yet.</Empty>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {data.fb.map((f, i) => (
                <div key={i} className="p-3 text-sm">
                  <span className="font-mono text-primary">{f.rating}/5</span>{" "}
                  <span className="text-muted-foreground">{f.comment}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Volunteers({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [perm, setPerm] = useState({ scan: true, regs: false, att: false });
  const { data: staff } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_staff")
        .select(
          "user_id,can_scan,can_view_registrations,can_view_attendance,profiles!event_staff_user_id_fkey(full_name,email)",
        )
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });
  const assign = useMutation({
    mutationFn: async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();
      if (!p) throw new Error("No user with that email");
      const { error } = await supabase.rpc("assign_volunteer", {
        _event_id: eventId,
        _user_id: p.id,
        _can_scan: perm.scan,
        _can_view_registrations: perm.regs,
        _can_view_attendance: perm.att,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Volunteer assigned");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["staff", eventId] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase.rpc("remove_volunteer", {
        _event_id: eventId,
        _user_id: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", eventId] }),
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="space-y-4">
      {isAdmin ? (
        <form
          className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            assign.mutate();
          }}
        >
          <Input
            className="max-w-xs"
            type="email"
            required
            placeholder="Student email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {(
            [
              ["scan", "Scan tickets"],
              ["regs", "View registrations"],
              ["att", "View attendance"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox checked={perm[k]} onCheckedChange={(c) => setPerm({ ...perm, [k]: !!c })} />
              {l}
            </label>
          ))}
          <Button size="sm" disabled={assign.isPending}>
            Assign
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Only admins can assign volunteers.</p>
      )}
      {!staff?.length ? (
        <Empty>No volunteers assigned.</Empty>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {staff.map((s) => (
            <div key={s.user_id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div>{s.profiles?.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{s.profiles?.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {[
                    s.can_scan && "scan",
                    s.can_view_registrations && "registrations",
                    s.can_view_attendance && "attendance",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(s.user_id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
