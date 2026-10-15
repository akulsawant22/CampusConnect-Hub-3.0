# Original User Request

## Initial Request — 2026-10-15T15:47:02+05:30

CampusConnect Hub 3.0 is a role-aware campus event management web application. This task is a production-grade full-stack audit, repair, and UI refinement of the **existing local codebase** — not a rebuild. The result must be reliable, secure, responsive, maintainable, and ready for a carefully verified production release.

Working directory: `c:\Users\omgar\Downloads\campus connect`
Integrity mode: **development**

---

## RESOLVED DECISIONS

| Decision                 | Choice                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase credentials** | Credentials will be added to `.env` before launch — run all live tests against a dedicated disposable project. Never run destructive tests against production. |
| **UI scope**             | Polish the existing design system only: fix bugs, improve consistency, tighten spacing and typography. Do not overhaul the visual identity.                    |
| **CI secrets**           | Audit and document required secrets only — do not add real values to workflow YAML or source code.                                                             |

---

## ROLE

Act as a senior full-stack engineer, application security engineer, PostgreSQL/Supabase specialist, QA automation engineer, and senior frontend design engineer.

You are working on the existing repository at the working directory above.

Your mission is to comprehensively audit, repair, test, and refine this actual application. Do not merely return recommendations or a plan. Inspect the existing code and implement the fixes.

## 1. PROJECT CONTEXT AND NON-NEGOTIABLE RULES

The repository currently uses:

- React 19 and TypeScript.
- Vite and TanStack Start/Router.
- TanStack Query.
- Tailwind CSS v4 and Radix UI-based components.
- Supabase Auth, PostgreSQL, Storage, and RLS.
- Drizzle migration assets.
- Vitest, Testing Library, and ESLint.
- QR ticket scanning, certificates, notifications, event dashboards, and analytics.

Rules:

1. Preserve working features and the current technology stack unless evidence demonstrates a compelling reason to change something.
2. Do not rebuild the application from scratch.
3. Do not make speculative schema changes, delete existing columns, or replace working authentication.
4. Do not bypass RLS to make a feature work.
5. Do not expose service-role keys, database credentials, auth tokens, ticket secrets, or personal data.
6. Never test privileged or destructive operations against production.
7. Never claim a test passed unless it was actually executed and its result verified.
8. Do not stop after producing an audit report. Implement safe, verified fixes.
9. Use small, focused changes and retain backward compatibility wherever practical.
10. Do not blindly install or invoke every listed skill. Discover which skills are installed, compatible, and relevant; use them selectively.

Create a prioritized audit report and implementation checklist, then proceed with implementation without waiting for human approval of every ordinary code change. Stop only when a genuinely destructive action, production-only operation, or missing external credential requires human involvement.

## 2. USE THESE SKILLS INTELLIGENTLY

Inspect the following skill repositories and use their compatible workflows, instructions, and tools where available.

### Engineering, architecture, debugging, and review

- https://github.com/obra/superpowers
- https://github.com/affaan-m/ECC
- https://github.com/multica-ai/andrej-karpathy-skills
- https://github.com/addyosmani/agent-skills
- https://github.com/thedotmack/claude-mem
- https://github.com/safishamsi/graphify
- https://github.com/JuliusBrussee/caveman
- https://github.com/DietrichGebert/ponytail
- https://github.com/karpathy/llm-council

Apply the relevant principles:

- Inspect before changing.
- Use test-driven development: write a failing regression test, implement the smallest effective fix, rerun tests.
- Plan work as small, independently verifiable tasks.
- Trace dependencies and data flow through the frontend, authentication layer, RPC functions, database, storage, and UI.
- Prefer simple code and minimal abstractions.
- Review your own changes for logic errors, security gaps, regressions, and unnecessary complexity.
- Do not use persistent memory tools unless they are actually supported and needed by the current agent environment.
- Do not introduce external AI APIs or additional paid services simply because a listed repository uses them.

### Frontend quality, design, and motion

- https://github.com/kylezantos/design-motion-principles
- https://github.com/Leonxlnx/taste-skill
- https://github.com/pbakaus/impeccable
- https://github.com/emilkowalski/skill
- https://github.com/ibelick/motion-primitives

