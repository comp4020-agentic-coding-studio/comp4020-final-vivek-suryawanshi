import { defineConfig } from "vitest/config";

// Every test in spec/ runs against the running app, which spec/global-setup.ts
// finds. Only spec/ runs: a test anywhere else needs adding to `include`.
// Several files share that one running app's mutable state (the single
// pending-delivery slot), so files run one at a time rather than in parallel
// — otherwise one file's delivery/predict calls interleave with another's.
export default defineConfig({
  test: {
    include: ["spec/**/*.test.ts"],
    globalSetup: ["./spec/global-setup.ts"],
    fileParallelism: false,
  },
});
