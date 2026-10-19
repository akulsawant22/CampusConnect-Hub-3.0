import { describe, expect, it, vi } from "vitest";
import { getSafeRedirectPath, postSignInTarget, withTimeout } from "@/lib/auth-flow";

describe("post sign-in destination", () => {
  it("member sign-in goes to /dashboard by default or to safe redirect", () => {
    expect(postSignInTarget(["student"], false)).toEqual({ kind: "navigate", to: "/dashboard" });
    expect(postSignInTarget(["admin"], false)).toEqual({ kind: "navigate", to: "/dashboard" });
    expect(postSignInTarget(["student"], false, "/dashboard/events")).toEqual({
      kind: "navigate",
      to: "/dashboard/events",
    });
    // Unsafe redirects fallback to default
    expect(postSignInTarget(["student"], false, "https://evil.com")).toEqual({
      kind: "navigate",
      to: "/dashboard",
    });
    expect(postSignInTarget(["student"], false, "//evil.com")).toEqual({
      kind: "navigate",
      to: "/dashboard",
    });
  });
  it("staff sign-in sends admins to /dashboard/admin or safe redirect", () => {
    expect(postSignInTarget(["student", "admin"], true)).toEqual({
      kind: "navigate",
      to: "/dashboard/admin",
    });
    expect(postSignInTarget(["student", "admin"], true, "/dashboard/manage")).toEqual({
      kind: "navigate",
      to: "/dashboard/manage",
    });
  });
  it("staff sign-in sends organizers to /dashboard/manage or safe redirect", () => {
    expect(postSignInTarget(["organizer"], true)).toEqual({
      kind: "navigate",
      to: "/dashboard/manage",
    });
    expect(postSignInTarget(["organizer"], true, "/dashboard/scan/evt-123")).toEqual({
      kind: "navigate",
      to: "/dashboard/scan/evt-123",
    });
  });
  it("staff sign-in denies students and accounts with no role", () => {
    expect(postSignInTarget(["student"], true)).toEqual({ kind: "denied" });
    expect(postSignInTarget([], true)).toEqual({ kind: "denied" });
  });
});

describe("getSafeRedirectPath", () => {
  it("accepts valid relative dashboard paths", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("/dashboard/events")).toBe("/dashboard/events");
    expect(getSafeRedirectPath("/dashboard/manage?page=2")).toBe("/dashboard/manage?page=2");
  });
  it("rejects open redirects and external URLs", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBeUndefined();
    expect(getSafeRedirectPath("http://evil.com")).toBeUndefined();
    expect(getSafeRedirectPath("//evil.com")).toBeUndefined();
    expect(getSafeRedirectPath("///evil.com")).toBeUndefined();
    expect(getSafeRedirectPath("javascript:alert(1)")).toBeUndefined();
  });
  it("rejects non-relative or non-whitelisted paths", () => {
    expect(getSafeRedirectPath("foo/bar")).toBeUndefined();
    expect(getSafeRedirectPath("/../evil")).toBeUndefined();
    expect(getSafeRedirectPath("/other-site")).toBeUndefined();
  });
  it("uses custom default path when provided", () => {
    expect(getSafeRedirectPath("https://evil.com", "/dashboard/events")).toBe("/dashboard/events");
    expect(getSafeRedirectPath(undefined, "/dashboard/tickets")).toBe("/dashboard/tickets");
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