Use these to guide:

- A distinctive, coherent visual system.
- Typography, spacing, contrast, hierarchy, and alignment.
- Clean dashboard layouts and consistent tables, forms, buttons, dialogs, and navigation.
- Purposeful transitions and feedback for meaningful user actions.
- Responsive behavior and accessible reduced-motion handling.
- Visual auditing rather than assuming a page looks correct because it compiles.

For every repository:

1. Inspect its README and actual skill/instruction files.
2. Verify installation and compatibility with Antigravity and this repository.
3. Reuse useful guidance and components only when appropriate.
4. Do not assume a GitHub repository is already installed as a local skill.
5. Do not copy unrelated applications or their dependencies into CampusConnect.

## 3. PHASE A — COMPLETE PROJECT INVENTORY AND BASELINE

Inspect all relevant source files, routes, hooks, components, SQL migrations, environment handling, and tests.

Trace these complete flows:

A. Account creation → email confirmation → profile/role creation → sign-in → protected dashboard.

B. Student event discovery → registration → registration record → ticket creation → ticket display.

C. Cancellation → seat release → registration state → ticket behavior.

D. Ticket QR scanning → token validation → authorization → attendance creation → duplicate-scan handling.

E. Organizer event creation/editing → image upload → publication → attendee and event management.

F. Admin user management → role assignment → volunteer assignment → audit log.

G. Password reset and Google OAuth → callback → session confirmation → correct destination.

H. Notifications, feedback, certificates, and dashboard analytics.

For each flow, verify that the UI, query or mutation, authorization checks, database operation, and resulting user-facing state agree.

Run and record the baseline results of:

- TypeScript type checking.
- Unit and component tests.
- ESLint.
- Production build.
- Existing SQL authorization tests, using an isolated database where required.
- Existing live concurrency tests, only with a dedicated disposable backend.
- Browser smoke tests for all accessible routes.

Identify:

- Existing failures versus newly introduced failures.
- Incorrect data assumptions.
- Missing or stale generated types.
- Duplicated logic.
- Dead links, broken controls, missing loading states, and swallowed errors.
- Database queries that ignore errors.
- Migration inconsistencies.
- Features documented as tested but not verified by the current run.

Do not infer that production is healthy from an earlier roadmap entry.

## 4. PHASE B — REGISTRATION CONCURRENCY AND DATA INTEGRITY (P0)

Audit the existing database function:

`public.register_for_event(_event_id uuid)`

Review its implementation in all migration versions, especially the original function and subsequent repair migration. Determine which migration represents the currently intended implementation.

Required behavior:

1. Only an authenticated, authorized student may register.
2. The event must exist and be open for registration.
3. The registration deadline and capacity must be checked using trusted database state.
4. Two students competing for the final seat must never both obtain confirmed registrations.
5. The same student submitting multiple concurrent requests must never create multiple registrations or tickets for the same event.
6. Registration, ticket creation, and related database updates must be atomic.
7. A failed operation must not leave a partial registration, orphan ticket, duplicate notification, or inconsistent audit state.
8. Re-registering after cancellation must be handled deliberately and safely.
9. Cancelling a registration must release the seat correctly and prevent inappropriate ticket use.
10. Scanning a cancelled or previously used ticket must not produce a successful check-in.
11. Return clear, safe, actionable errors to the frontend.

### Database implementation

- Preserve or strengthen the event-row locking strategy.
- Keep capacity checking and the registration mutation inside one transaction.
- Verify that cancellation and all other capacity-changing operations obey the same consistency rules.
- Retain a suitable unique constraint for `(event_id, user_id)`.
- Enforce foreign keys and appropriate status constraints.
- Consider an idempotency strategy only where it improves behavior without creating unnecessary complexity.
- Ensure all trusted functions have an explicit safe `search_path`.
- Inspect `SECURITY DEFINER` grants. Grant execution only to the appropriate roles.
- Prevent untrusted callers from supplying another user's identity in a trusted registration operation.
- Ensure every registration change has consistent ticket and audit behavior.

Do not blindly rewrite the existing function. First understand it and identify the smallest correct repair.

### Concurrency regression tests

