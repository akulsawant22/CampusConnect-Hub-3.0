import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/auth-flow";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession waits for the stored session to be restored (bounded so it can't hang silently).
    const { data: s } = await withTimeout(
      supabase.auth.getSession(),
      15000,
      "Restoring your sign-in",
    );
    if (!s.session) throw redirect({ to: "/auth" });
    // Re-validate with the token we already have (avoids a second storage read).
    const { data, error } = await withTimeout(
      supabase.auth.getUser(s.session.access_token),
      15000,
      "Checking your sign-in",
    );
    // Only redirect on a real auth rejection, not on a transient network failure.
    if (!data.user && (!error || (error.status ?? 0) >= 400)) throw redirect({ to: "/auth" });
  },
  errorComponent: GateError,
  component: () => <Outlet />,
});

function GateError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div role="alert" className="max-w-sm space-y-3 rounded-xl border bg-card p-6 text-center">
        <h1 className="font-semibold">We couldn't open your dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
        <div className="flex justify-center gap-2">
          <Button size="sm" onClick={() => router.invalidate()}>
            Retry
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/auth">Back to sign-in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
