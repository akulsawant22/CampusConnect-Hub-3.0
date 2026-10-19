# Project: CampusConnect Hub 3.0 Full-Stack Audit, Repair, & Refinement

## Architecture
- Framework: React 19, TypeScript (strict mode)
- Routing: TanStack Router / TanStack Start
- State & Data: TanStack Query (React Query)
- Styling: Tailwind CSS v4, Radix UI primitives, Lucide icons
- Backend / Database: Supabase (Auth, PostgreSQL, Storage, RLS)
- Migrations: Drizzle ORM migration assets & raw SQL migrations
- Testing & Linting: Vitest, Testing Library, ESLint

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Phase A Baseline & Inventory | Complete codebase baseline, typecheck, vitest, build, lint, flow mapping | none | DONE |
| M1 | Phase B & D Concurrency & RLS (P0) | Fix check_in vs cancellation race, search_path bug, profile/notification update grants, migration 0008, Vitest concurrency simulation tests | M0 | DONE (Commit f6e5532) |
| M2 | Phase E & C Schema & Validation (P2) | DB constraints, relationships, schema inventory, frontend Zod forms, backend boundary validation, mutation contracts | M1 | DONE (Commit d36638b) |
| M3 | Phase F & H Auth, Session & Performance (P2) | Auth middleware, session recovery, TanStack Query cache invalidation, API error handling, swallowed errors, stale cache | M2 | DONE |
| M4 | Phase G & I UI Polish, Responsive & A11y (P3) | 320px-1440px responsive audit, clipping/overflow fixes, keyboard nav, manual QR fallback | M3 | PLANNED |
| M5 | Phase J, K, L Verification, Report & Release | Full test suites, CI workflow, final report A-H, non-secret git commit & push | M4 | PLANNED |

## Code Layout
- Frontend Routes & Pages: `src/routes/`
- Frontend Components & UI: `src/components/`
- Hooks & Query Logic: `src/hooks/`
- Supabase Integration: `src/integrations/supabase/`
- Database Migrations: `drizzle/migrations/`
- Schema Definition: `drizzle/schema.ts`
- Tests: `src/test/` (Vitest unit/component/concurrency), `supabase/tests/` (SQL RLS & concurrency)
- Agent Metadata: `.agents/`
