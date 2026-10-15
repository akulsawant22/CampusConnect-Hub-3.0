# CampusConnect roadmap

Done

- [x] Design system, landing, auth (email + Google), protected dashboard shell
- [x] Schema + RLS + trusted DB functions
- [ ] HISTORICAL ONLY (earlier session, not rerun): 18 SQL permission tests passed (supabase/tests/authorization_test.sql)
- [ ] HISTORICAL ONLY (earlier session, not rerun; fixture accounts since deleted): 20 live concurrency/storage tests passed (supabase/tests/concurrency.ts)
- [x] Student, organizer, admin, volunteer screens; browser-tested per role
- [x] Event cover uploads (private bucket, manager-only writes, signed URLs)

Open (blocked)

- [ ] Email sign-up confirmation end to end — needs a real inbox to click the link
- [ ] Google sign-in end to end — needs a real Google account in an interactive browser
- [ ] Camera scanning on a physical device — headless browser has no camera

## Launch readiness (Oct 13, evidence-based)

- [x] Sign-up confirmation link returns to the public home page (was a protected page)
- [x] Forgot-password link + /reset-password page
- [x] Live test script fails closed unless CC_TEST_ENV=disposable, CC_TEST_BACKEND_URL matches, not the production URL, and a test-backend cleanup key is present; try/finally cleanup of all rows/files it creates
- [x] docs/INITIAL_ADMIN_SETUP.md (one-time trusted admin bootstrap)
- [x] Typecheck pass; vitest 1/1 pass; ESLint: 873 auto-fixable formatting + 1 prefer-const, no logic errors
- [ ] BLOCKED / NOT RERUN: SQL permission tests + live concurrency tests — no disposable test environment exists
- [ ] BLOCKED: real-inbox sign-up/reset, Google sign-in, camera scanning, first admin (owner action)
- [x] Oct 13 20:03 UTC: 18 SQL authorization tests run transactionally by the owner via the database runner — ALL TESTS PASSED, fixtures rolled back (verified absent before/after)
- [x] Route coverage test (src/test/route-coverage.test.tsx): 12/12 vitest pass — route matching only, not authorization
- [x] Browser smoke (signed out): /, /auth, /reset-password load with no errors; /dashboard and /dashboard/admin redirect to /auth
- [x] Oct 13 20:25 UTC: inline sign-in errors + duplicate-submit guard, session confirmed before entering app, /staff-login with role check, dashboard error/timeout states, role-derived nav (src/lib/nav.ts) + tests 19/19
- [ ] BLOCKED: real successful sign-in not tested (no credentials); first admin still needs owner SQL
- [x] Oct 13 20:40 UTC: sign-in path trimmed (uses sign-in response session, seeds account data, gate re-validates with existing token), time limits on sign-in/session/gate + visible gate error screen; tests 26/26. Successful sign-in verified only with a simulated account in the browser, not a real one.
