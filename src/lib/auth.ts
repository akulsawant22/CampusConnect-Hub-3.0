import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { withTimeout } from "@/lib/auth-flow";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface Me {
  id: string;
  email: string;
  fullName: string;
  roles: AppRole[];
  volunteerEventCount: number;
}

/** Loads profile/roles for a known signed-in user (no extra session read). */
export async function loadMe(user: { id: string; email?: string | null }): Promise<Me> {
  const [profile, roles, staff] = await withTimeout(
    Promise.all([
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase
        .from("event_staff")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]),
    10000,
    "Loading your account",
  );
  if (roles.error) throw new Error(`Couldn't load your roles: ${roles.error.message}`);
  if (profile.error) throw new Error(`Couldn't load your profile: ${profile.error.message}`);
  if (staff.error) throw new Error(`Couldn't load your staff assignments: ${staff.error.message}`);
  return {
    id: user.id,
    email: profile.data?.email || user.email || "",
    fullName: profile.data?.full_name || "",
    roles: (roles.data ?? []).map((r) => r.role),
    volunteerEventCount: staff.count ?? 0,
  };
}

// Roles are read from the protected user_roles table (RLS: own rows only).
// UI uses them only to choose what to show; every write is re-checked in the database.
// Errors are thrown (not swallowed) so pages can show a visible error instead of hanging.
export const meQuery = queryOptions({
  queryKey: ["me"],
  staleTime: 0,
  retry: 1,
  queryFn: async (): Promise<Me | null> => {
    try {
      const { data: s, error: sErr } = await withTimeout(
        supabase.auth.getSession(),
        10000,
        "Session check",
      );
      if (sErr) throw sErr;
      const user = s?.session?.user;
      if (!user) return null;
      return await loadMe(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      // If the session token is expired/invalid/missing, treat as logged out rather than unhandled crash
      if (
        msg.includes("jwt") ||
        msg.includes("expired") ||
        msg.includes("malformed") ||
        msg.includes("invalid token") ||
        msg.includes("unauthorized")
      ) {
        return null;
      }
      throw err;
    }
  },
});

export const useMe = () => useQuery(meQuery);
