// Pure helpers for the sign-in flow (no backend imports, so they are unit-testable).
import { isStaff } from "@/lib/nav";

/** Rejects with a readable message if `p` doesn't settle within `ms`. */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => {
      timer = setTimeout(
        () => rej(new Error(`${what} timed out. Check your connection and retry.`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

export type SignInDecision = { kind: "navigate"; to: string } | { kind: "denied" };

/**
 * Validates and sanitizes a redirect destination path to prevent open redirect vulnerabilities
 * and redirect loops. Only local absolute paths starting with '/' and not '//' or '/\' are accepted.
 */
export function getSafeRedirectPath(rawTarget: unknown, fallback?: string): string | undefined {
  if (typeof rawTarget !== "string") return fallback;
  const target = rawTarget.trim();
  if (
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.startsWith("/\\") ||
    target.includes("://") ||
    target.includes("\r") ||
    target.includes("\n") ||
    target.includes("/../") ||
    target.endsWith("/..")
  ) {
    return fallback;
  }
  // Prevent redirect loops back to auth / reset pages
  if (
    target === "/auth" ||
    target.startsWith("/auth?") ||
    target === "/staff-login" ||
    target.startsWith("/staff-login?") ||
    target === "/reset-password" ||
    target.startsWith("/reset-password?") ||
    target === "/sign-in" ||
    target.startsWith("/sign-in?")
  ) {
    return fallback;
  }
  // Only permit valid dashboard paths
  if (!target.startsWith("/dashboard")) {
    return fallback;
  }
  return target;
}

/** Where a freshly signed-in user goes. Staff sign-in requires admin/organizer (UI only; DB re-checks). */
export function postSignInTarget(
  roles: readonly string[],
  staff: boolean,
  redirectTarget?: string | null,
): SignInDecision {
  if (!staff) {
    const safeTarget = redirectTarget
      ? (getSafeRedirectPath(redirectTarget, "/dashboard") ?? "/dashboard")
      : "/dashboard";
    return { kind: "navigate", to: safeTarget };
  }
  if (!isStaff(roles)) return { kind: "denied" };
  const defaultStaffTarget = roles.includes("admin") ? "/dashboard/admin" : "/dashboard/manage";
  if (redirectTarget) {
    const safeTarget =
      getSafeRedirectPath(redirectTarget, defaultStaffTarget) ?? defaultStaffTarget;
    return { kind: "navigate", to: safeTarget };
  }
  return {
    kind: "navigate",
    to: defaultStaffTarget,
  };
}
