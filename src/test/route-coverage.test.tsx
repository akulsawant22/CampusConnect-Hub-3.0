import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Route matching only: proves each URL resolves to the intended page, NOT that access is authorized.
const cases: [string, string][] = [
  ["/", "/"],
  ["/auth", "/auth"],
  ["/reset-password", "/reset-password"],
  ["/dashboard", "/_authenticated/dashboard/"],
  ["/dashboard/events", "/_authenticated/dashboard/events"],
  ["/dashboard/tickets", "/_authenticated/dashboard/tickets"],
  ["/dashboard/volunteer", "/_authenticated/dashboard/volunteer"],
  ["/dashboard/manage", "/_authenticated/dashboard/manage/"],
  ["/dashboard/admin", "/_authenticated/dashboard/admin"],
  ["/dashboard/scan/abc-123", "/_authenticated/dashboard/scan/$eventId"],
];

describe("route tree coverage", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  it.each(cases)("%s matches %s", (url, id) => {
    expect(router.matchRoutes(url).at(-1)?.routeId).toBe(id);
  });
  it("dashboard pages sit under the sign-in gate", () => {
    for (const [url, id] of cases)
      if (url.startsWith("/dashboard")) {
        expect(router.matchRoutes(url).map((m) => m.routeId)).toContain("/_authenticated");
        expect(id.startsWith("/_authenticated")).toBe(true);
      }
  });
});
