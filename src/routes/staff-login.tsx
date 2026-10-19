import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";
import { supabase } from "@/integrations/supabase/client";
import { getSafeRedirectPath } from "@/lib/auth-flow";

interface AuthSearch {
  redirect?: string;
}

export const Route = createFileRoute("/staff-login")({
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
      { title: "Admin & Organizer sign-in — CampusConnect" },
      {
        name: "description",
        content: "Staff sign-in for CampusConnect admins and event organizers.",
      },
      { property: "og:title", content: "Admin & Organizer sign-in — CampusConnect" },
      {
        property: "og:description",
        content: "Staff sign-in for CampusConnect admins and event organizers.",
      },
    ],
  }),
  component: StaffLoginComponent,
});

function StaffLoginComponent() {
  return <SignInForm variant="staff" />;
}
