// Pure helpers for the sign-in flow (no backend imports, so they are unit-testable).
import { isStaff } from "@/lib/nav";

/** Rejects with a readable message if `p` doesn't settle within `ms`. */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => {
      timer = setTimeout(() => rej(new Error(`${what} timed out. Check your connection and retry.`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export type SignInDecision =
  | { kind: "navigate"; to: "/dashboard" | "/dashboard/admin" | "/dashboard/manage" }
  | { kind: "denied" };

/** Where a freshly signed-in user goes. Staff sign-in requires admin/organizer (UI only; DB re-checks). */
export function postSignInTarget(roles: readonly string[], staff: boolean): SignInDecision {
  if (!staff) return { kind: "navigate", to: "/dashboard" };
  if (!isStaff(roles)) return { kind: "denied" };
  return { kind: "navigate", to: roles.includes("admin") ? "/dashboard/admin" : "/dashboard/manage" };
}