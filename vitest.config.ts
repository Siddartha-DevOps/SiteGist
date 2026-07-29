// Plain-object config (no `vitest/config` import) so `npx vitest` can load it
// without vitest being installed in the project's node_modules. Scopes the run
// to the co-located app unit tests and excludes the Playwright e2e specs (whose
// default glob would otherwise be picked up).
export default {
  test: {
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
    environment: "node",
  },
};
