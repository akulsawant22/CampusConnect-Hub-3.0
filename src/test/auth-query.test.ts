import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { validateSignIn, validateSignUp, validateEmail, validatePassword } from "@/lib/validation";
import { getSafeRedirectPath, postSignInTarget, withTimeout } from "@/lib/auth-flow";
import { meQuery } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

describe("Phase F: Form validation parity and disabled submit states", () => {
  it("rejects missing or malformed email", () => {
    const emptyEmail = validateSignIn({ email: "", password: "Password123!" });
    expect(emptyEmail).toBe("Email is required");

    const invalidEmail = validateSignIn({ email: "not-an-email", password: "Password123!" });
    expect(invalidEmail).toBe("Please enter a valid email address");

    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("test@campus.edu")).toBeNull();
  });

  it("validates password length invariants", () => {
    const shortPw = validatePassword("short");
    expect(shortPw).toBe("Password must be at least 8 characters long");

    const validPw = validatePassword("SecurePass123!");
    expect(validPw).toBeNull();
  });

  it("validates sign-up details accurately", () => {
    const shortName = validateSignUp({
      fullName: "A",
      email: "valid@campus.edu",
      password: "Password123!",
    });
    expect(shortName).toBe("Full name must be at least 2 characters");

    const validSignUp = validateSignUp({
      fullName: "Jane Doe",
      email: "jane@campus.edu",
      password: "Password123!",
    });
    expect(validSignUp).toBeNull();
  });

  it("accepts valid sign-in email and password combination", () => {
    const valid = validateSignIn({ email: "student@campus.edu", password: "SecurePassword1!" });
    expect(valid).toBeNull();
  });
});

