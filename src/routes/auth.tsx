import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";
import { supabase } from "@/integrations/supabase/client";
import { getSafeRedirectPath } from "@/lib/auth-flow";

interface AuthSearch {
  redirect?: string;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const r = search["redirect"];
    const safe = typeof r === "string" ? getSafeRedirectPath(r) : undefined;
    return safe ? { redirect: safe } : {};
  },
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const dest = search.redirect ? getSafeRedirectPath(search.redirect) : "/dashboard";
      throw redirect({ to: dest || "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — CampusConnect" },
      {
        name: "description",
        content: "Sign in to CampusConnect to manage and attend college events.",
      },
      { property: "og:title", content: "Sign in — CampusConnect" },
      {
        property: "og:description",
        content: "Sign in to CampusConnect to manage and attend college events.",
      },
    ],
  }),
  component: AuthComponent,
});

function AuthComponent() {
  return <SignInForm variant="member" />;
}
