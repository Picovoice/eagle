import { defineConfig } from 'cypress';

export default defineConfig({
  env: {
    NUM_TEST_ITERATIONS: 20,
    ENROLL_PERFORMANCE_THRESHOLD_SEC: 0.6,
    PROCESS_PERFORMANCE_THRESHOLD_SEC: 0.6,
  },
  e2e: {
    supportFile: 'cypress/support/index.ts',
    specPattern: 'test/*.test.{js,jsx,ts,tsx}',
    video: false,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 10000,
  },
});
