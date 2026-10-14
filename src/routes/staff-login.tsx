import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";

export const Route = createFileRoute("/staff-login")({
  head: () => ({
    meta: [
      { title: "Admin & Organizer sign-in — CampusConnect" },
      { name: "description", content: "Staff sign-in for CampusConnect admins and event organizers." },
      { property: "og:title", content: "Admin & Organizer sign-in — CampusConnect" },
      { property: "og:description", content: "Staff sign-in for CampusConnect admins and event organizers." },
    ],
  }),
  component: () => <SignInForm variant="staff" />,
});