Extend the existing test suite with reproducible tests using multiple simultaneous authenticated requests.

Cover:

- Event capacity of one with several competing students.
- Capacity N with more than N simultaneous registration attempts.
- Repeated simultaneous registration by the same student.
- Registration while the deadline passes or the event becomes unavailable.
- Concurrent registration and cancellation.
- Concurrent re-registration after cancellation.
- Failure during ticket or notification creation.
- Concurrent QR scans for the same ticket.
- Ticket state after registration cancellation.

Assertions:

- Active registrations never exceed event capacity.
- The same user has at most one registration per event.
- Each valid active registration has the appropriate single ticket.
- A committed operation leaves consistent related records.
- A rejected operation leaves no partial writes.
- Each ticket produces at most one successful check-in.

Run the tests only in a dedicated disposable Supabase project or isolated database. Include explicit environment guards, cleanup, and a production URL denylist. If test credentials or infrastructure are missing, improve the tests and documentation but clearly report that live execution remains blocked.

## 5. PHASE C — FRONTEND AND BACKEND VALIDATION

Audit every important form, RPC call, route action, database mutation, query, and upload.

### Frontend validation

Implement consistent validation for:

- Sign-up and sign-in.
- Email and password reset.
- Event creation and editing.
- Event title, description, venue, category, dates, deadlines, and capacity.
- Registration and cancellation actions.
- Feedback.
- Volunteer assignments.
- Admin role changes.
- File upload type, size, and user-visible failure.
- QR scanner input.
- Search, filters, pagination, and query parameters.

Rules:

- Prefer a project-compatible schema validator such as Zod if it is already present.
- Display useful field-specific validation messages.
- Prevent duplicate submissions while a mutation is pending.
- Disable invalid actions where appropriate.
- Preserve valid input when recoverable server errors occur.
- Do not rely on browser validation alone.
- Avoid permissive type coercion and silent fallback values.
- Ensure errors are accessible to screen readers.

### Backend and database validation

Repeat validation at every trusted boundary.

Verify:

- UUID and identifier validation.
- Required fields, string length, enum/status values, date ordering, valid deadline, and capacity limits.
- Ownership and role permissions.
- Event-state transition rules.
- Ticket and attendance integrity.
- Upload constraints and storage path ownership.
- Query parameter handling and pagination limits.
- Safe error responses with no secret or internal stack-trace leakage.

Enforce invariant data rules through PostgreSQL constraints and trusted functions where appropriate.

Never let the client decide its authoritative role, owner ID, registration count, capacity, attendance status, or ticket validity.

For each mutation, document:

1. Its input contract.
2. Its authorization requirement.
3. Its database invariant.
4. Its expected success result.
5. Its failure behavior.
6. Its regression test.

## 6. PHASE D — DATABASE SECURITY AND ROW-LEVEL SECURITY (P0)

Audit every table, grant, RLS policy, RPC, trigger, view, and storage policy.

Prioritize:

- `profiles`
- `user_roles`
- `events`
- `event_staff`
- `registrations`
- `tickets`
- `attendance`
- `certificates`
- `feedback`
- `notifications`
- `audit_logs`
- Storage buckets and associated policies.

### Authorization matrix

Create an explicit role and capability matrix for:

- Anonymous visitor.
- Authenticated student.
- Event organizer.
- Event-specific volunteer.
- Administrator.

For every table and mutation, specify who may read, insert, update, and delete each class of data.

Verify at minimum:

1. A student cannot grant themselves an organizer or admin role.
2. A student cannot alter another person's profile or role.
3. A student cannot create an arbitrary registration directly through the table API.
4. A user cannot read another user's private ticket token.
5. A volunteer can access only the capabilities explicitly granted for assigned events.
6. An organizer cannot manage an event owned by an unrelated organizer unless authorized as admin.
7. A role change cannot be made through a client-side shortcut or direct database API call.
8. Audit entries cannot be forged or modified by ordinary users.
9. Notifications are private to their recipient.
10. Feedback and certificates comply with actual event participation requirements.
11. Storage upload, replacement, download, and deletion follow event ownership and authorization rules.
12. Privileged RPCs reject anonymous callers and unauthorized roles.
13. Policies do not accidentally broaden access through permissive policy combinations.
14. Updates cannot change protected ownership columns by exploiting an overly broad `UPDATE` grant.

