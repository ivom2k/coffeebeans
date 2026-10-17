import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Vitest doesn't put .env into process.env. CI has no .env file and sets the variables directly.
if (existsSync('.env')) {
  process.loadEnvFile();
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    globalSetup: ['server/db/tests/global-setup.ts'],
    // All test files share one database. Running them one at a time keeps lock waits
    // between their transactions out of the picture.
    fileParallelism: false,
  },
});
