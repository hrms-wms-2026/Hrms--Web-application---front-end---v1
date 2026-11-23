import { defineConfig } from 'vitest/config';

/**
 * Extra Vitest settings for `ng test` (angular.json → test.options.runnerConfig). The Angular builder supplies the
 * rest of the configuration.
 *
 * The full suite runs about 640 spec files in parallel. A few specs compile a whole page (the main layout, position
 * management) and pass in about a second on their own, but under full parallel load on a developer machine they
 * can pass 5 s, Vitest's default, and fail with "Test timed out". 15 s keeps a real hang visible.
 */
export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
