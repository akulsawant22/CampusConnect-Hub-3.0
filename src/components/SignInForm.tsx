import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, meQuery } from "@/lib/auth";
import { postSignInTarget, withTimeout } from "@/lib/auth-flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Msg = { kind: "error" | "info"; text: string } | null;

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password. Check both and try again.";
  if (m.includes("email not confirmed"))
    return "This email isn't confirmed yet. Open the confirmation link we emailed you, then sign in.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Wait a minute and try again.";
  return message;
}

export function SignInForm({ variant }: { variant: "member" | "staff" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const staff = variant === "staff";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [denied, setDenied] = useState(false);
  const inFlight = useRef(false);

  // `session` comes straight from the sign-in response when available, so we don't
  // re-read storage (each read can wait on the preview's session relay).
  async function enterApp(session?: Session | null) {
    const s =
      session ??
      (await withTimeout(supabase.auth.getSession(), 15000, "Session check")).data.session;
    if (!s) {
      setMsg({
        kind: "error",
        text: "Sign-in didn't create a session. Allow cookies/storage for this site and try again.",
      });
      return;
    }
    await qc.cancelQueries({ queryKey: ["me"] });
    const me = await loadMe(s.user);
    qc.setQueryData(meQuery.queryKey, me);
    const decision = postSignInTarget(me.roles, staff);
    if (decision.kind === "denied") {
      setDenied(true);
      setMsg({
        kind: "error",
        text: "This account has not been granted Admin or Organizer access. The college administrator grants staff access — it can't be requested here.",
      });
      return;
    }
    await withTimeout(navigate({ to: decision.to }), 20000, "Opening your dashboard");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMsg(null);
    setDenied(false);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { data, error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          20000,
          "Sign-in",
        );
        if (error) throw error;
        await enterApp(data.session);
      }
    } catch (err) {
      setMsg({ kind: "error", text: friendly((err as Error).message || "Something went wrong.") });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function forgot() {
    setMsg(null);
    if (!email) {
      setMsg({ kind: "error", text: "Enter your email above first." });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMsg(
      error
        ? { kind: "error", text: error.message }
        : { kind: "info", text: "If that account exists, a reset link is on its way." },
    );
  }

  async function google() {
    setMsg(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // Supabase redirects the browser to the provider when data.url is available.
      if (data.url) return;
      await enterApp();
    } catch (err) {
      setMsg({ kind: "error", text: friendly((err as Error).message || "Google sign-in failed.") });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setDenied(false);
    setMsg(null);
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-glow" />
      <div className="relative w-full max-w-sm rounded-xl border bg-card p-7 shadow-elevated">
        <Link to="/" className="mb-6 flex items-center gap-2 text-sm font-medium">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            C
          </span>
          CampusConnect
          {staff && (
            <span className="ml-auto rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Staff
            </span>
          )}
        </Link>
        {sent ? (
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to {email}. Open it to finish creating your account.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold tracking-tight">
              {staff
                ? "Admin / Organizer sign-in"
                : mode === "signin"
                  ? "Welcome back"
                  : "Create your account"}
            </h1>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              {staff
                ? "Use your normal account. Staff access is granted by the college administrator."
                : "New accounts start as students."}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={google}
              type="button"
              disabled={busy}
            >
              Continue with Google
            </Button>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={submit} className="space-y-3" noValidate={false}>
              {mode === "signup" && !staff && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {msg && (
                <div
                  role={msg.kind === "error" ? "alert" : "status"}
                  className={`rounded-md border px-3 py-2 text-sm ${msg.kind === "error" ? "border-destructive/50 bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}
                >
                  {msg.text}
                </div>
              )}
              {denied && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate({ to: "/dashboard" })}
                  >
                    Go to my dashboard
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={signOut}>
                    Sign out
                  </Button>
                </div>
              )}
              <Button className="w-full" disabled={busy} aria-busy={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
            {!staff && (
              <button
                type="button"
                className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setMsg(null);
                  setMode(mode === "signin" ? "signup" : "signin");
                }}
              >
                {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
              </button>
            )}
            {mode === "signin" && (
              <button
                type="button"
                className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                onClick={forgot}
              >
                Forgot password?
              </button>
            )}
            <div className="mt-5 border-t pt-4 text-center text-xs">
              {staff ? (
                <Link to="/auth" className="text-muted-foreground hover:text-foreground">
                  Student sign-in
                </Link>
              ) : (
                <Link to="/staff-login" className="font-medium text-primary hover:underline">
                  Admin / Organizer sign-in →
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
