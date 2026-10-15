import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSafeRedirectPath } from "@/lib/auth-flow";

interface SignInSearch {
  redirect?: string;
}

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => {
    const r = search["redirect"];
    const safe = typeof r === "string" ? getSafeRedirectPath(r) : undefined;
    return safe ? { redirect: safe } : {};
  },
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      throw redirect({ to: "/dashboard" });
    }
    const safe = search.redirect ? getSafeRedirectPath(search.redirect) : undefined;
    throw redirect({
      to: "/auth",
      search: safe ? { redirect: safe } : {},
    });
  },
  component: () => null,
});
