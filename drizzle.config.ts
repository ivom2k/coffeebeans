import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit doesn't read .env itself. CI has no .env file and sets the variable directly.
if (existsSync('.env')) {
  process.loadEnvFile();
}

const url = process.env.NUXT_DATABASE_URL;
if (!url) {
  throw new Error('NUXT_DATABASE_URL is not set. Copy it from .env.example into .env.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema/index.ts',
  out: './server/db/migrations',
  dbCredentials: { url },
});