Pay special attention to the difference between table-level privileges and RLS: a policy permitting a row update may be too broad if the user should only update a subset of its columns.

Review `SECURITY DEFINER` routines for:

- A fixed trusted `search_path`.
- Minimal execution grants.
- Explicit actor identity from `auth.uid()` where relevant.
- Ownership and role verification inside the function.
- Safe treatment of all caller-supplied IDs.
- No trust in user metadata as an authoritative role.
- Correct audit behavior.

Use both positive and negative tests. A successful admin query is not enough; verify that unauthorized student and volunteer requests are rejected.

## 7. PHASE E — DATABASE COLUMNS, RELATIONSHIPS, AND MIGRATIONS

Audit the full database schema and generated types.

Produce a schema inventory with:

- Table and column names.
- Types and nullability.
- Defaults.
- Primary and foreign keys.
- Unique constraints and check constraints.
- Indexes.
- RLS enablement and policies.
- Table grants.
- Triggers.
- Functions and their grants.
- Referencing frontend queries and mutations.
- Sensitive-data classification.

Inspect high-value relationships and constraints:

- `registrations(event_id, user_id)` uniqueness.
- Registration and ticket cardinality.
- Ticket user and registration consistency.
- Attendance relation to registration, event, and user.
- Certificate eligibility and uniqueness.
- Feedback eligibility and uniqueness.
- `event_staff(event_id, user_id)` uniqueness.
- User-role uniqueness and least privilege.
- Owner fields such as `organizer_id`.
- Date and event-status invariants.

Check for missing compound indexes, inefficient count queries, inconsistent foreign-key behavior, and unnecessarily broad column access.

### Migration rules

- Never modify a previously applied migration just to make a new change appear simpler.
- Add new ordered migrations for corrections.
- Preserve existing user data.
- Ensure migrations work on a fresh project and explain requirements for upgrading an existing project.
- Avoid destructive `DROP COLUMN`, table recreation, or irreversible data transformations without strong justification.
- Reconcile `drizzle/schema.ts`, SQL migration history, Supabase generated types, and actual queries.
- If one file is generated or intentionally partial, follow the project's established generation workflow rather than hand-editing generated output.
- Add tests for the new constraints, grants, triggers, and policies.
- Document migration order, deployment prerequisites, and rollback or recovery procedures.

Do not apply unverified migrations to the production database.

## 8. PHASE F — AUTHENTICATION AND SESSION MANAGEMENT

Audit email/password sign-in, sign-up, email confirmation, password reset, Google OAuth, staff sign-in, and all protected routes.

Check:

- Server-side token verification.
- Session loading and refreshing.
- Expired or malformed tokens.
- Invalid OAuth callbacks and redirect targets.
- Email confirmation destinations.
- Reset-password token handling.
- Signed-out access to protected routes.
- Role changes while a session is active.
- Race conditions during the session gate.
- Multiple sign-in clicks.
- Timeout and recoverable network failures.
- Logout and stale client cache state.

A client-side route guard is useful for navigation, but database policies must remain authoritative.

Review `src/integrations/supabase/auth-middleware.ts` and all callers carefully. If the middleware is generated, trace and edit its source generator rather than making a non-durable change.

Show clear loading, unauthorized, session-expired, and recoverable failure states.

Do not require real production credentials to validate all local unit tests. For live provider-specific testing, use authorized test accounts and clearly state what could not be verified.

## 9. PHASE G — UI BREAKAGE AND COMPLETE RESPONSIVE AUDIT

Inspect the running application in the available browser. Do not merely read the JSX and assume it renders correctly.

Audit:

- Public landing page.
- Authentication and password-reset forms.
- Student dashboard.
- Event browsing and details.
- Tickets and certificates.
- Organizer event management.
- Event creation and edit dialogs.
- Volunteer workflows.
- QR scanner.
- Admin users, roles, analytics, and audit logs.
- Notifications and feedback.
- Empty, loading, error, permission-denied, and no-results states.

