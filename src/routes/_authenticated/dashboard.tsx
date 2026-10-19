import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { navFor, roleLabel } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CampusConnect" },
      { name: "description", content: "Your CampusConnect workspace." },
      { property: "og:title", content: "Dashboard — CampusConnect" },
      { property: "og:description", content: "Your CampusConnect workspace." },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data: me, isLoading, isError, error, refetch } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isVolunteer = (me?.volunteerEventCount ?? 0) > 0;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = "rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent";
  const active = { className: "bg-sidebar-accent text-sidebar-accent-foreground" };

  if (isLoading)
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading your account…
      </div>
    );
  if (isError || !me) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div role="alert" className="max-w-sm space-y-3 rounded-xl border bg-card p-6 text-center">
          <h1 className="font-semibold">We couldn't load your account</h1>
          <p className="text-sm text-muted-foreground">
            {isError ? (error as Error).message : "Your session ended. Sign in again."}
          </p>
          <div className="flex justify-center gap-2">
            <Button size="sm" onClick={() => refetch()}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 border-b bg-sidebar p-3 md:w-60 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-center gap-2 px-2 py-1 text-sm font-medium">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            C
          </span>
          CampusConnect
          <Badge variant="secondary" className="ml-auto md:hidden">
            {roleLabel(me.roles)}
          </Badge>
        </div>
        <nav
          aria-label="Dashboard navigation"
          className="flex flex-row flex-wrap gap-1 overflow-x-auto py-0.5 md:flex-col md:overflow-visible"
        >
          {navFor(me.roles, me.volunteerEventCount).map((i) => (
            <Link
              key={i.to}
              to={i.to}
              activeOptions={{ exact: !!i.exact }}
              activeProps={active}
              className={link}
            >
              {i.label}
            </Link>
          ))}
          <button type="button" onClick={signOut} className={`${link} text-left md:hidden`}>
            Sign out
          </button>
        </nav>
        <div className="mt-auto hidden space-y-2 border-t pt-3 md:block">
          <div className="px-2 text-sm">{me?.fullName || me?.email}</div>
          <div className="flex flex-wrap gap-1 px-2">
            {me?.roles.map((r) => (
              <Badge key={r} variant="secondary" className="capitalize">
                {r}
              </Badge>
            ))}
            {isVolunteer && <Badge variant="outline">volunteer</Badge>}
          </div>
          <Button size="sm" variant="ghost" className="w-full justify-start" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
