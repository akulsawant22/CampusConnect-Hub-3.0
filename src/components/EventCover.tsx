import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/format";

const BUCKET = "event-covers";
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// cover_url stores the private storage path ("<eventId>/cover-<ts>.<ext>"); we sign it for display.
export function EventCover({ path, className = "" }: { path: string | null; className?: string }) {
  const { data } = useQuery({
    queryKey: ["cover", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => (await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600)).data?.signedUrl ?? null,
  });
  if (!path || !data) return null;
  return <img src={data} alt="" className={`w-full object-cover ${className}`} />;
}

export function CoverUploader({ eventId, path }: { eventId: string; path: string | null }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    const ext = TYPES[file.type];
    if (!ext) { toast.error("Use a JPG, PNG or WebP image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setBusy(true);
    try {
      const newPath = `${eventId}/cover-${Date.now()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(newPath, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { error } = await supabase.from("events").update({ cover_url: newPath }).eq("id", eventId);
      if (error) throw error;
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      toast.success("Cover updated");
      qc.invalidateQueries({ queryKey: ["event-admin", eventId] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-muted">
        {path ? <EventCover path={path} className="aspect-[3/1]" /> : <div className="grid aspect-[3/1] place-items-center text-xs text-muted-foreground">No cover image</div>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : path ? "Replace cover" : "Upload cover"}</Button>
    </div>
  );
}