Test at representative widths:

- 320–375 px mobile.
- 390–430 px mobile.
- 768 px tablet.
- 1024 px laptop.
- 1280–1440 px desktop.
- Larger desktop screens.

Find and fix:

- Horizontal overflow.
- Clipped dialogs and dropdowns.
- Broken flex/grid layouts.
- Oversized tables.
- Cards with inconsistent heights or spacing.
- Buttons with inappropriate dimensions.
- Forms escaping their containers.
- Text wrapping and long-word overflow.
- Mobile sidebar/navigation issues.
- Sticky headers hiding important content.
- Dropdowns behind dialogs due to stacking context.
- Incorrect scroll behavior.
- Broken empty states.
- Images with missing or incorrect aspect ratios.
- Console errors and failed network requests.
- Incorrect loading and success feedback.
- Layout shifts and inaccessible controls.

Use the current component library and shared design tokens instead of adding duplicated styling systems.

### Visual quality target

Make the existing UI visibly more polished without sacrificing functionality:

- A consistent type scale and spacing system.
- Strong page and section hierarchy.
- Clear primary, secondary, destructive, and disabled actions.
- Consistent button, input, card, table, badge, and dialog styles.
- Responsive dashboards with usable information density.
- Clear empty states and meaningful skeletons.
- Carefully chosen contrast and focus states.
- Purposeful animation rather than excessive decorative motion.
- Respect for `prefers-reduced-motion`.
- Keyboard-accessible navigation, dialogs, menus, and forms.
- A coherent and professional campus-event product identity.

Use Impeccable and Taste Skill guidance where compatible. Apply motion principles and Motion Primitives only when useful.

Do not replace the whole design with an unrelated generic SaaS template. Preserve the application's purpose and information architecture.

## 10. PHASE H — API, QUERIES, ERROR HANDLING, AND PERFORMANCE

Review all Supabase queries, RPC calls, uploads, mutations, and TanStack Query usage.

Search for:

- Queries that access `.data` without checking `.error`.
- Incorrect null/undefined assumptions.
- Silent catch blocks.
- Stale cache after mutations.
- Duplicate fetches.
- Infinite or repeated requests.
- Unbounded lists.
- Missing pagination.
- Over-fetching unrelated data.
- Expensive dashboard aggregation in the browser.
- Repeated queries that can be safely consolidated.
- Missing timeouts for external operations.
- Broken retries or optimistic updates.
- Unsafe assumptions about API result shape.
- Inconsistent error formatting.

Ensure:

- Relevant queries have stable keys.
- Mutations invalidate or update the correct cache.
- Retries are not applied indiscriminately to non-idempotent mutations.
- Forms cannot create duplicates by submitting repeatedly.
- Dashboard counts are accurate and adequately scoped.
- Loading and error states are distinct.
- Sensitive errors are logged carefully without recording credentials or personal data unnecessarily.

Do not add an entirely new backend architecture if trusted Supabase functions already provide the correct boundary.

## 11. PHASE I — ACCESSIBILITY AND AUTOMATED QUALITY

Check for:

- Semantic headings and landmarks.
- Correct input labels.
- Keyboard-only operation.
- Visible keyboard focus.
- Dialog focus management.
- Accessible error announcements.
- Color contrast.
- Button names and icon-only tooltips.
- Accessible tables and charts.
- Motion preference handling.
- QR scanner permissions and a useful non-camera fallback where practical.

Add targeted automated tests for:

- Validation helpers.
- User-visible errors.
- Form submission and duplicate-submit blocking.
- Permission-aware UI.
- Route authorization behavior.
- Query and mutation outcomes.
- Component rendering at narrow widths.
- Critical user flows.

Do not over-rely on snapshots. Prefer meaningful behavior assertions.

## 12. PHASE J — REQUIRED TEST SUITE

Use the existing project tooling and add tests only where there is a meaningful gap.

### Frontend tests

Cover:

- Valid and invalid forms.
- Loading and error states.
- Sign-in, sign-out, and password reset paths.
- Role-aware navigation.
- Organizer versus student permissions.
- Registration and cancellation feedback.
- Query failures and empty data.
- Modal and dropdown behavior.
- Ticket and scan result states.
- Mobile rendering of important screens.

