import { createDatabase } from '../db/client.ts';

let database: ReturnType<typeof createDatabase> | undefined;

// Created on first use rather than at import, so loading the server bundle (a build,
// prerendering) never needs a database. One pool for the whole process.
export const useDb = () => {
  database ??= createDatabase(useRuntimeConfig().databaseUrl);
  return database;
};
