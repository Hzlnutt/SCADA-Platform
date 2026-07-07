import { Pool, types } from "pg";
import { env } from "../config/env.config";
import { logger } from "../config/logger.config";

// Parse OID 1114 (timestamp without time zone) by treating it as WIB (+07:00) local time.
// This aligns timezone-naive database values with the application's timezone helpers.
types.setTypeParser(1114, (str) => {
  return new Date(str.replace(" ", "T") + "+07:00");
});

let pool: Pool | null = null;

export const getPostgresPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      host: env.postgresHost,
      port: env.postgresPort,
      user: env.postgresUser,
      password: env.postgresPassword,
      database: env.postgresDb,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    pool.on("error", (err) => {
      logger.error({ err }, "Unexpected error on idle postgres client");
    });
  }
  return pool;
};

export const closePostgres = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
