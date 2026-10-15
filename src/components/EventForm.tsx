import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fromLocalInput, toLocalInput } from "@/lib/format";
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
}: {
  initial?: Partial<Ev>;
  onSubmit: (v: EventInput) => void;
  busy?: boolean;
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
    const cap = Number(v.capacity);
    if (!(cap > 0 && cap <= 100000 && Number.isInteger(cap)))
      return setErr("Capacity must be a whole number above 0");
    if (new Date(v.ends_at) <= new Date(v.starts_at)) return setErr("End must be after start");
    if (new Date(v.registration_deadline) > new Date(v.ends_at))
      return setErr("Deadline must be before the event ends");
    setErr("");
    onSubmit({
      title: v.title.trim(),
      description: v.description.trim(),
      category: v.category.trim() || "general",
      venue: v.venue.trim(),
      starts_at: fromLocalInput(v.starts_at),
      ends_at: fromLocalInput(v.ends_at),
      registration_deadline: fromLocalInput(v.registration_deadline),
      capacity: cap,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Title</span>
        <Input required minLength={3} maxLength={160} value={v.title} onChange={set("title")} />
      </label>
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Description</span>
        <Textarea rows={4} maxLength={5000} value={v.description} onChange={set("description")} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Category</span>
        <Input maxLength={40} value={v.category} onChange={set("category")} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Venue</span>
        <Input maxLength={160} value={v.venue} onChange={set("venue")} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Starts</span>
        <Input type="datetime-local" required value={v.starts_at} onChange={set("starts_at")} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Ends</span>
        <Input type="datetime-local" required value={v.ends_at} onChange={set("ends_at")} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Registration deadline</span>
        <Input
          type="datetime-local"
          required
          value={v.registration_deadline}
          onChange={set("registration_deadline")}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Capacity</span>
        <Input type="number" min={1} required value={v.capacity} onChange={set("capacity")} />
      </label>
      {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2">
        <Button disabled={busy}>Save</Button>
      </div>
    </form>
  );
}
