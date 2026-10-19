// Pure, testable role → navigation decisions. UI-only: every action is re-checked in the database.
export type Role = "admin" | "organizer" | "student";

export interface NavItem {
  to: string;
  label: string;
  exact?: boolean;
}

export function isStaff(roles: readonly string[]): boolean {
  return roles.includes("admin") || roles.includes("organizer");
}

export function navFor(roles: readonly string[], volunteerEventCount: number): NavItem[] {
  const items: NavItem[] = [{ to: "/dashboard", label: "Overview", exact: true }];
  if (roles.includes("student")) {
    items.push(
      { to: "/dashboard/events", label: "Events" },
      { to: "/dashboard/tickets", label: "My tickets" },
    );
  } else {
    items.push({ to: "/dashboard/events", label: "Events" });
  }
  if (volunteerEventCount > 0) items.push({ to: "/dashboard/volunteer", label: "Volunteer" });
  if (isStaff(roles)) items.push({ to: "/dashboard/manage", label: "Manage events" });
  if (roles.includes("admin")) items.push({ to: "/dashboard/admin", label: "Admin" });
  items.push({ to: "/dashboard/notifications", label: "Notifications" });
  return items;
}

export function roleLabel(roles: readonly string[]): string {
  if (roles.includes("admin")) return "Admin";
  if (roles.includes("organizer")) return "Organizer";
  if (roles.includes("student")) return "Student";
  return "No role";
}