### Database and integration tests

Cover:

- RLS positive and negative cases.
- Unauthorized direct table mutations.
- Role escalation attempts.
- Registration uniqueness.
- Concurrent capacity enforcement.
- Cancellation and re-registration.
- Ticket creation and cancellation consistency.
- Duplicate scanning.
- Volunteer access boundaries.
- Audit log protections.
- Storage access control.
- Migration correctness.

### End-to-end checks

Use the available browser automation framework if installed. If not, determine whether a compatible tool is available before adding dependencies.

Test full critical paths with dedicated fixtures and authorized test accounts. Do not fabricate a successful external OAuth flow or live camera test in a headless environment.

## 13. PHASE K — CONTINUOUS INTEGRATION AND RELEASE READINESS

Inspect `.github/workflows/ci.yml` and the scripts in `package.json`.

Ensure CI runs the available equivalent of:

- Dependency installation with the committed Bun lockfile.
- Type checking.
- Unit and component tests.
- Linting.
- Production build.
- Static security checks where appropriate.
- Database or integration checks only when safe test infrastructure is available.

Never place privileged credentials directly in workflow YAML or source code.

Document required secrets and use protected CI configuration. Ensure production secrets never reach Vite client bundles.

Do not make CI depend on private developer credentials or an inaccessible database.

If a genuine blocker prevents a check, preserve the check as an explicitly blocked result rather than hiding or silently skipping it.

## 14. PHASE L — VISUAL VERIFICATION AND FINAL SELF-REVIEW

After implementation:

1. Run the relevant tests again.
2. Run type checking, lint, and the production build.
3. Re-run new regression tests.
4. Revisit affected screens in the browser.
5. Inspect browser console output and failed network requests.
6. Verify responsive breakpoints.
7. Check that no unrelated routes or features regressed.
8. Review the final diff for accidental scope expansion.
9. Check for exposed credentials, insecure defaults, debug output, and accidental changes to generated files.
10. Update relevant documentation and the roadmap with actual results.

If a test fails, diagnose the root cause and fix it. Do not simply weaken or delete the assertion.

## 15. DEFINITION OF DONE

The work is complete only when:

- Every identified issue has a documented status.
- P0 security and registration-integrity fixes have regression tests.
- Frontend and backend validation are both verified.
- Database columns and relationships have been reviewed against actual use.
- Role boundaries are tested, including unauthorized attempts.
- Critical routes and forms work at desktop and mobile widths.
- Type checking, linting, automated tests, and production build have been executed.
- Available live concurrency tests have been run safely, or their infrastructure blocker is documented.
- Existing features, authentication, migration history, and application architecture remain intact unless a change was justified.
- Documentation states exactly how to reproduce verification.

## 16. FINAL REPORT FORMAT

At the end, provide:

### A. Summary

What was audited, what was repaired, and what remains blocked.

### B. Issues discovered

For each issue:

- Severity: P0/P1/P2/P3.
- File/function/table/route.
- Root cause.
- Fix implemented.
- Test proving the fix.

### C. Database changes

List each new migration, affected tables and columns, constraints, indexes, policies, functions, and deployment requirements.

### D. Registration concurrency proof

Report exact test setup, number of concurrent users/requests, capacity, resulting active registrations, duplicate handling, and ticket consistency. Distinguish simulated/unit tests from live database tests.

### E. UI audit

List repaired screens and viewport sizes tested.

### F. Test results

Report exact outcomes for type checking, tests, lint, build, RLS tests, integration tests, and browser checks. Include failures.

### G. Outstanding blockers

Identify missing credentials, unavailable services, manual OAuth/camera steps, or production actions requiring the owner.

### H. Manual deployment steps

List the exact migrations and environment configuration the project owner must perform. Never claim deployment has happened unless it has actually happened.

Start by examining the existing workspace and running the baseline checks. Then work through the phases in priority order, implementing and verifying each fix before proceeding to lower-priority polish.

## Follow-up — 2026-10-15T15:58:36+05:30

Additional instruction from the project owner:

After all phases are complete and the final report (sections A–H) has been produced, commit all changes to the local git repository and push to GitHub.

