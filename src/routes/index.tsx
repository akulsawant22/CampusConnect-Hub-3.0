import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampusConnect — College events, end to end" },
      { name: "description", content: "Publish events, register students, scan QR tickets and issue certificates in one place." },
      { property: "og:title", content: "CampusConnect — College events, end to end" },
      { property: "og:description", content: "Publish events, register students, scan QR tickets and issue certificates in one place." },
    ],
  }),
  component: Landing,
});

const features = [
  ["Publish", "Organizers draft, schedule and publish events with capacity and deadlines."],
  ["Register", "Students get an opaque QR ticket. No duplicates, no overbooking."],
  ["Check in", "Assigned volunteers scan tickets from their phone camera."],
  ["Certify", "Attendance turns into verifiable certificates and feedback."],
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute inset-0 bg-glow" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">C</span>
          CampusConnect
        </div>
        <div className="flex items-center gap-3">
          <Link to="/staff-login" className="text-sm text-muted-foreground hover:text-foreground">Staff sign in</Link>
          <Button asChild size="sm" variant="secondary"><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-20">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-primary">Campus event operations</p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Every college event, from announcement to certificate.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          One workspace for admins, organizers, students and volunteers — with permissions enforced by the database, not the screen.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
        </div>
        <div className="mt-24 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4">
          {features.map(([t, d], i) => (
            <div key={t} className="bg-card p-6">
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <h3 className="mt-3 font-medium">{t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}