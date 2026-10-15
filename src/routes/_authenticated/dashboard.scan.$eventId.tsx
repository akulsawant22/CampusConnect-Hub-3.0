import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/scan/$eventId")({
  component: Scanner,
});

type Result = { kind: "ok" | "duplicate" | "error"; text: string; at: number };
const LABELS: Record<string, string> = {
  invalid: "Invalid ticket",
  wrong_event: "Ticket is for a different event",
  cancelled: "Registration was cancelled",
};

function Scanner() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastRef = useRef<{ token: string; at: number }>({ token: "", at: 0 });
  const busyRef = useRef(false);
  // UI gate only; check_in_ticket re-verifies permission on every scan.
  const {
    data: ev,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["scan-ev", eventId],
    queryFn: async () => {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const uid = u.user?.id;
      if (!uid) return null;
      const [e, staff, roles] = await Promise.all([
        supabase.from("events").select("title, organizer_id").eq("id", eventId).maybeSingle(),
        supabase
          .from("event_staff")
          .select("can_scan")
          .eq("event_id", eventId)
          .eq("user_id", uid)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      if (e.error) throw e.error;
      if (staff.error) throw staff.error;
      if (roles.error) throw roles.error;
      if (!e.data) return null;
      const r = (roles.data ?? []).map((x) => x.role);
      const allowed =
        r.includes("admin") ||
        (r.includes("organizer") && e.data.organizer_id === uid) ||
        !!staff.data?.can_scan;
      return { title: e.data.title, allowed };
    },
  });
  useEffect(
    () => () => {
      void scannerRef.current?.stop().catch(() => {});
    },
    [],
  );
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError)
    return (
      <div className="max-w-md">
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <PageHeader title="Scan tickets" sub="" />
        <div
          role="alert"
          className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center"
        >
          <h2 className="font-semibold text-destructive">Failed to load scanner</h2>
          <p className="mt-1 text-sm text-muted-foreground">{errMsg(error)}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  if (!ev?.allowed)
    return (
      <div className="max-w-md">
        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <PageHeader title="Scan tickets" sub="" />
        <p className="text-sm text-muted-foreground">
          You don't have scanning permission for this event.
        </p>
      </div>
    );

  async function handle(token: string) {
    const now = Date.now();
    if (busyRef.current || (token === lastRef.current.token && now - lastRef.current.at < 3000))
      return;
    lastRef.current = { token, at: now };
    busyRef.current = true;
    try {
      const { data, error } = await supabase.rpc("check_in_ticket", {
        _event_id: eventId,
        _token: token.trim(),
      });
      if (error) throw error;
      const r = data as { result: string; name?: string };
      if (r.result === "ok") {
        setCount((c) => c + 1);
        setResult({ kind: "ok", text: `Checked in ${r.name || "attendee"}`, at: now });
        qc.invalidateQueries({ queryKey: ["event-admin", eventId] });
        qc.invalidateQueries({ queryKey: ["my-staff"] });
        qc.invalidateQueries({ queryKey: ["analytics"] });
      } else if (r.result === "duplicate")
        setResult({
          kind: "duplicate",
          text: `${r.name || "Attendee"} already checked in`,
          at: now,
        });
      else setResult({ kind: "error", text: LABELS[r.result] ?? "Rejected", at: now });
    } catch (e) {
      setResult({ kind: "error", text: errMsg(e), at: now });
    } finally {
      busyRef.current = false;
    }
  }

  async function start() {
    const { Html5Qrcode } = await import("html5-qrcode");
    const s = new Html5Qrcode("qr-reader");
    scannerRef.current = s;
    try {
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (text) => void handle(text),
        () => {},
      );
      setRunning(true);
    } catch (e) {
      setResult({ kind: "error", text: "Camera unavailable: " + errMsg(e), at: Date.now() });
    }
  }
  async function stop() {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* already stopped */
    }
    setRunning(false);
  }

  const tone =
    result?.kind === "ok"
      ? "border-success text-success"
      : result?.kind === "duplicate"
        ? "border-warning text-warning"
        : "border-destructive text-destructive";
  return (
    <div className="max-w-md">
      <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <PageHeader title="Scan tickets" sub={ev?.title ?? ""} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div id="qr-reader" className="aspect-square w-full" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        {running ? (
          <Button variant="secondary" onClick={stop}>
            Stop camera
          </Button>
        ) : (
          <Button onClick={start}>Start camera</Button>
        )}
        <span className="font-mono text-xs text-muted-foreground">
          {count} checked in this session
        </span>
      </div>
      {result && (
        <div className={`mt-4 rounded-xl border p-4 text-sm font-medium ${tone}`}>
          {result.text}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Every scan is verified by the server against your permissions for this event.
      </p>
    </div>
  );
}
