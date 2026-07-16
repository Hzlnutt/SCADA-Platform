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

export const ensurePostgresTables = async () => {
  const pool = getPostgresPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cooling_tower_telemetry (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        id_device VARCHAR(50) NOT NULL,
        press_ct_p1 NUMERIC,
        status_mtr_washing BOOLEAN,
        status_fan_ct2 BOOLEAN,
        status_fan_ct3 BOOLEAN,
        status_mtr_st3_p3 BOOLEAN,
        press_ct_p2 NUMERIC,
        scaled_press_prepu3 NUMERIC,
        scaled_press_ct_p1 NUMERIC,
        scaled_press_ct_p2 NUMERIC,
        status_fan_ct1 BOOLEAN,
        status_mtr_du45 BOOLEAN,
        scaled_press_st3 NUMERIC,
        press_ct3_p11 NUMERIC,
        scaled_press_ct3_p11 NUMERIC,
        status_mtr_ct_p1 BOOLEAN,
        status_mtr_ct_p2 BOOLEAN,
        scaled_press_bp NUMERIC,
        status_mtr_prep3 BOOLEAN,
        scaled_press_washing NUMERIC,
        status_mtr_ct_p11 BOOLEAN,
        scaled_press_duu3 NUMERIC,
        scaled_level_tank_cooling3 NUMERIC,
        status_mtr_bp BOOLEAN
      );
    `);
    logger.info("cooling_tower_telemetry postgres table ensured");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS water_telemetry (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        water_m3 NUMERIC(15,3),
        id_device VARCHAR(50) NOT NULL
      );
    `);
    logger.info("water_telemetry postgres table ensured");
  } catch (err: any) {
    logger.error({ err }, "failed to ensure postgres tables");
  }
};
