import {
  createFileRoute,
  isRedirect,
  Link,
  Outlet,
  redirect,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSafeRedirectPath, withTimeout } from "@/lib/auth-flow";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: () => (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      Checking authentication…
    </div>
  ),
  beforeLoad: async ({ location }) => {
    const rawTarget = location.href || location.pathname + (location.searchStr || "");
    const safeRedirect = getSafeRedirectPath(rawTarget, "/dashboard");
    const authSearch = safeRedirect ? { redirect: safeRedirect } : {};

    try {
      // getSession waits for the stored session to be restored (bounded so it can't hang silently).
      const { data: s, error: sessionErr } = await withTimeout(
        supabase.auth.getSession(),
        15000,
        "Restoring your sign-in",
      );
      if (sessionErr || !s?.session) {
        throw redirect({
          to: "/auth",
          search: authSearch,
        });
      }

      // Re-validate using getUser() without arguments to trigger Supabase's automatic refresh token logic.
      const { data, error } = await withTimeout(
        supabase.auth.getUser(),
        15000,
        "Checking your sign-in",
      );

      // Handle network errors properly: throw error so GateError catches it with a retry button instead of failing open into child routes.
      if (error) {
        if ((error.status ?? 0) >= 400) {
          throw redirect({
            to: "/auth",
            search: authSearch,
          });
        }
        throw new Error(error.message || "Network error verifying your session. Please retry.");
      }

      if (!data?.user) {
        throw redirect({
          to: "/auth",
          search: authSearch,
        });
      }
    } catch (err) {
      if (isRedirect(err)) throw err;
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (
        msg.includes("jwt") ||
        msg.includes("expired") ||
        msg.includes("malformed") ||
        msg.includes("invalid token") ||
        msg.includes("unauthorized")
      ) {
        throw redirect({
          to: "/auth",
          search: authSearch,
        });
      }
      throw err;
    }
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
