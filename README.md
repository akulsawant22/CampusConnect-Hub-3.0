# CampusConnect Hub 3.0

CampusConnect is a role-aware campus event management web application. It brings event discovery, registration, ticketing, attendance, volunteer workflows, and event administration into one responsive interface.

## Core capabilities

- **Role-based workspaces:** Student, Organizer, Admin, and event-specific Volunteer access.
- **Event lifecycle:** Browse events and manage event details through the authorized staff workspace.
- **Registration and tickets:** Registration flows, attendee tickets, and QR-based check-in.
- **Volunteer operations:** Event-specific assignments and permissions while retaining normal student features.
- **Post-event tools:** Certificates, feedback, notifications, and event analytics.
- **Database-backed access control:** PostgreSQL row-level security and trusted database functions enforce permissions beyond the UI.
- **Account access:** Email/password sign-in, account creation, password reset, and Google OAuth through Supabase Auth.

## Technology stack

- React 19, TypeScript, Vite, TanStack Start, TanStack Router, and TanStack Query
- Tailwind CSS v4 and Radix UI-based components
- Supabase Auth, PostgreSQL, Storage, and row-level security
- QR scanning with `html5-qrcode`
- Recharts for charts and jsPDF for certificates/documents
- Drizzle migration assets and Bun for package management

## Repository layout

```text
.
├── .github/workflows/       # CI checks for typecheck, tests, and production build
├── docs/                    # Setup and architecture documentation
├── drizzle/migrations/      # Ordered database migrations
├── public/                  # Static assets
├── src/
│   ├── components/          # Reusable UI and event components
│   ├── hooks/               # Shared React hooks
│   ├── integrations/        # Authentication and Supabase adapters
│   ├── lib/                 # Auth flow, navigation, utilities, and helpers
│   ├── routes/              # File-based application routes
│   ├── test/                # Unit and route tests
│   ├── routeTree.gen.ts     # Generated route tree
│   └── styles.css           # Global styles
├── supabase/
│   ├── config.toml
│   └── tests/               # SQL authorization and isolated integration tests
├── .env.example             # Safe template for local environment variables
├── package.json
└── bun.lock
```

## Quick start

### Prerequisites

- [Bun](https://bun.sh/) compatible with the lockfile
- A Supabase project with the required schema, migrations, and Auth providers configured

### Install and run

```bash
git clone https://github.com/akulsawant22/CampusConnect-Hub-3.0.git
cd CampusConnect-Hub-3.0
bun install
```

Copy `.env.example` to `.env`, fill in your own Supabase project values, then run:

```bash
bun run dev
```

Never commit your local `.env` file. Environment variable names and placeholders are documented in `.env.example`.

## Environment configuration

The client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Server-side code can also read `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Project IDs may be supplied using `VITE_SUPABASE_PROJECT_ID` and `SUPABASE_PROJECT_ID`. The optional `DATABASE_URL` is for trusted database tooling only.

`SUPABASE_SERVICE_ROLE_KEY` and `CAMPUSCONNECT_CRON_SECRET` are server-only values. Never expose them through a `VITE_*` variable or commit real values into source control. The Supabase service-role key bypasses row-level security; use it only in trusted server-side code.

## Checks

```bash
bunx tsc --noEmit
bun run test
bun run build
```

A GitHub Actions workflow runs type checking, unit tests, and a production build for pushes and pull requests targeting `main`. The unit tests cover route matching, role-derived navigation, and sign-in flow helpers. The SQL authorization and concurrency scripts under `supabase/tests/` require careful setup and must only be run against a dedicated disposable test backend with test credentials. Never point destructive or privileged tests at a production database.

## Database and initial admin

- Review the ordered SQL migrations in `drizzle/migrations/` before applying them to your chosen Supabase project.
- Use the least-privilege rules in the database as the source of truth; hiding a button in the UI is not an authorization boundary.
- Follow [the initial admin setup guide](docs/INITIAL_ADMIN_SETUP.md) to provision the first administrator through a trusted, verified database operation. There is intentionally no public self-promotion flow.

## Integration notes

- Google sign-in requires Google to be enabled in Supabase Auth and the correct callback URLs to be allow-listed.
- Email confirmation and password reset depend on Auth email delivery and redirect URL configuration.
- QR scanning requires a supported browser, camera permission, and a secure context (HTTPS) outside localhost.
- Before production deployment, configure server environment variables and allowed Auth redirect URLs for the chosen hosting domain, then run the checks above.
