import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Fallback mock Supabase credentials for CI environments without a local .env file
process.env["VITE_SUPABASE_URL"] ??= "https://mock-ci-project.supabase.co";
process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??= "mock-publishable-key-for-tests";
process.env["SUPABASE_URL"] ??= "https://mock-ci-project.supabase.co";
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= "mock-publishable-key-for-tests";
