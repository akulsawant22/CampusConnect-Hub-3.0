import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { isStaff, navFor } from "@/lib/nav";

const labels = (roles: string[], vol = 0) => navFor(roles, vol).map((i) => i.label);

describe("role-derived navigation", () => {
  it("student sees Events, My tickets, Notifications only", () => {
    expect(labels(["student"])).toEqual(["Overview", "Events", "My tickets", "Notifications"]);
  });
  it("organizer gets Manage events but not Admin", () => {
    const l = labels(["student", "organizer"]);
    expect(l).toContain("Manage events");
    expect(l).not.toContain("Admin");
  });
  it("admin gets Admin and Manage events", () => {
    expect(labels(["student", "admin"])).toEqual(
      expect.arrayContaining(["Admin", "Manage events"]),
    );
  });
  it("student volunteer keeps student features and gets Volunteer", () => {
    expect(labels(["student"], 2)).toEqual(expect.arrayContaining(["My tickets", "Volunteer"]));
    expect(labels(["student"], 2)).not.toContain("Manage events");
  });
  it("only admin/organizer count as staff", () => {
    expect(isStaff(["student"])).toBe(false);
    expect(isStaff(["organizer"])).toBe(true);
    expect(isStaff(["admin"])).toBe(true);
  });
});

describe("sign-in routes", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  it("/staff-login is public and resolves to the staff sign-in page", () => {
    const ids = router.matchRoutes("/staff-login").map((m) => m.routeId);
    expect(ids.at(-1)).toBe("/staff-login");
    expect(ids).not.toContain("/_authenticated");
  });
  it("/auth is public", () => {
    expect(router.matchRoutes("/auth").map((m) => m.routeId)).not.toContain("/_authenticated");
  });
});
