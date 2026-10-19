import { describe, expect, it, vi } from "vitest";
import { postSignInTarget, withTimeout } from "@/lib/auth-flow";

describe("post sign-in destination", () => {
  it("member sign-in always goes to /dashboard", () => {
    expect(postSignInTarget(["student"], false)).toEqual({ kind: "navigate", to: "/dashboard" });
    expect(postSignInTarget(["admin"], false)).toEqual({ kind: "navigate", to: "/dashboard" });
  });
  it("staff sign-in sends admins to /dashboard/admin", () => {
    expect(postSignInTarget(["student", "admin"], true)).toEqual({
      kind: "navigate",
      to: "/dashboard/admin",
    });
  });
  it("staff sign-in sends organizers to /dashboard/manage", () => {
    expect(postSignInTarget(["organizer"], true)).toEqual({
      kind: "navigate",
      to: "/dashboard/manage",
    });
  });
  it("staff sign-in denies students and accounts with no role", () => {
    expect(postSignInTarget(["student"], true)).toEqual({ kind: "denied" });
    expect(postSignInTarget([], true)).toEqual({ kind: "denied" });
  });
});

describe("withTimeout", () => {
  it("resolves with the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, "X")).resolves.toBe(42);
  });
  it("rejects with a readable message when the promise hangs", async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 5000, "Sign-in");
    const check = expect(p).rejects.toThrow("Sign-in timed out");
    await vi.advanceTimersByTimeAsync(5000);
    await check;
    vi.useRealTimers();
  });
  it("passes through the original rejection", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("Invalid login credentials")), 1000, "X"),
    ).rejects.toThrow("Invalid login");
  });
});
