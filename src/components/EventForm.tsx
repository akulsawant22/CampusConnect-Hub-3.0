import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import { validateEventInput } from "@/lib/validation";
import type { Database } from "@/integrations/supabase/types";

type Ev = Database["public"]["Tables"]["events"]["Row"];
export type EventInput = Pick<
  Ev,
  | "title"
  | "description"
  | "category"
  | "venue"
  | "starts_at"
  | "ends_at"
  | "registration_deadline"
  | "capacity"
>;

export function EventForm({
  initial,
  onSubmit,
  busy,
  currentRegisteredCount = 0,
}: {
  initial?: Partial<Ev>;
  onSubmit: (v: EventInput) => void;
  busy?: boolean;
  currentRegisteredCount?: number;
}) {
  const [v, setV] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "general",
    venue: initial?.venue ?? "",
    starts_at: toLocalInput(initial?.starts_at),
    ends_at: toLocalInput(initial?.ends_at),
    registration_deadline: toLocalInput(initial?.registration_deadline),
    capacity: String(initial?.capacity ?? 100),
  });
  const [err, setErr] = useState("");
  const set =
    (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV({ ...v, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!v.starts_at || !v.ends_at || !v.registration_deadline) {
      setErr("Start date, end date, and registration deadline are all required");
      return;
    }

    const startsIso = fromLocalInput(v.starts_at);
    const endsIso = fromLocalInput(v.ends_at);
    const deadlineIso = fromLocalInput(v.registration_deadline);
    const cap = Number(v.capacity);

    const validation = validateEventInput(
      {
        title: v.title,
        description: v.description,
        category: v.category || "general",
        venue: v.venue,
        starts_at: startsIso,
        ends_at: endsIso,
        registration_deadline: deadlineIso,
        capacity: cap,
      },
      currentRegisteredCount,
    );

    if (!validation.success) {
      setErr(validation.error || "Please check the form for errors");
      return;
    }

    setErr("");
    onSubmit({
      title: validation.data!.title,
      description: validation.data!.description,
      category: validation.data!.category,
      venue: validation.data!.venue,
      starts_at: validation.data!.starts_at,
      ends_at: validation.data!.ends_at,
      registration_deadline: validation.data!.registration_deadline,
      capacity: validation.data!.capacity,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="event-title" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="event-title"
          required
          minLength={3}
          maxLength={160}
          value={v.title}
          onChange={set("title")}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="event-desc" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="event-desc"
          rows={4}
          maxLength={5000}
          value={v.description}
          onChange={set("description")}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="event-cat" className="text-sm font-medium">
          Category
        </label>
        <Input id="event-cat" maxLength={40} value={v.category} onChange={set("category")} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="event-venue" className="text-sm font-medium">
          Venue
        </label>
        <Input id="event-venue" maxLength={160} value={v.venue} onChange={set("venue")} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="event-starts" className="text-sm font-medium">
          Starts
        </label>
        <Input
          id="event-starts"
          type="datetime-local"
          required
          value={v.starts_at}
          onChange={set("starts_at")}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="event-ends" className="text-sm font-medium">
          Ends
        </label>
        <Input
          id="event-ends"
          type="datetime-local"
          required
          value={v.ends_at}
          onChange={set("ends_at")}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="event-deadline" className="text-sm font-medium">
          Registration deadline
        </label>
        <Input
          id="event-deadline"
          type="datetime-local"
          required
          value={v.registration_deadline}
          onChange={set("registration_deadline")}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="event-capacity" className="text-sm font-medium">
          Capacity
        </label>
        <Input
          id="event-capacity"
          type="number"
          min={Math.max(1, currentRegisteredCount)}
          required
          value={v.capacity}
          onChange={set("capacity")}
        />
      </div>
      {err && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-sm text-destructive sm:col-span-2"
        >
          {err}
        </div>
      )}
      <div className="sm:col-span-2">
        <Button disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
