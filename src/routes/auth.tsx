import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CampusConnect" },
      { name: "description", content: "Sign in to CampusConnect to manage and attend college events." },
      { property: "og:title", content: "Sign in — CampusConnect" },
      { property: "og:description", content: "Sign in to CampusConnect to manage and attend college events." },
    ],
  }),
  component: () => <SignInForm variant="member" />,
});