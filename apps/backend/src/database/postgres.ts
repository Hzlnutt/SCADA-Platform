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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS water_telemetry (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        water_m3 NUMERIC(15,3),
        id_device VARCHAR(50) NOT NULL
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_running_hours (
        tag_id VARCHAR(100) PRIMARY KEY,
        total_running_hours NUMERIC NOT NULL DEFAULT 0.0,
        last_state BOOLEAN NOT NULL DEFAULT FALSE,
        last_changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS global_configs (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS running_hours_baselines (
        unit_id VARCHAR(50) NOT NULL,
        motor_key VARCHAR(50) NOT NULL,
        target_hours DOUBLE PRECISION NOT NULL,
        task_name VARCHAR(255) NOT NULL,
        baseline_hours DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        PRIMARY KEY (unit_id, motor_key, target_hours, task_name)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS running_hours_tasks (
        id SERIAL PRIMARY KEY,
        unit_id VARCHAR(50) NOT NULL,
        motor_key VARCHAR(50) NOT NULL,
        target_hours DOUBLE PRECISION NOT NULL,
        warning_hours DOUBLE PRECISION NOT NULL,
        task_name VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        trigger_base_hours DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        actual_hours_at_trigger DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        completed_at TIMESTAMP WITHOUT TIME ZONE,
        completion_status VARCHAR(50),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_rules (
        unit_id VARCHAR(50) NOT NULL,
        tag_key VARCHAR(100) NOT NULL,
        tag_name VARCHAR(100) NOT NULL,
        low_limit NUMERIC,
        baseline NUMERIC,
        high_limit NUMERIC,
        unit VARCHAR(20),
        enable_alert BOOLEAN NOT NULL DEFAULT TRUE,
        suppress_alert BOOLEAN NOT NULL DEFAULT FALSE,
        direction VARCHAR(20) NOT NULL DEFAULT 'above',
        PRIMARY KEY (unit_id, tag_key)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS alarms (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        alarm_key VARCHAR(100) NOT NULL,
        tag_id VARCHAR(100) NOT NULL,
        device_id VARCHAR(100),
        unit_id VARCHAR(50),
        area VARCHAR(100),
        message VARCHAR(255) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        operator_name VARCHAR(100),
        operator_action VARCHAR(255),
        approver VARCHAR(100),
        rtn VARCHAR(50),
        cleared_at TIMESTAMP WITHOUT TIME ZONE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_sources (
        id SERIAL PRIMARY KEY,
        unit_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        method VARCHAR(10) NOT NULL DEFAULT 'GET',
        headers JSONB DEFAULT '{}'::jsonb,
        polling_interval_ms INT NOT NULL DEFAULT 2000,
        selected_fields JSONB DEFAULT '[]'::jsonb,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        mode VARCHAR(20) NOT NULL DEFAULT 'test',
        last_tested_at TIMESTAMP WITHOUT TIME ZONE,
        last_test_status INT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    logger.info("postgres tables (telemetry, running hours, global configs, sensor rules, alarms, api sources) ensured");
  } catch (err: any) {
    logger.error({ err }, "failed to ensure postgres tables");
  }
};