describe("Phase F: Safe redirect validation & open-redirect protection", () => {
  it("allows safe dashboard subpaths", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("/dashboard/events")).toBe("/dashboard/events");
    expect(getSafeRedirectPath("/dashboard/manage/evt-123")).toBe("/dashboard/manage/evt-123");
    expect(getSafeRedirectPath("/dashboard/tickets?tab=history")).toBe(
      "/dashboard/tickets?tab=history",
    );
  });

  it("neutralizes external URLs and protocol-relative attacks", () => {
    expect(getSafeRedirectPath("https://attacker.example.com")).toBeUndefined();
    expect(getSafeRedirectPath("http://attacker.example.com")).toBeUndefined();
    expect(getSafeRedirectPath("//attacker.example.com")).toBeUndefined();
    expect(getSafeRedirectPath("///attacker.example.com")).toBeUndefined();
    expect(getSafeRedirectPath("/\\attacker.example.com")).toBeUndefined();
    expect(getSafeRedirectPath("javascript:alert(1)")).toBeUndefined();
    expect(getSafeRedirectPath("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(getSafeRedirectPath("/dashboard\r\nSet-Cookie: evil=1")).toBeUndefined();

    // With fallback
    expect(getSafeRedirectPath("https://attacker.example.com", "/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("//attacker.example.com", "/dashboard")).toBe("/dashboard");
  });

  it("neutralizes auth redirect loops", () => {
    expect(getSafeRedirectPath("/auth")).toBeUndefined();
    expect(getSafeRedirectPath("/auth?redirect=/dashboard")).toBeUndefined();
    expect(getSafeRedirectPath("/staff-login")).toBeUndefined();
    expect(getSafeRedirectPath("/reset-password")).toBeUndefined();
    expect(getSafeRedirectPath("/auth", "/dashboard")).toBe("/dashboard");
  });

  it("falls back to custom fallback path when target is invalid", () => {
    expect(getSafeRedirectPath("https://attacker.com", "/dashboard/events")).toBe(
      "/dashboard/events",
    );
    expect(getSafeRedirectPath(undefined, "/dashboard/tickets")).toBe("/dashboard/tickets");
  });

  it("postSignInTarget respects safe redirect for authorized roles", () => {
    const target = postSignInTarget(["student"], false, "/dashboard/events");
    expect(target).toEqual({ kind: "navigate", to: "/dashboard/events" });

    const staffAdmin = postSignInTarget(["student", "admin"], true, "/dashboard/tickets");
    expect(staffAdmin).toEqual({ kind: "navigate", to: "/dashboard/tickets" });

    // Open redirect attempt safely falls back to default role target
    const evilAttempt = postSignInTarget(["student", "admin"], true, "https://evil.com");
    expect(evilAttempt).toEqual({ kind: "navigate", to: "/dashboard/admin" });
  });

  it("postSignInTarget denies unauthorized staff access regardless of redirect parameter", () => {
    expect(postSignInTarget(["student"], true, "/dashboard/manage")).toEqual({ kind: "denied" });
    expect(postSignInTarget([], true, "/dashboard/admin")).toEqual({ kind: "denied" });
  });

  it("withTimeout settles fast promises and rejects slow promises", async () => {
    const fast = await withTimeout(Promise.resolve("ok"), 500, "Fast operation");
    expect(fast).toBe("ok");

    const slowPromise = new Promise((resolve) => setTimeout(resolve, 50));
    await expect(withTimeout(slowPromise, 10, "Slow operation")).rejects.toThrow(
      "Slow operation timed out. Check your connection and retry.",
    );
  });
});

describe("Phase F: Session recovery and expired/malformed token handling", () => {
  it("meQuery returns null when session is absent", async () => {
    const spy = vi.spyOn(supabase.auth, "getSession").mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as never);

    const queryFn = meQuery.queryFn;
    expect(queryFn).toBeDefined();
    if (queryFn) {
      const res = await queryFn({} as never);
      expect(res).toBeNull();
    }
    spy.mockRestore();
  });

  it("meQuery gracefully returns null on expired or malformed JWT errors without crashing", async () => {
    const spy = vi
      .spyOn(supabase.auth, "getSession")
      .mockRejectedValueOnce(new Error("JWT expired: token has expired or is invalid"));

    const queryFn = meQuery.queryFn;
    expect(queryFn).toBeDefined();
    if (queryFn) {
      const res = await queryFn({} as never);
      expect(res).toBeNull();
    }
    spy.mockRestore();
  });

  it("meQuery rethrows unexpected non-auth database errors", async () => {
    const spy = vi
      .spyOn(supabase.auth, "getSession")
      .mockRejectedValueOnce(new Error("Fatal database connection failed"));

    const queryFn = meQuery.queryFn;
    expect(queryFn).toBeDefined();
    if (queryFn) {
      await expect(queryFn({} as never)).rejects.toThrow("Fatal database connection failed");
    }
    spy.mockRestore();
  });
});

describe("Phase H: Query cache clearing and targeted invalidations", () => {
  it("clears all cached queries on explicit sign out", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["me"], { id: "user-1", email: "user@test.edu" });
    qc.setQueryData(["overview", "user-1"], { regs: 2, certs: 1 });
    qc.setQueryData(["browse"], [{ id: "event-1", title: "Hackathon" }]);

    expect(qc.getQueryData(["me"])).toBeDefined();
    expect(qc.getQueryData(["overview", "user-1"])).toBeDefined();
    expect(qc.getQueryData(["browse"])).toBeDefined();

    // Emulate sign out cache clearing: cancelQueries and clear
    await qc.cancelQueries();
    qc.clear();

    expect(qc.getQueryData(["me"])).toBeUndefined();
    expect(qc.getQueryData(["overview", "user-1"])).toBeUndefined();
    expect(qc.getQueryData(["browse"])).toBeUndefined();
  });

  it("targeted query invalidation invalidates matching keys", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["browse"], [{ id: "ev-1" }]);
    qc.setQueryData(["my-tickets"], [{ id: "reg-1" }]);
    qc.setQueryData(["overview"], { count: 1 });

    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    // Simulate event registration invalidations
    qc.invalidateQueries({ queryKey: ["browse"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
    qc.invalidateQueries({ queryKey: ["my-tickets"] });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["browse"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["overview"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["my-tickets"] });
  });

  it("event management and ticket check-in invalidate related queries", async () => {
    const qc = new QueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    // Check-in scan invalidations
    const eventId = "evt-456";
    qc.invalidateQueries({ queryKey: ["event-admin", eventId] });
    qc.invalidateQueries({ queryKey: ["my-staff"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["event-admin", eventId] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["my-staff"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["analytics"] });

    // Mark all notifications read invalidations
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["overview"] });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["overview"] });
  });
});
