# Architecture overview

## Application routes

The application uses TanStack Start and file-based TanStack Router routes.

- Public routes: landing page, member sign-in, staff sign-in, and password reset.
- Protected routes: the shared dashboard layout and its student, organizer, volunteer, and administrator screens.
- The generated `src/routeTree.gen.ts` file tracks route definitions. Edit source route files rather than hand-editing the generated tree.

## Authentication and authorization

1. Supabase Auth authenticates the user.
2. The app loads the signed-in user's profile, roles, and event-staff assignments.
3. The UI derives navigation from these roles for discoverability and convenience.
4. PostgreSQL row-level security and trusted database functions enforce access to protected data and mutations. Client-side route guards and hidden links are not substitutes for database checks.

Staff sign-in is a distinct entry point, not a separate authentication mechanism. An account must already have the `admin` or `organizer` role to enter a staff workspace.

## Data and migrations

- SQL migration history: `drizzle/migrations/`
- Database schema source: `drizzle/schema.ts`
- Supabase project configuration: `supabase/config.toml`
- SQL authorization checks: `supabase/tests/authorization_test.sql`
- Isolated integration/concurrency checks: `supabase/tests/concurrency.ts`

Review migrations before applying them. Tests that need elevated credentials or mutate data must be run only against a dedicated disposable project and must have cleanup configured.

## Code organization

- `src/components/`: reusable event forms, cover components, and UI primitives.
- `src/routes/`: public and protected page components.
- `src/lib/`: shared auth, role navigation, certificate, error handling, and formatting helpers.
- `src/integrations/supabase/`: Supabase client configuration and server-side auth middleware.
- `src/test/`: deterministic unit tests for routes and application decisions.

## Local configuration

Copy `.env.example` to `.env` and configure values for your own Supabase project. Keep server secrets outside the browser bundle; only the publishable key belongs in client configuration. Never commit `.env` or use a production service-role key in tests.
