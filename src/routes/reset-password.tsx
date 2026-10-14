import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — CampusConnect" },
      { name: "description", content: "Choose a new password for your CampusConnect account." },
      { property: "og:title", content: "Reset password — CampusConnect" },
      { property: "og:description", content: "Choose a new password for your CampusConnect account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const [linkError, setLinkError] = useState("");
  useEffect(() => {
    // The auth client may consume the recovery hash and emit PASSWORD_RECOVERY before this
    // page mounts, so also accept an already-established session from the link.
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
    const err = params.get("error_description");
    if (err) setLinkError(err.replace(/\+/g, " "));
    if (params.get("type") === "recovery") setReady(true);
    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "PASSWORD_RECOVERY" || (e === "SIGNED_IN" && session)) setReady(true);
    });
    void supabase.auth.getSession().then(({ data: s }) => { if (s.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-7 shadow-elevated">
        <h1 className="text-lg font-semibold tracking-tight">Set a new password</h1>
        {ready ? (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div className="space-y-1.5"><Label htmlFor="newpw">New password</Label><Input id="newpw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <Button className="w-full" disabled={busy}>Update password</Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{linkError || "Open this page from the reset link in your email."}</p>
        )}
      </div>
    </div>
  );
}