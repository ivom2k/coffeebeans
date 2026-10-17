import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

const withClient = async (url: string, work: (client: Client) => Promise<unknown>) => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await work(client);
  } finally {
    await client.end();
  }
};

// Runs once before all test files: a brand-new test database with every migration
// applied, so each run also proves the migrations work on an empty database.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set (see .env.example).');
  }

  // This drops the database, so refuse anything that isn't plainly a test database.
  const name = new URL(url).pathname.slice(1);
  if (!/^[a-z][a-z0-9_]*_test$/.test(name)) {
    throw new Error(`TEST_DATABASE_URL must name a database ending in _test, got "${name}".`);
  }

  // A database can't be dropped by a connection to itself, so go through the
  // maintenance database. FORCE also ends any other open connection (e.g. DBeaver).
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = '/postgres';
  await withClient(maintenanceUrl.toString(), async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  });

  await withClient(url, client =>
    migrate(drizzle({ client }), { migrationsFolder: 'server/db/migrations' }));
}
