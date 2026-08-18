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
        water_kwh NUMERIC(15,3),
        id_device VARCHAR(50) NOT NULL
      );
    `);

    await pool.query(`
      ALTER TABLE water_telemetry ADD COLUMN IF NOT EXISTS water_kwh NUMERIC(15,3);
    `).catch(() => {});

    await pool.query(`
      UPDATE water_telemetry SET water_kwh = water_m3 * 0.4 WHERE water_kwh IS NULL;
    `).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gas_telemetry (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        gas_sm3 NUMERIC(15,3),
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
        completed_by VARCHAR(100),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      ALTER TABLE running_hours_tasks ADD COLUMN IF NOT EXISTS completed_by VARCHAR(100);
    `).catch(() => {});

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
        t_stamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
        cleared_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Alter table to migrate existing database columns to TIMESTAMP WITH TIME ZONE
    await pool.query(`
      ALTER TABLE alarms ALTER COLUMN t_stamp TYPE TIMESTAMP WITH TIME ZONE;
      ALTER TABLE alarms ALTER COLUMN cleared_at TYPE TIMESTAMP WITH TIME ZONE;
      ALTER TABLE alarms ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE;
    `).catch((err) => {
      logger.warn({ err }, "Failed to alter alarms table columns to TIMESTAMP WITH TIME ZONE");
    });

    // Create trigger to block auto-clearing of pid-threshold alarms (e.g. from duplicate developer/old backends)
    await pool.query(`
      CREATE OR REPLACE FUNCTION block_pid_auto_resolve()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.alarm_key LIKE 'pid-threshold:%' AND NEW.status = 'Resolved' AND NEW.approver IS NULL AND NEW.operator_name IS NULL THEN
          NEW.status := OLD.status;
          NEW.cleared_at := OLD.cleared_at;
          NEW.rtn := OLD.rtn;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_block_pid_auto_resolve ON alarms;
      CREATE TRIGGER trigger_block_pid_auto_resolve
      BEFORE UPDATE ON alarms
      FOR EACH ROW
      EXECUTE FUNCTION block_pid_auto_resolve();
    `);

    // Cleanup non-cooling-water alarms and warning-level alarms
    await pool.query(`
      DELETE FROM alarms 
      WHERE unit_id NOT LIKE 'cooling-water%' 
         OR severity = 'medium';
    `).catch((err) => {
      logger.warn({ err }, "Failed to perform startup alarms cleanup");
    });

    // Alter cooling_tower_telemetry to add return_temp, supply_temp, st3_return_temp, id_device columns if they don't exist
    await pool.query(`
      ALTER TABLE cooling_tower_telemetry ADD COLUMN IF NOT EXISTS return_temp NUMERIC;
      ALTER TABLE cooling_tower_telemetry ADD COLUMN IF NOT EXISTS supply_temp NUMERIC;
      ALTER TABLE cooling_tower_telemetry ADD COLUMN IF NOT EXISTS st3_return_temp NUMERIC;
      ALTER TABLE cooling_tower_telemetry ADD COLUMN IF NOT EXISTS id_device VARCHAR(50) DEFAULT 'cooling-water-1';
    `).catch((err) => {
      logger.warn({ err }, "Failed to add columns to cooling_tower_telemetry");
    });

    // Create temporary per-minute table for cooling tower telemetry buffer
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cooling_tower_telemetry_minute (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        id_device VARCHAR(50) NOT NULL DEFAULT 'cooling-water-1',
        return_temp NUMERIC,
        supply_temp NUMERIC,
        st3_return_temp NUMERIC,
        flow NUMERIC,
        tds NUMERIC,
        ph NUMERIC,
        humidity NUMERIC,
        press_ct_p1 NUMERIC,
        press_ct_p2 NUMERIC,
        press_ct3_p11 NUMERIC,
        scaled_level_tank_cooling3 NUMERIC
      );
      CREATE INDEX IF NOT EXISTS idx_ct_minute_t_stamp ON cooling_tower_telemetry_minute (t_stamp);
    `).catch((err) => {
      logger.warn({ err }, "Failed to create cooling_tower_telemetry_minute table");
    });

    // Move any existing minute-level rows from main table to temporary table
    await pool.query(`
      INSERT INTO cooling_tower_telemetry_minute (t_stamp, id_device, return_temp, supply_temp, st3_return_temp)
      SELECT t_stamp, id_device, return_temp, supply_temp, st3_return_temp
      FROM cooling_tower_telemetry
      WHERE EXTRACT(MINUTE FROM t_stamp) != 0 OR EXTRACT(SECOND FROM t_stamp) != 0;

      DELETE FROM cooling_tower_telemetry
      WHERE EXTRACT(MINUTE FROM t_stamp) != 0 OR EXTRACT(SECOND FROM t_stamp) != 0;

      -- Deduplicate hourly records in cooling_tower_telemetry
      DELETE FROM cooling_tower_telemetry
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM cooling_tower_telemetry
        GROUP BY date_trunc('hour', t_stamp), id_device
      );
    `).catch((err) => {
      logger.warn({ err }, "Failed to migrate and clean minute data in cooling_tower_telemetry");
    });

    // Create trigger to automatically intercept and redirect any minute-level insert to cooling_tower_telemetry_minute
    await pool.query(`
      CREATE OR REPLACE FUNCTION trg_route_cooling_telemetry()
      RETURNS TRIGGER AS $$
      BEGIN
          IF EXTRACT(MINUTE FROM NEW.t_stamp) != 0 OR EXTRACT(SECOND FROM NEW.t_stamp) != 0 THEN
              INSERT INTO public.cooling_tower_telemetry_minute (
                  t_stamp, 
                  id_device, 
                  return_temp, 
                  supply_temp, 
                  st3_return_temp
              ) VALUES (
                  NEW.t_stamp, 
                  NEW.id_device, 
                  NEW.return_temp, 
                  NEW.supply_temp, 
                  NEW.st3_return_temp
              );
              RETURN NULL;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_cooling_telemetry_minute_filter ON public.cooling_tower_telemetry;
      CREATE TRIGGER trg_cooling_telemetry_minute_filter
      BEFORE INSERT ON public.cooling_tower_telemetry
      FOR EACH ROW
      EXECUTE FUNCTION trg_route_cooling_telemetry();
    `).catch((err) => {
      logger.warn({ err }, "Failed to create trg_cooling_telemetry_minute_filter trigger");
    });

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS electricity_config (
        id SERIAL PRIMARY KEY,
        config_type VARCHAR(50) NOT NULL,
        config_key VARCHAR(100) NOT NULL,
        label VARCHAR(255) NOT NULL,
        value JSONB DEFAULT '{}'::jsonb,
        sort_order INT NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(config_type, config_key)
      );
    `);

    // --- ELECTRICITY TELEMETRY RAW TABLES ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS electric_pln_telemetry (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        status_pm8000 BOOLEAN,
        volt_ab NUMERIC(10,2),
        volt_bc NUMERIC(10,2),
        volt_ca NUMERIC(10,2),
        volt_ll NUMERIC(10,2),
        current_a NUMERIC(10,3),
        current_b NUMERIC(10,3),
        current_c NUMERIC(10,3),
        frequency NUMERIC(6,3),
        active_power NUMERIC(15,3),
        reactive_power_total NUMERIC(15,3),
        apparent_power_total NUMERIC(15,3),
        power_factor NUMERIC,
        voltage_unbalance NUMERIC,
        current_unbalance NUMERIC,
        thd_volt_a NUMERIC,
        thd_volt_b NUMERIC,
        thd_volt_c NUMERIC,
        thd_current_a NUMERIC,
        thd_current_b NUMERIC,
        thd_current_c NUMERIC,
        active_energy NUMERIC(15,3)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS electric_wf1_telemetry (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        status_pm5500 BOOLEAN,
        volt_ab NUMERIC(10,2),
        volt_bc NUMERIC(10,2),
        volt_ca NUMERIC(10,2),
        volt_ll NUMERIC(10,2),
        current_a NUMERIC(10,3),
        current_b NUMERIC(10,3),
        current_c NUMERIC(10,3),
        frequency NUMERIC(6,3),
        active_power_total NUMERIC(15,3),
        reactive_power_total NUMERIC(15,3),
        apparent_power_total NUMERIC(15,3),
        power_factor NUMERIC,
        voltage_unbalance NUMERIC,
        current_unbalance NUMERIC,
        thd_volt_a NUMERIC,
        thd_volt_b NUMERIC,
        thd_volt_c NUMERIC,
        thd_current_a NUMERIC,
        thd_current_b NUMERIC,
        thd_current_c NUMERIC,
        active_energy NUMERIC(15,3)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS electric_wf2_telemetry (
        id SERIAL PRIMARY KEY,
        t_stamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        status_pm5500 BOOLEAN,
        volt_ab NUMERIC(10,2),
        volt_bc NUMERIC(10,2),
        volt_ca NUMERIC(10,2),
        volt_ll NUMERIC(10,2),
        current_a NUMERIC(10,3),
        current_b NUMERIC(10,3),
        current_c NUMERIC(10,3),
        frequency NUMERIC(6,3),
        active_power_total NUMERIC(15,3),
        reactive_power_total NUMERIC(15,3),
        apparent_power_total NUMERIC(15,3),
        power_factor NUMERIC,
        voltage_unbalance NUMERIC,
        current_unbalance NUMERIC,
        thd_volt_a NUMERIC,
        thd_volt_b NUMERIC,
        thd_volt_c NUMERIC,
        thd_current_a NUMERIC,
        thd_current_b NUMERIC,
        thd_current_c NUMERIC,
        active_energy NUMERIC(15,3)
      );
    `);

    // --- ELECTRICITY TELEMETRY MONTHLY TABLES ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS electric_pln_monthly (
        year_month VARCHAR(7) PRIMARY KEY,
        energy_start NUMERIC(15,3),
        energy_end NUMERIC(15,3),
        kwh_consumed NUMERIC(15,3),
        active_power_peak NUMERIC(15,3),
        volt_ll_avg NUMERIC(10,2),
        current_avg NUMERIC(10,3),
        power_factor_avg NUMERIC,
        power_factor_min NUMERIC,
        frequency_avg NUMERIC(6,3),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS electric_wf1_monthly (
        year_month VARCHAR(7) PRIMARY KEY,
        energy_start NUMERIC(15,3),
        energy_end NUMERIC(15,3),
        kwh_consumed NUMERIC(15,3),
        active_power_peak NUMERIC(15,3),
        volt_ll_avg NUMERIC(10,2),
        current_avg NUMERIC(10,3),
        power_factor_avg NUMERIC,
        power_factor_min NUMERIC,
        frequency_avg NUMERIC(6,3),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS electric_wf2_monthly (
        year_month VARCHAR(7) PRIMARY KEY,
        energy_start NUMERIC(15,3),
        energy_end NUMERIC(15,3),
        kwh_consumed NUMERIC(15,3),
        active_power_peak NUMERIC(15,3),
        volt_ll_avg NUMERIC(10,2),
        current_avg NUMERIC(10,3),
        power_factor_avg NUMERIC,
        power_factor_min NUMERIC,
        frequency_avg NUMERIC(6,3),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Alter existing columns to avoid numeric field overflow
    const tablesToAlter = ["electric_pln_telemetry", "electric_wf1_telemetry", "electric_wf2_telemetry"];
    for (const table of tablesToAlter) {
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN voltage_unbalance TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN current_unbalance TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN thd_volt_a TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN thd_volt_b TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN thd_volt_c TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN thd_current_a TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN thd_current_b TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN thd_current_c TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN power_factor TYPE NUMERIC;`);
    }

    const monthlyTablesToAlter = ["electric_pln_monthly", "electric_wf1_monthly", "electric_wf2_monthly"];
    for (const table of monthlyTablesToAlter) {
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN power_factor_avg TYPE NUMERIC;`);
      await pool.query(`ALTER TABLE ${table} ALTER COLUMN power_factor_min TYPE NUMERIC;`);
    }

    logger.info("postgres tables ensured and migrated to NUMERIC successfully");
  } catch (err: any) {
    logger.error({ err }, "failed to ensure postgres tables");
  }
};