Requirements for the commit:

1. Stage all modified and new files (excluding `.env`, any credential files, and generated lockfiles that weren't already tracked).
2. Write a clear, descriptive commit message summarizing what was audited and fixed (e.g., "audit: P0 security fixes, registration concurrency, validation, UI polish, CI improvements").
3. Push to the existing remote (`origin`) on the current branch.
4. Report the exact commit hash and push result in the final report.

Do NOT push if:

- Any P0 security issue remains unresolved.
- Credentials or secrets are staged for commit.
- The production build is broken.
- Type checking has unresolved errors introduced by the team's changes.

## Follow-up — 2026-10-15T16:24:05+05:30

Explicit instruction from the project owner:

Do NOT stop at auditing or documenting issues. Every identified issue — P0, P1, P2, and P3 — must be fully implemented and fixed in the codebase before the final commit and push.

This includes:

- All P0 security vulnerabilities (race conditions, mutable search_path, etc.)
- All P1 authorization gaps (overly permissive grants, RLS gaps)
- All P2 issues (validation gaps, missing error states, stale cache, etc.)
- All P3 issues (UI polish, accessibility, formatting, empty states, etc.)

For each fix:

1. Implement the smallest correct repair.
2. Write or update a regression test proving the fix.
3. Verify the fix does not break existing tests, typecheck, or build.
4. Document the fix in the final report.

Do not mark any issue as "documented" or "deferred" unless it is genuinely blocked by missing external credentials or a production-only action that cannot be safely performed locally. In those cases, clearly state the exact blocker.

After all issues are fixed and verified, commit and push to GitHub as previously instructed.

## Follow-up — 2026-10-15T16:03:40Z

Status update from parent agent:

The transient network crash has been resolved. The Gen 1 work (Phases A, B partial, D partial) has been committed and pushed to GitHub:

Commit: f6e5532
Branch: main → origin/main

What was committed:

- 115 files Prettier-normalized (ESLint: 0 errors)
- TypeScript: 0 errors (fixed 6 TS errors in concurrency.test.ts)
- Migration 0008: P0 concurrency race fix + search_path hardening
- src/test/concurrency.test.ts: 6 new concurrency regression tests
- Extended authorization_test.sql with negative RLS tests
- All 32 tests passing

Gen 2 should continue from Milestone 1 completion onward. Remaining phases:

- Phase C: Frontend & backend validation (Zod schemas, duplicate submission prevention)
- Phase E: Full schema inventory and migration review
- Phase F: Auth & session management audit
- Phase G: UI responsive audit and polish
- Phase H: API/query error handling
- Phase I: Accessibility
- Phase J: Remaining test gaps
- Phase K: CI workflow hardening
- Phase L: Final self-review

After all phases complete, commit and push again with a comprehensive final audit commit message including all issue fixes. The codebase is currently clean (0 TS errors, 0 lint errors, 32/32 tests, build passing).

## Follow-up — 2026-10-15T16:05:13Z

CRITICAL INSTRUCTION FROM PROJECT OWNER — HIGHEST PRIORITY:

Every single issue detected — P0, P1, P2, P3 — must be FULLY FIXED in the codebase, not just documented or reported. This is non-negotiable.

The workflow for EVERY issue found is:

1. DETECT the issue
2. IMPLEMENT the fix (smallest correct repair)
3. Write/update a regression test proving the fix works
4. Verify: tsc --noEmit passes, vitest passes, build passes
5. COMMIT the fix to git with a clear message
6. PUSH to origin/main immediately after each significant batch of fixes

Do NOT:

- Leave any issue as "documented" or "deferred" unless blocked by missing external credentials
- Stop after producing audit reports
- Wait until the end to commit — commit and push after each phase completes

If a fix is blocked by missing Supabase credentials or production-only action, state the EXACT blocker and continue fixing everything else.

Current clean baseline on origin/main (commit f6e5532):

- TypeScript: 0 errors
- ESLint: 0 errors
- Tests: 32/32 passing
- Build: passing

Continue through Phases C → L, fixing every issue found, committing and pushing after each phase. The final commit should leave the codebase in a fully production-ready state.
