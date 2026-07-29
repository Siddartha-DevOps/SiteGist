import { defineConfig } from "vitest/config";

// Unit tests are co-located with the code they cover (app/**/*.test.ts) and
// import their targets by relative path, so no path-alias or Prisma setup is
// needed — they stay fast and hermetic.
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
    environment: "node",
  },
});
