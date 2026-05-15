import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgSourcePool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __pgReportsPool: Pool | undefined;
}

export const sourcePool =
  global.__pgSourcePool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

export const reportsPool =
  global.__pgReportsPool ??
  new Pool({
    connectionString:
      process.env.REPORTS_DATABASE_URL ?? process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgSourcePool = sourcePool;
  global.__pgReportsPool = reportsPool;
}
