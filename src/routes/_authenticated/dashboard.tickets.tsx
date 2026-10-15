import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader, Empty } from "@/components/PageHeader";
import { errMsg, fmtDate } from "@/lib/format";
import { useMe } from "@/lib/auth";
import { downloadCertificate } from "@/lib/certificate";
import { validateFeedback } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/dashboard/tickets")({ component: Tickets });

function Qr({ token }: { token: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    import("qrcode").then((q) => q.toDataURL(token, { margin: 1, width: 280 }).then(setSrc));
  }, [token]);
  return src ? (
    <img src={src} alt="Ticket QR code" className="mx-auto rounded-lg bg-foreground p-2" />
  ) : (
    <div className="h-72" />
  );
}

function Tickets() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const [regs, tix, att, certs, fb] = await Promise.all([
        supabase
          .from("registrations")
          .select("id,status,event_id,events(title,starts_at,ends_at,venue)")
          .order("created_at", { ascending: false }),
        supabase.from("tickets").select("registration_id,token"),
        supabase.from("attendance").select("registration_id,checked_in_at"),
        supabase.from("certificates").select("registration_id,serial,issued_at"),
        supabase.from("feedback").select("event_id"),
      ]);
      if (regs.error) throw regs.error;
      return {
        regs: regs.data,
        tix: new Map((tix.data ?? []).map((t) => [t.registration_id, t.token])),
        att: new Map((att.data ?? []).map((a) => [a.registration_id, a.checked_in_at])),
        certs: new Map((certs.data ?? []).map((c) => [c.registration_id, c])),
        fb: new Set((fb.data ?? []).map((f) => f.event_id)),
      };
    },
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_registration", { _registration_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registration cancelled");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="max-w-4xl">
      <PageHeader title="My tickets" sub="Show the QR code at the entrance. Never share it." />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.regs.length ? (
        <Empty>You haven't registered for any events.</Empty>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {data.regs.map((r) => {
            const attended = data.att.get(r.id);
            const cert = data.certs.get(r.id);
            const token = data.tix.get(r.id);
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">{r.events?.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(r.events?.starts_at)} · {r.events?.venue}
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    {r.status === "cancelled" ? (
                      <Badge variant="outline">Cancelled</Badge>
                    ) : attended ? (
                      <Badge>Checked in</Badge>
                    ) : (
                      <Badge variant="secondary">Registered</Badge>
                    )}
                    {cert && <Badge variant="outline">Certificate</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === "registered" && !attended && token && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm">Show QR</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>{r.events?.title}</DialogTitle>
                        </DialogHeader>
                        <Qr token={token} />
                      </DialogContent>
                    </Dialog>
                  )}
                  {r.status === "registered" && !attended && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(r.id)}
                    >
                      Cancel
                    </Button>
                  )}
                  {cert && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        downloadCertificate({
                          name: me?.fullName || me?.email || "",
                          event: r.events?.title ?? "",
                          date: new Date(
                            r.events?.starts_at ?? cert.issued_at,
                          ).toLocaleDateString(),
                          serial: cert.serial,
                        })
                      }
                    >
                      Download certificate
                    </Button>
                  )}
                  {attended && !data.fb.has(r.event_id) && <FeedbackDialog eventId={r.event_id} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function FeedbackDialog({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!me?.id) throw new Error("You must be signed in to leave feedback");
      const val = validateFeedback({ rating, comment: comment.trim() || null });
      if (!val.success) throw new Error(val.error);
      const { error } = await supabase.from("feedback").insert({
        event_id: eventId,
        user_id: me.id,
        rating: val.data!.rating,
        comment: val.data!.comment ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks for your feedback");
      setOpen(false);
      setErr("");
      qc.invalidateQueries();
    },
    onError: (e) => {
      setErr(errMsg(e));
      toast.error(errMsg(e));
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setErr("");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Give feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>How was it?</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Button
              key={n}
              size="sm"
              disabled={save.isPending}
              variant={n <= rating ? "default" : "secondary"}
              onClick={() => setRating(n)}
            >
              {n}
            </Button>
          ))}
        </div>
        <Textarea
          maxLength={2000}
          disabled={save.isPending}
          placeholder="Optional comment (max 2,000 characters)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {err && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"
          >
            {err}
          </div>
        )}
        <Button disabled={save.isPending} aria-busy={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Submitting…" : "Submit"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
