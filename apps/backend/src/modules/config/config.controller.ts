import { NextFunction, Request, Response } from "express";
import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import {
  MACHINE_CATEGORIES_COLLECTION,
  MACHINE_CONFIGS_COLLECTION,
  MACHINE_THRESHOLDS_COLLECTION,
  GLOBAL_CONFIG_COLLECTION,
  API_SOURCES_COLLECTION
} from "../../database/collections";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSocketServer } from "../../services/socket.manager";
import { recordAudit, getClientIp } from "../../services/audit.service";
import { refreshDynamicCustomPmSources } from "../../core/scheduler";

// Zod schemas for validation
const machinePayloadSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string(),
  area: z.string(),
  status: z.enum(["active", "inactive"]),
  apiBindings: z.record(z.string()),
  analysisConfig: z.object({
    trendWindow: z.number().default(24),
    samplingRate: z.number().default(5),
    enabledAnalytics: z.array(z.string()).default(["trend"])
  })
});

const thresholdPayloadSchema = z.object({
  machineId: z.string(),
  thresholds: z.array(
    z.object({
      parameter: z.string(),
      warningHigh: z.number(),
      alarmHigh: z.number(),
      warningLow: z.number(),
      alarmLow: z.number()
    })
  )
});

export const getCategoriesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const categories = await db.collection(MACHINE_CATEGORIES_COLLECTION).find().toArray();
    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
};

export const getMachinesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const status = req.query.status as string;
    const filter = status ? { status } : {};
    const machines = await db.collection(MACHINE_CONFIGS_COLLECTION).find(filter).toArray();
    res.json({ data: machines });
  } catch (err) {
    next(err);
  }
};

export const createMachineHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const parsed = machinePayloadSchema.parse(req.body);

    const existing = await db.collection(MACHINE_CONFIGS_COLLECTION).findOne({ id: parsed.id });
    if (existing) {
      return res.status(400).json({ message: `Machine with id ${parsed.id} already exists.` });
    }

    const doc = {
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection(MACHINE_CONFIGS_COLLECTION).insertOne(doc);

    // Record audit trail
    await recordAudit({
      actorId: req.user?.name || req.user?.id || "anonymous",
      action: "create_machine",
      resourceType: "machine",
      resourceId: parsed.id,
      ip: getClientIp(req),
      meta: {
        name: parsed.name,
        area: parsed.area,
        status: parsed.status,
        apiBindings: parsed.apiBindings
      }
    });

    res.status(201).json({ data: doc });
  } catch (err) {
    next(err);
  }
};

export const updateMachineHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const { id } = req.params;
    const parsed = machinePayloadSchema.partial().parse(req.body);

    const beforeDoc = await db.collection(MACHINE_CONFIGS_COLLECTION).findOne({ id });
    if (!beforeDoc) {
      return res.status(404).json({ message: "Machine not found" });
    }

    const result = await db.collection(MACHINE_CONFIGS_COLLECTION).findOneAndUpdate(
      { id },
      {
        $set: {
          ...parsed,
          updatedAt: new Date()
        }
      },
      { returnDocument: "after" }
    );

    // Record audit trail
    await recordAudit({
      actorId: req.user?.name || req.user?.id || "anonymous",
      action: "update_machine",
      resourceType: "machine",
      resourceId: id,
      ip: getClientIp(req),
      meta: {
        before: {
          name: beforeDoc.name,
          area: beforeDoc.area,
          status: beforeDoc.status,
          apiBindings: beforeDoc.apiBindings
        },
        after: parsed
      }
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const deleteMachineHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const { id } = req.params;

    const existing = await db.collection(MACHINE_CONFIGS_COLLECTION).findOne({ id });

    // Hard-delete config, thresholds, etc.
    await db.collection(MACHINE_CONFIGS_COLLECTION).deleteOne({ id });
    await db.collection(MACHINE_THRESHOLDS_COLLECTION).deleteMany({ machineId: id });

    // Record audit trail
    await recordAudit({
      actorId: req.user?.name || req.user?.id || "anonymous",
      action: "delete_machine",
      resourceType: "machine",
      resourceId: id,
      ip: getClientIp(req),
      meta: {
        deletedMachine: existing ? { name: existing.name, area: existing.area } : null
      }
    });

    res.json({ message: "Machine configuration deleted successfully" });
  } catch (err) {
    next(err);
  }
};

export const getThresholdsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const { machineId } = req.params;
    const thresholds = await db.collection(MACHINE_THRESHOLDS_COLLECTION).find({ machineId }).toArray();
    res.json({ data: thresholds });
  } catch (err) {
    next(err);
  }
};

export const upsertThresholdsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const parsed = thresholdPayloadSchema.parse(req.body);

    const beforeThresholds = await db.collection(MACHINE_THRESHOLDS_COLLECTION).find({ machineId: parsed.machineId }).toArray();

    for (const t of parsed.thresholds) {
      await db.collection(MACHINE_THRESHOLDS_COLLECTION).updateOne(
        { machineId: parsed.machineId, parameter: t.parameter },
        {
          $set: {
            warningHigh: t.warningHigh,
            alarmHigh: t.alarmHigh,
            warningLow: t.warningLow,
            alarmLow: t.alarmLow,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    }

    // Record audit trail
    await recordAudit({
      actorId: req.user?.name || req.user?.id || "anonymous",
      action: "update_thresholds",
      resourceType: "machine_threshold",
      resourceId: parsed.machineId,
      ip: getClientIp(req),
      meta: {
        before: beforeThresholds.map((t: any) => ({
          parameter: t.parameter,
          warningHigh: t.warningHigh,
          alarmHigh: t.alarmHigh,
          warningLow: t.warningLow,
          alarmLow: t.alarmLow
        })),
        after: parsed.thresholds
      }
    });

    res.json({ message: "Thresholds configured successfully", count: parsed.thresholds.length });
  } catch (err) {
    next(err);
  }
};

export const testBindingHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const { id } = req.params;

    const machine = await db.collection(MACHINE_CONFIGS_COLLECTION).findOne({ id });
    if (!machine) {
      return res.status(404).json({ message: "Machine not found" });
    }

    // Dynamic test: check bindings map and return connection results
    const results: Record<string, string> = {};
    if (machine.apiBindings) {
      for (const [param, tagId] of Object.entries(machine.apiBindings)) {
        if (!tagId) {
          results[param] = "unbound";
          continue;
        }
        // Simulated PLC tag check
        results[param] = "connected";
      }
    }

    res.json({ machineId: id, results });
  } catch (err) {
    next(err);
  }
};

const waterTierSchema = z.object({
  maxVolume: z.number().nullable(),
  rate: z.number()
});

const gasConfigSchema = z.object({
  pricePerSm3: z.number().nonnegative(),
  usdPerMmbtu: z.number().nonnegative()
});

const gasCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  val: z.number(),
  enabled: z.boolean()
});

const waterConfigSchema = z.object({
  taxRate: z.number(),
  ar: z.number(),
  tiers: z.array(waterTierSchema)
});

const electricityTariffSchema = z.object({
  validFrom: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format"),
  wbpRate: z.number().nonnegative(),
  lwbpRate: z.number().nonnegative()
});

const utilityConfigSchema = z.object({
  wbpRate: z.number().nonnegative(),
  lwbpRate: z.number().nonnegative(),
  pvRate: z.number().nonnegative().optional(),
  waterConfig: waterConfigSchema.optional(),
  electricityTariffs: z.array(electricityTariffSchema).optional(),
  gasConfig: gasConfigSchema.optional(),
  gasCategories: z.array(gasCategorySchema).optional()
});

export const defaultWaterConfig = {
  taxRate: 0.20,
  ar: 0.18,
  tiers: [
    { maxVolume: 50, rate: 5900 },
    { maxVolume: 500, rate: 6600 },
    { maxVolume: 1000, rate: 7550 },
    { maxVolume: 2500, rate: 9050 },
    { maxVolume: null, rate: 11300 }
  ]
};

export const defaultElectricityTariffs = [
  { validFrom: "2024-01", wbpRate: 1600, lwbpRate: 1112 }
];

export const defaultGasConfig = {
  pricePerSm3: 11000,
  usdPerMmbtu: 9.5
};

export const defaultGasCategories = [
  { id: "boiler", name: "Boiler System", val: 22000, enabled: true },
  { id: "genset", name: "Genset Caterpillar", val: 1600, enabled: true },
  { id: "aux", name: "Auxiliary Supply", val: 800, enabled: true }
];

export const getUtilityConfigHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const config = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    if (config) {
      res.json({
        data: {
          wbpRate: config.wbpRate,
          lwbpRate: config.lwbpRate,
          pvRate: config.pvRate ?? 0,
          waterConfig: config.waterConfig || defaultWaterConfig,
          electricityTariffs: config.electricityTariffs || [
            { validFrom: "2024-01", wbpRate: config.wbpRate || 1600, lwbpRate: config.lwbpRate || 1112 }
          ],
          gasConfig: config.gasConfig || defaultGasConfig,
          gasCategories: config.gasCategories || defaultGasCategories
        }
      });
    } else {
      res.json({
        data: {
          wbpRate: 1600,
          lwbpRate: 1112,
          pvRate: 0,
          waterConfig: defaultWaterConfig,
          electricityTariffs: defaultElectricityTariffs,
          gasConfig: defaultGasConfig,
          gasCategories: defaultGasCategories
        }
      });
    }
  } catch (err) {
    next(err);
  }
};

export const updateUtilityConfigHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const parsed = utilityConfigSchema.parse(req.body);

    const beforeDoc = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    const oldWbpRate = beforeDoc ? beforeDoc.wbpRate : 1600;
    const oldLwbpRate = beforeDoc ? beforeDoc.lwbpRate : 1112;
    const oldPvRate = beforeDoc ? (beforeDoc.pvRate ?? 0) : 0;
    const oldWaterConfig = beforeDoc?.waterConfig || defaultWaterConfig;
    const oldElectricityTariffs = beforeDoc?.electricityTariffs || [
      { validFrom: "2024-01", wbpRate: oldWbpRate, lwbpRate: oldLwbpRate }
    ];
    const oldGasConfig = beforeDoc?.gasConfig || defaultGasConfig;
    const oldGasCategories = beforeDoc?.gasCategories || defaultGasCategories;

    // Determine latest rates for top-level backward compatibility
    let wbpRate = parsed.wbpRate;
    let lwbpRate = parsed.lwbpRate;
    const pvRate = parsed.pvRate !== undefined ? parsed.pvRate : oldPvRate;
    const tariffs = parsed.electricityTariffs || [];
    if (tariffs.length > 0) {
      const sorted = [...tariffs].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      wbpRate = sorted[0].wbpRate;
      lwbpRate = sorted[0].lwbpRate;
    }

    const doc = {
      key: "utility",
      wbpRate,
      lwbpRate,
      pvRate,
      waterConfig: parsed.waterConfig || oldWaterConfig,
      electricityTariffs: tariffs.length > 0 ? tariffs : oldElectricityTariffs,
      gasConfig: parsed.gasConfig || oldGasConfig,
      gasCategories: parsed.gasCategories || oldGasCategories,
      updatedAt: new Date()
    };

    await db.collection(GLOBAL_CONFIG_COLLECTION).updateOne(
      { key: "utility" },
      { $set: doc },
      { upsert: true }
    );

    const io = getSocketServer();
    if (io) {
      io.emit("config:update", doc);
    }


    // Record audit trail
    await recordAudit({
      actorId: req.user?.name || req.user?.id || "anonymous",
      action: "update_utility_config",
      resourceType: "utility_config",
      resourceId: "utility",
      ip: getClientIp(req),
      meta: {
        before: { wbpRate: oldWbpRate, lwbpRate: oldLwbpRate, waterConfig: oldWaterConfig, electricityTariffs: oldElectricityTariffs, gasConfig: oldGasConfig },
        after: { wbpRate: doc.wbpRate, lwbpRate: doc.lwbpRate, waterConfig: doc.waterConfig, electricityTariffs: doc.electricityTariffs, gasConfig: doc.gasConfig }
      }
    });

    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
};


const defaultPidThresholds = {
  basin_lvl: { warning: 75, alarm: 70 },
  supply_temp: { warning: 28, alarm: 30 },
  return_temp: { warning: 38, alarm: 40 },
  pressure: { warning: 1.5, alarm: 2.0 },
  st3_return_temp: { warning: 35, alarm: 40 },
  chemical_357_lvl: { warning: 75, alarm: 70 },
  chemical_327_lvl: { warning: 75, alarm: 70 }
};

export const getPidThresholdsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const config = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "pid_thresholds" });
    if (config) {
      const { _id, key, updatedAt, ...thresholds } = config;
      res.json({ data: thresholds });
    } else {
      res.json({ data: defaultPidThresholds });
    }
  } catch (err) {
    next(err);
  }
};

export const updatePidThresholdsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const doc = {
      key: "pid_thresholds",
      ...req.body,
      updatedAt: new Date()
    };
    
    await db.collection(GLOBAL_CONFIG_COLLECTION).updateOne(
      { key: "pid_thresholds" },
      { $set: doc },
      { upsert: true }
    );
    
    const io = getSocketServer();
    if (io) {
      io.emit("config:pid-thresholds:update", doc);
    }
    
    res.json({ success: true, data: req.body });
  } catch (err) {
    next(err);
  }
};

export const defaultRhTaskRules = [
  {
    itemKey: "FAN",
    displayName: "Motor Fan (FAN-1..3)",
    rules: [
      { targetHours: 500, warningHours: 168, tasks: ["Check V-Belt Tension", "Visual Inspection"] },
      { targetHours: 1000, warningHours: 168, tasks: ["Clean Fan Blades"] }
    ]
  },
  {
    itemKey: "MTR",
    displayName: "Motor Sirkulasi (MTR-1..9)",
    rules: [
      { targetHours: 500, warningHours: 168, tasks: ["Strainer Inspection", "Pump Bearing Lubrication"] },
      { targetHours: 1000, warningHours: 168, tasks: ["Seal/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "Dosing Pump",
    displayName: "Dosing Pump (DP-1..2)",
    rules: [
      { targetHours: 500, warningHours: 168, tasks: ["Strainer Inspection"] }
    ]
  },
  {
    itemKey: "Strainer",
    displayName: "Strainer (Strainer 1..9)",
    rules: [
      { targetHours: 200, warningHours: 168, tasks: ["Check Cleanliness"] },
      { targetHours: 600, warningHours: 168, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Cooling Tower",
    displayName: "Cooling Tower (CT 1..3)",
    rules: [
      { targetHours: 600, warningHours: 168, tasks: ["Basin Debris Clean", "Float Valve Inspection"] }
    ]
  },
  {
    itemKey: "Cooling Tank",
    displayName: "Cooling Tank",
    rules: [
      { targetHours: 1000, warningHours: 168, tasks: ["Basin Sediment Cleaning", "Flushing & Corrosion Inspect"] }
    ]
  },
  {
    itemKey: "Panel",
    displayName: "Panel",
    rules: [
      { targetHours: 1000, warningHours: 168, tasks: ["Inverter Cleaning", "Wiring Inspection"] }
    ]
  }
];

export const defaultHvacRhTaskRules = [
  {
    itemKey: "AHU-FAN",
    displayName: "Supply / Exhaust Fan",
    rules: [
      { targetHours: 500, warningHours: 168, tasks: ["Check V-Belt Tension", "Visual & Vibration Inspection"] },
      { targetHours: 1000, warningHours: 168, tasks: ["Bearing Lubrication", "Clean Fan Impeller"] }
    ]
  },
  {
    itemKey: "PRE-FILTER",
    displayName: "Pre-Filter AHU",
    rules: [
      { targetHours: 250, warningHours: 72, tasks: ["Differential Pressure Check"] },
      { targetHours: 720, warningHours: 168, tasks: ["Wash & Replace Pre-Filter Element"] }
    ]
  },
  {
    itemKey: "MED-FILTER",
    displayName: "Medium Filter AHU",
    rules: [
      { targetHours: 1000, warningHours: 168, tasks: ["Inspect Filter Integrity & Dust Accumulation"] },
      { targetHours: 2000, warningHours: 240, tasks: ["Replace Medium Filter Bag"] }
    ]
  },
  {
    itemKey: "HEPA-FILTER",
    displayName: "HEPA Filter Cleanroom",
    rules: [
      { targetHours: 2000, warningHours: 240, tasks: ["Integrity Test & Velocity Measurement (SOP-QC)"] },
      { targetHours: 4000, warningHours: 360, tasks: ["HEPA Filter Terminal Replacement"] }
    ]
  },
  {
    itemKey: "COOL-COIL",
    displayName: "Cooling Coil & Chilled Water",
    rules: [
      { targetHours: 1000, warningHours: 168, tasks: ["Inspect & Comb Aluminum Fins", "Modulating Valve Actuator Check"] }
    ]
  },
  {
    itemKey: "HEAT-COIL",
    displayName: "Heating Coil (Heater)",
    rules: [
      { targetHours: 1000, warningHours: 168, tasks: ["Heater Element Resistance & Contact Inspection"] }
    ]
  },
  {
    itemKey: "HUMIDIFIER",
    displayName: "Humidifier System",
    rules: [
      { targetHours: 500, warningHours: 168, tasks: ["Clean Steam Cylinder & Scale Inspection"] },
      { targetHours: 1000, warningHours: 168, tasks: ["Electrode Descaling & RO Water Inlet Check"] }
    ]
  },
  {
    itemKey: "DRAIN-TRAP",
    displayName: "Condensate Drain Trap",
    rules: [
      { targetHours: 350, warningHours: 72, tasks: ["Flush Drain Trap & Clean U-Bend Sediment"] }
    ]
  }
];

export const isHvacUnit = (unitId?: string | null): boolean => {
  if (!unitId) return false;
  const lower = unitId.toLowerCase();
  return lower.startsWith("ahu-") || lower.startsWith("hvac-") || lower.startsWith("oac-");
};

export const isUtilityUnit = (unitId?: string | null): boolean => {
  if (!unitId) return false;
  return !isHvacUnit(unitId);
};

export const getRhTaskRulesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query("SELECT value FROM global_configs WHERE key = $1", ["rh_task_rules"]);
    
    let rules = defaultRhTaskRules;
    
    if (result.rows.length > 0) {
      const dbValue = result.rows[0].value;
      const hasOldKeys = Array.isArray(dbValue) && dbValue.some(item => 
        item.itemKey.includes("-") || 
        item.itemKey.includes("Pump 1") || 
        item.itemKey.includes("Strainer 1")
      );
      if (!hasOldKeys && Array.isArray(dbValue) && dbValue.length === 7) {
        rules = dbValue;
      } else {
        await pool.query(
          `INSERT INTO global_configs (key, value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP) 
           ON CONFLICT (key) 
           DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
          ["rh_task_rules", JSON.stringify(defaultRhTaskRules)]
        );
      }
    } else {
      await pool.query(
        `INSERT INTO global_configs (key, value, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP) 
         ON CONFLICT (key) 
         DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        ["rh_task_rules", JSON.stringify(defaultRhTaskRules)]
      );
    }
    
    res.json({ data: rules });
  } catch (err) {
    next(err);
  }
};

export const updateRhTaskRulesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    const rules = req.body;
    
    const beforeRes = await pool.query(
      "SELECT value FROM global_configs WHERE key = $1",
      ["rh_task_rules"]
    );
    const before = beforeRes.rows[0]?.value || null;
    
    await pool.query(
      `INSERT INTO global_configs (key, value, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       ON CONFLICT (key) 
       DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      ["rh_task_rules", JSON.stringify(rules)]
    );
    
    const io = getSocketServer();
    if (io) {
      io.emit("config:rh-task-rules:update", { key: "rh_task_rules", rules });
    }

    // Record audit trail only if changed
    const isRhRulesEqual = JSON.stringify(before) === JSON.stringify(rules);
    if (!isRhRulesEqual) {
      await recordAudit({
        actorId: req.user?.name || req.user?.id || "anonymous",
        action: "update_rh_task_rules",
        resourceType: "rh_task_rules",
        resourceId: "cooling-water-1",
        ip: getClientIp(req),
        meta: {
          before,
          after: rules
        }
      });
    }
    
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
};

export const getSensorRulesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    const unitId = req.query.unitId as string;
    if (!unitId) {
      return res.status(400).json({ error: "Missing unitId query parameter" });
    }
    const result = await pool.query(
      `SELECT tag_key, tag_name, low_limit, baseline, high_limit, unit, enable_alert, suppress_alert, direction 
       FROM sensor_rules 
       WHERE unit_id = $1`,
      [unitId]
    );

    const rows = result.rows.map((row) => ({
      tagKey: row.tag_key,
      tagName: row.tag_name,
      lowLimit: row.low_limit !== null ? parseFloat(row.low_limit) : null,
      baseline: row.baseline !== null ? parseFloat(row.baseline) : null,
      highLimit: row.high_limit !== null ? parseFloat(row.high_limit) : null,
      unit: row.unit,
      enableAlert: row.enable_alert,
      suppressAlert: row.suppress_alert,
      direction: row.direction
    }));

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

export const updateSensorRulesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    const { unitId, rules } = req.body;
    if (!unitId || !Array.isArray(rules)) {
      return res.status(400).json({ error: "Missing unitId or rules array in body" });
    }

    // Fetch old configuration for audit trail
    const beforeRulesRes = await pool.query(
      `SELECT tag_key, tag_name, low_limit, baseline, high_limit, unit, enable_alert, suppress_alert, direction 
       FROM sensor_rules 
       WHERE unit_id = $1`,
      [unitId]
    );
    const beforeRules = beforeRulesRes.rows.map(row => ({
      tagKey: row.tag_key,
      tagName: row.tag_name,
      lowLimit: row.low_limit !== null ? parseFloat(row.low_limit) : null,
      baseline: row.baseline !== null ? parseFloat(row.baseline) : null,
      highLimit: row.high_limit !== null ? parseFloat(row.high_limit) : null,
      unit: row.unit,
      enableAlert: row.enable_alert,
      suppressAlert: row.suppress_alert,
      direction: row.direction
    }));

    await pool.query("BEGIN");
    await pool.query("DELETE FROM sensor_rules WHERE unit_id = $1", [unitId]);

    for (const rule of rules) {
      await pool.query(
        `INSERT INTO sensor_rules (unit_id, tag_key, tag_name, low_limit, baseline, high_limit, unit, enable_alert, suppress_alert, direction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          unitId,
          rule.tagKey,
          rule.tagName,
          rule.lowLimit !== undefined && rule.lowLimit !== null && rule.lowLimit !== "" ? parseFloat(rule.lowLimit) : null,
          rule.baseline !== undefined && rule.baseline !== null && rule.baseline !== "" ? parseFloat(rule.baseline) : null,
          rule.highLimit !== undefined && rule.highLimit !== null && rule.highLimit !== "" ? parseFloat(rule.highLimit) : null,
          rule.unit,
          rule.enableAlert ?? true,
          rule.suppressAlert ?? false,
          rule.direction ?? "above"
        ]
      );
    }
    await pool.query("COMMIT");
    // Record audit trail only if changed
    const normalizedRules = rules.map((rule: any) => ({
      tagKey: rule.tagKey,
      tagName: rule.tagName,
      lowLimit: rule.lowLimit !== undefined && rule.lowLimit !== null && rule.lowLimit !== "" ? parseFloat(rule.lowLimit) : null,
      baseline: rule.baseline !== undefined && rule.baseline !== null && rule.baseline !== "" ? parseFloat(rule.baseline) : null,
      highLimit: rule.highLimit !== undefined && rule.highLimit !== null && rule.highLimit !== "" ? parseFloat(rule.highLimit) : null,
      unit: rule.unit || null,
      enableAlert: rule.enableAlert ?? true,
      suppressAlert: rule.suppressAlert ?? false,
      direction: rule.direction ?? "above"
    }));

    const isRulesEqual = JSON.stringify(beforeRules) === JSON.stringify(normalizedRules);
    if (!isRulesEqual) {
      await recordAudit({
        actorId: req.user?.name || req.user?.id || "anonymous",
        action: "update_sensor_rules",
        resourceType: "sensor_rules",
        resourceId: unitId,
        ip: getClientIp(req),
        meta: {
          before: beforeRules,
          after: normalizedRules
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    const pool = getPostgresPool();
    try {
      await pool.query("ROLLBACK");
    } catch (e) {}
    next(err);
  }
};

export const getRhBaselinesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    const unitId = req.query.unitId as string;
    let query = "SELECT motor_key, target_hours, task_name, baseline_hours FROM running_hours_baselines";
    let params: any[] = [];
    if (unitId) {
      query += " WHERE unit_id = $1";
      params.push(unitId);
    }
    const result = await pool.query(query, params);
    
    const rows = result.rows.map(r => ({
      motorKey: r.motor_key,
      targetHours: r.target_hours,
      taskName: r.task_name,
      baselineHours: parseFloat(r.baseline_hours)
    }));
    
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

export const getRhTasksHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();

    // 1. Fetch current running hours for ALL components from database
    const rhRes = await pool.query("SELECT tag_id, total_running_hours FROM equipment_running_hours");
    const runningHoursMap = rhRes.rows.reduce((acc, row) => {
      acc[row.tag_id] = parseFloat(row.total_running_hours);
      return acc;
    }, {} as Record<string, number>);

    // 2. Fetch the active task rules templates from global_configs (expanded to 28 components)
    const ruleRes = await pool.query("SELECT value FROM global_configs WHERE key = $1", ["rh_task_rules"]);
    let rules = defaultRhTaskRules;
    if (ruleRes.rows.length > 0 && Array.isArray(ruleRes.rows[0].value)) {
      rules = ruleRes.rows[0].value;
    }

    const GENERIC_TO_SPECIFIC_MAP: Record<string, string[]> = {
      "FAN": ["FAN-1", "FAN-2", "FAN-3"],
      "MTR": ["MTR-1", "MTR-2", "MTR-3", "MTR-4", "MTR-5", "MTR-6", "MTR-7", "MTR-8", "MTR-9"],
      "Dosing Pump": ["Dosing Pump 1", "Dosing Pump 2"],
      "Strainer": ["Strainer 1", "Strainer 2", "Strainer 3", "Strainer 4", "Strainer 5", "Strainer 6", "Strainer 7", "Strainer 8", "Strainer 9"],
      "Cooling Tower": ["CT 1", "CT 2", "CT 3"],
      "Cooling Tank": ["Cooling Tank"],
      "Panel": ["Panel"]
    };

    const MOTOR_KEY_TO_TAG_ID: Record<string, string> = {
      "FAN-1": "cooling-water/fan_status_1",
      "FAN-2": "cooling-water/fan_status_2",
      "FAN-3": "cooling-water/fan_status_3",
      "MTR-1": "cooling-water/motor_status_1",
      "MTR-2": "cooling-water/motor_status_2",
      "MTR-3": "cooling-water/motor_status_3",
      "MTR-4": "cooling-water/eq_status_du03",
      "MTR-5": "cooling-water/eq_status_bp03",
      "MTR-6": "cooling-water/eq_status_prep03",
      "MTR-7": "cooling-water/eq_status_st03",
      "MTR-8": "cooling-water/eq_status_washing",
      "MTR-9": "cooling-water/eq_status_minilab",
      "Dosing Pump 1": "cooling-water/dosing_pump_1",
      "Dosing Pump 2": "cooling-water/dosing_pump_2",
      "Strainer 1": "cooling-water/strainer_1",
      "Strainer 2": "cooling-water/strainer_2",
      "Strainer 3": "cooling-water/strainer_3",
      "Strainer 4": "cooling-water/strainer_4",
      "Strainer 5": "cooling-water/strainer_5",
      "Strainer 6": "cooling-water/strainer_6",
      "Strainer 7": "cooling-water/strainer_7",
      "Strainer 8": "cooling-water/strainer_8",
      "Strainer 9": "cooling-water/strainer_9",
      "CT 1": "cooling-water/ct_1",
      "CT 2": "cooling-water/ct_2",
      "CT 3": "cooling-water/ct_3",
      "Cooling Tank": "cooling-water/cooling_tank",
      "Panel": "cooling-water/panel"
    };

    // 3. Fetch all current baselines
    const baselineRes = await pool.query("SELECT unit_id, motor_key, target_hours, task_name, baseline_hours FROM running_hours_baselines");
    const baselineMap = baselineRes.rows.reduce((acc, row) => {
      const key = `${row.unit_id}_${row.motor_key}_${row.target_hours}_${row.task_name}`;
      acc[key] = parseFloat(row.baseline_hours);
      return acc;
    }, {} as Record<string, number>);

    // 4. We evaluate for all 3 machines: 'cooling-water-1', 'cooling-water-2', 'cooling-water-3'
    const coolingUnits = ["cooling-water-1", "cooling-water-2", "cooling-water-3"];
    
    // Fetch all existing tasks to avoid queries in the loop
    const taskRes = await pool.query("SELECT unit_id, motor_key, target_hours, task_name, trigger_base_hours, status FROM running_hours_tasks");
    const existingTasksMap = taskRes.rows.reduce((acc, row) => {
      const key = `${row.unit_id}_${row.motor_key}_${row.target_hours}_${row.task_name}_${row.trigger_base_hours}`;
      acc[key] = row.status;
      return acc;
    }, {} as Record<string, string>);

    for (const unitId of coolingUnits) {
      for (const config of rules) {
        const specKeys = GENERIC_TO_SPECIFIC_MAP[config.itemKey] || [config.itemKey];
        for (const specKey of specKeys) {
          const tagId = MOTOR_KEY_TO_TAG_ID[specKey];
          const actualRh = runningHoursMap[tagId] || 0.0;
          
          for (const rule of config.rules) {
            const warningBuffer = typeof rule.warningHours === "number" ? rule.warningHours : 168;
            for (const task of rule.tasks) {
              if (!task || !task.trim()) continue;
              const taskClean = task.trim();
              
              const baselineKey = `${unitId}_${specKey}_${rule.targetHours}_${taskClean}`;
              const baseline = baselineMap[baselineKey] || 0.0;
              
              // Evaluate triggers relative to baseline
              const warningThreshold = baseline + rule.targetHours - warningBuffer;
              const isTriggered = actualRh >= warningThreshold;
              
              if (isTriggered) {
                const taskKey = `${unitId}_${specKey}_${rule.targetHours}_${taskClean}_${baseline}`;
                const currentStatus = existingTasksMap[taskKey];
                
                let targetStatus: "open" | "overdue" = "open";
                if (actualRh >= baseline + rule.targetHours) {
                  targetStatus = "overdue";
                }
                
                if (!currentStatus) {
                  // Insert new active task
                  await pool.query(
                    `INSERT INTO running_hours_tasks (unit_id, motor_key, target_hours, warning_hours, task_name, status, trigger_base_hours, actual_hours_at_trigger)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [unitId, specKey, rule.targetHours, warningBuffer, taskClean, targetStatus, baseline, actualRh]
                  );
                } else if (currentStatus !== "close" && currentStatus !== targetStatus) {
                  // Update active task status if it changed from open to overdue
                  await pool.query(
                    `UPDATE running_hours_tasks 
                     SET status = $1 
                     WHERE unit_id = $2 AND motor_key = $3 AND target_hours = $4 AND task_name = $5 AND trigger_base_hours = $6`,
                    [targetStatus, unitId, specKey, rule.targetHours, taskClean, baseline]
                  );
                }
              }
            }
          }
        }
      }
    }

    // 4b. Evaluate HVAC units: 'ahu-01', 'ahu-02', 'ahu-03'
    const hvacUnits = ["ahu-01", "ahu-02", "ahu-03"];
    const HVAC_DEFAULT_HOURS: Record<string, number> = {
      "AHU-FAN": 1250,
      "PRE-FILTER": 730,
      "MED-FILTER": 1050,
      "HEPA-FILTER": 2100,
      "COOL-COIL": 1020,
      "HEAT-COIL": 1050,
      "HUMIDIFIER": 520,
      "DRAIN-TRAP": 360
    };

    for (const unitId of hvacUnits) {
      for (const config of defaultHvacRhTaskRules) {
        const specKey = config.itemKey;
        const tagId = `hvac/${unitId}/${specKey.toLowerCase()}`;
        const actualRh = runningHoursMap[tagId] ?? (HVAC_DEFAULT_HOURS[specKey] || 500);

        for (const rule of config.rules) {
          const warningBuffer = typeof rule.warningHours === "number" ? rule.warningHours : 168;
          for (const task of rule.tasks) {
            if (!task || !task.trim()) continue;
            const taskClean = task.trim();

            const baselineKey = `${unitId}_${specKey}_${rule.targetHours}_${taskClean}`;
            const baseline = baselineMap[baselineKey] || 0.0;

            const warningThreshold = baseline + rule.targetHours - warningBuffer;
            const isTriggered = actualRh >= warningThreshold;

            if (isTriggered) {
              const taskKey = `${unitId}_${specKey}_${rule.targetHours}_${taskClean}_${baseline}`;
              const currentStatus = existingTasksMap[taskKey];

              let targetStatus: "open" | "overdue" = "open";
              if (actualRh >= baseline + rule.targetHours) {
                targetStatus = "overdue";
              }

              if (!currentStatus) {
                await pool.query(
                  `INSERT INTO running_hours_tasks (unit_id, motor_key, target_hours, warning_hours, task_name, status, trigger_base_hours, actual_hours_at_trigger)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                  [unitId, specKey, rule.targetHours, warningBuffer, taskClean, targetStatus, baseline, actualRh]
                );
              } else if (currentStatus !== "close" && currentStatus !== targetStatus) {
                await pool.query(
                  `UPDATE running_hours_tasks 
                   SET status = $1 
                   WHERE unit_id = $2 AND motor_key = $3 AND target_hours = $4 AND task_name = $5 AND trigger_base_hours = $6`,
                  [targetStatus, unitId, specKey, rule.targetHours, taskClean, baseline]
                );
              }
            }
          }
        }
      }
    }

    // 5. Query tasks using filters
    const { status, unitId, motorKey, startDate, endDate, domain } = req.query;
    const userRole = req.user?.role;
    
    // Date Range filters default: This month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const filterStart = startDate ? new Date(startDate as string) : startOfMonth;
    const filterEnd = endDate ? new Date((endDate as string) + " 23:59:59") : endOfMonth;

    let queryStr = `
      SELECT id, unit_id, motor_key, target_hours, warning_hours, task_name, status, trigger_base_hours, actual_hours_at_trigger, completed_at, completion_status, completed_by, created_at
      FROM running_hours_tasks
      WHERE created_at >= $1 AND created_at <= $2
    `;
    const queryParams: any[] = [filterStart, filterEnd];
    
    let paramCounter = 3;

    if (status && status !== "all") {
      queryStr += ` AND status = $${paramCounter++}`;
      queryParams.push(status);
    }
    if (unitId && unitId !== "all") {
      queryStr += ` AND unit_id = $${paramCounter++}`;
      queryParams.push(unitId);
    }
    if (motorKey && motorKey !== "all") {
      queryStr += ` AND motor_key = $${paramCounter++}`;
      queryParams.push(motorKey);
    }

    // Strict role-based domain scoping: no cross handling
    if (userRole === "operator_utility" || domain === "utility") {
      queryStr += ` AND (unit_id NOT LIKE 'ahu-%' AND unit_id NOT LIKE 'hvac-%' AND unit_id NOT LIKE 'oac-%')`;
    } else if (userRole === "operator_hvac" || domain === "hvac") {
      queryStr += ` AND (unit_id LIKE 'ahu-%' OR unit_id LIKE 'hvac-%' OR unit_id LIKE 'oac-%')`;
    }

    queryStr += ` ORDER BY CASE WHEN status = 'overdue' THEN 1 WHEN status = 'open' THEN 2 ELSE 3 END, created_at DESC`;

    const finalRes = await pool.query(queryStr, queryParams);
    
    res.json({ data: finalRes.rows });
  } catch (err) {
    next(err);
  }
};

export const completeRhTaskHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    const { id } = req.params;

    // Fetch the task first
    const taskRes = await pool.query("SELECT * FROM running_hours_tasks WHERE id = $1", [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const task = taskRes.rows[0];

    if (task.status === "close") {
      res.status(400).json({ error: "Task already closed" });
      return;
    }

    // Role boundary check: strict no cross-handling
    const userRole = req.user?.role;
    const isTaskHvac = isHvacUnit(task.unit_id);
    const isTaskUtility = isUtilityUnit(task.unit_id);

    if (userRole === "operator_utility" && isTaskHvac) {
      res.status(403).json({
        error: "Akses Ditolak: Operator Utility tidak diizinkan menyelesaikan tugas pemeliharaan HVAC."
      });
      return;
    }

    if (userRole === "operator_hvac" && isTaskUtility) {
      res.status(403).json({
        error: "Akses Ditolak: Operator HVAC tidak diizinkan menyelesaikan tugas pemeliharaan Utility."
      });
      return;
    }

    const MOTOR_KEY_TO_TAG_ID: Record<string, string> = {
      "FAN-1": "cooling-water/fan_status_1",
      "FAN-2": "cooling-water/fan_status_2",
      "FAN-3": "cooling-water/fan_status_3",
      "MTR-1": "cooling-water/motor_status_1",
      "MTR-2": "cooling-water/motor_status_2",
      "MTR-3": "cooling-water/motor_status_3",
      "MTR-4": "cooling-water/eq_status_du03",
      "MTR-5": "cooling-water/eq_status_bp03",
      "MTR-6": "cooling-water/eq_status_prep03",
      "MTR-7": "cooling-water/eq_status_st03",
      "MTR-8": "cooling-water/eq_status_washing",
      "MTR-9": "cooling-water/eq_status_minilab",
      "Dosing Pump 1": "cooling-water/dosing_pump_1",
      "Dosing Pump 2": "cooling-water/dosing_pump_2",
      "Strainer 1": "cooling-water/strainer_1",
      "Strainer 2": "cooling-water/strainer_2",
      "Strainer 3": "cooling-water/strainer_3",
      "Strainer 4": "cooling-water/strainer_4",
      "Strainer 5": "cooling-water/strainer_5",
      "Strainer 6": "cooling-water/strainer_6",
      "Strainer 7": "cooling-water/strainer_7",
      "Strainer 8": "cooling-water/strainer_8",
      "Strainer 9": "cooling-water/strainer_9",
      "CT 1": "cooling-water/ct_1",
      "CT 2": "cooling-water/ct_2",
      "CT 3": "cooling-water/ct_3",
      "Cooling Tank": "cooling-water/cooling_tank",
      "Panel": "cooling-water/panel"
    };

    // Get current actual running hours for the motorKey
    const tagId = MOTOR_KEY_TO_TAG_ID[task.motor_key];
    let actualRh = 0.0;
    if (tagId) {
      const rhRes = await pool.query("SELECT total_running_hours FROM equipment_running_hours WHERE tag_id = $1", [tagId]);
      if (rhRes.rows.length > 0) {
        actualRh = parseFloat(rhRes.rows[0].total_running_hours);
      }
    }
    if (actualRh === 0.0) {
      actualRh = task.actual_hours_at_trigger || task.target_hours;
    }

    // Determine completion status: On Time vs Overdue
    const limit = parseFloat(task.trigger_base_hours) + parseFloat(task.target_hours);
    const completionStatus = actualRh >= limit ? "Overdue" : "On Time";

    // Update status to close
    const completedBy = req.user?.name || req.user?.id || "anonymous";
    await pool.query(
      `UPDATE running_hours_tasks 
       SET status = 'close', completed_at = CURRENT_TIMESTAMP, completion_status = $1, completed_by = $2
       WHERE id = $3`,
      [completionStatus, completedBy, id]
    );

    // Save baseline
    await pool.query(
      `INSERT INTO running_hours_baselines (unit_id, motor_key, target_hours, task_name, baseline_hours)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (unit_id, motor_key, target_hours, task_name)
       DO UPDATE SET baseline_hours = EXCLUDED.baseline_hours`,
      [task.unit_id, task.motor_key, task.target_hours, task.task_name, actualRh]
    );

    // Record audit trail
    await recordAudit({
      actorId: req.user?.name || req.user?.id || "anonymous",
      action: "complete_maintenance_task",
      resourceType: "maintenance_task",
      resourceId: task.unit_id,
      ip: getClientIp(req),
      meta: {
        taskName: task.task_name,
        motorKey: task.motor_key,
        targetHours: task.target_hours,
        completionStatus,
        completedAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════
// API SOURCES MANAGEMENT
// ═══════════════════════════════════════════════

export const getApiSourcesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unitId = req.query.unitId as string | undefined;
    try {
      const pool = getPostgresPool();
      const queryStr = unitId
        ? `SELECT id as _id, unit_id as "unitId", name, url, method, headers, polling_interval_ms as "pollingIntervalMs", selected_fields as "selectedFields", enabled, mode, last_tested_at as "lastTestedAt", last_test_status as "lastTestStatus", created_at as "createdAt", updated_at as "updatedAt" FROM api_sources WHERE unit_id = $1 ORDER BY id DESC`
        : `SELECT id as _id, unit_id as "unitId", name, url, method, headers, polling_interval_ms as "pollingIntervalMs", selected_fields as "selectedFields", enabled, mode, last_tested_at as "lastTestedAt", last_test_status as "lastTestStatus", created_at as "createdAt", updated_at as "updatedAt" FROM api_sources ORDER BY id DESC`;
      const values = unitId ? [unitId] : [];
      const pgRes = await pool.query(queryStr, values);
      res.json({ data: pgRes.rows });
      return;
    } catch (pgErr) {
      console.warn("PostgreSQL query failed for API sources, falling back to Mongo:", pgErr);
    }

    const db = getMongoDb();
    const filter = unitId ? { unitId } : {};
    const sources = await db.collection(API_SOURCES_COLLECTION).find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ data: sources });
  } catch (err) {
    next(err);
  }
};

export const createApiSourceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, url, method, headers, pollingIntervalMs, selectedFields, enabled, unitId, mode } = req.body;

    if (!name || !url || !unitId) {
      res.status(400).json({ error: "name, url, and unitId are required" });
      return;
    }

    const sourceObj = {
      name: name || "Unnamed API",
      url,
      unitId,
      method: method || "GET",
      headers: headers || {},
      pollingIntervalMs: pollingIntervalMs || 2000,
      selectedFields: selectedFields || [],
      enabled: enabled ?? false,
      mode: mode || "test"
    };

    try {
      const pool = getPostgresPool();
      const pgRes = await pool.query(
        `INSERT INTO api_sources (unit_id, name, url, method, headers, polling_interval_ms, selected_fields, enabled, mode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id as _id, unit_id as "unitId", name, url, method, headers, polling_interval_ms as "pollingIntervalMs", selected_fields as "selectedFields", enabled, mode, created_at as "createdAt", updated_at as "updatedAt"`,
        [
          sourceObj.unitId,
          sourceObj.name,
          sourceObj.url,
          sourceObj.method,
          JSON.stringify(sourceObj.headers),
          sourceObj.pollingIntervalMs,
          JSON.stringify(sourceObj.selectedFields),
          sourceObj.enabled,
          sourceObj.mode
        ]
      );

      res.json({ data: pgRes.rows[0] });
      return;
    } catch (pgErr) {
      console.warn("PostgreSQL insert failed for API sources, falling back to Mongo:", pgErr);
    }

    const db = getMongoDb();
    const doc = {
      ...sourceObj,
      lastTestedAt: null,
      lastTestStatus: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection(API_SOURCES_COLLECTION).insertOne(doc);
    res.json({ data: { ...doc, _id: result.insertedId } });
  } catch (err) {
    next(err);
  }
};

export const updateApiSourceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates._id;

    if (!isNaN(Number(id))) {
      try {
        const pool = getPostgresPool();
        const pgRes = await pool.query(
          `UPDATE api_sources 
           SET name = COALESCE($1, name),
               url = COALESCE($2, url),
               method = COALESCE($3, method),
               headers = COALESCE($4, headers),
               polling_interval_ms = COALESCE($5, polling_interval_ms),
               selected_fields = COALESCE($6, selected_fields),
               enabled = COALESCE($7, enabled),
               mode = COALESCE($8, mode),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $9
           RETURNING id as _id, unit_id as "unitId", name, url, method, headers, polling_interval_ms as "pollingIntervalMs", selected_fields as "selectedFields", enabled, mode, created_at as "createdAt", updated_at as "updatedAt"`,
          [
            updates.name || null,
            updates.url || null,
            updates.method || null,
            updates.headers ? JSON.stringify(updates.headers) : null,
            updates.pollingIntervalMs || null,
            updates.selectedFields ? JSON.stringify(updates.selectedFields) : null,
            updates.enabled !== undefined ? updates.enabled : null,
            updates.mode || null,
            Number(id)
          ]
        );

        if (pgRes.rowCount && pgRes.rowCount > 0) {
          res.json({ data: pgRes.rows[0] });
          return;
        }
      } catch (pgErr) {
        console.warn("PostgreSQL update failed for API sources, falling back to Mongo:", pgErr);
      }
    }

    const db = getMongoDb();
    const mongoResult = await db.collection(API_SOURCES_COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!mongoResult) {
      res.status(404).json({ error: "API source not found" });
      return;
    }

    res.json({ data: mongoResult });
  } catch (err) {
    next(err);
  }
};

export const deleteApiSourceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!isNaN(Number(id))) {
      try {
        const pool = getPostgresPool();
        await pool.query(`DELETE FROM api_sources WHERE id = $1`, [Number(id)]);
        res.json({ success: true });
        return;
      } catch (pgErr) {
        console.warn("PostgreSQL delete failed for API sources, falling back to Mongo:", pgErr);
      }
    }

    const db = getMongoDb();
    await db.collection(API_SOURCES_COLLECTION).deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// In-memory cache for API proxy requests to eliminate duplicate outbound calls and CPU overload
const apiProxyCache = new Map<string, { data: any; status: number; success: boolean; error?: string; ts: number }>();

export const testApiSourceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { url, method, headers: customHeaders } = req.body;

    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    const CORE_ENDPOINT_URLS: Record<string, string> = {
      "electric_pln": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln",
      "electric_wf1": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf1",
      "electric_wf2": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf2",
      "electric_plts": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_plts",
      "electric_ew21": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew21",
      "electric_ew22": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew22",
      "electric_ew23": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew23",
      "hvac_retain_plc1": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/hvac_retain_plc1",
      "hvac_retain_plc2_2": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/hvac_retain_plc2_2",
      "hvac_retain_plc2_3": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/hvac_retain_plc2_3"
    };

    if (typeof url === "string" && CORE_ENDPOINT_URLS[url.trim()]) {
      url = CORE_ENDPOINT_URLS[url.trim()];
    }

    if (typeof url !== "string" || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      res.status(400).json({ success: false, error: "Invalid URL protocol: Must start with http:// or https://" });
      return;
    }

    const reqMethod = (method || "GET").toUpperCase();
    const now = Date.now();

    // Cache GET requests for 1000ms so multiple components or tabs sharing the same URL don't flood the server with HTTP fetches
    if (reqMethod === "GET") {
      const cached = apiProxyCache.get(url);
      if (cached && now - cached.ts < 1000) {
        res.json({
          success: cached.success,
          status: cached.status,
          data: cached.data,
          error: cached.error
        });
        return;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const fetchOptions: RequestInit = {
      method: reqMethod,
      headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        ...(customHeaders || {})
      },
      signal: controller.signal
    };

    const apiRes = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!apiRes.ok) {
      const result = {
        success: false,
        status: apiRes.status,
        statusText: apiRes.statusText,
        data: null,
        ts: now
      };
      if (reqMethod === "GET") apiProxyCache.set(url, result);
      res.json(result);
      return;
    }

    const data = await apiRes.json();
    const result = {
      success: true,
      status: apiRes.status,
      data,
      ts: now
    };
    if (reqMethod === "GET") apiProxyCache.set(url, result);
    res.json(result);
  } catch (err: any) {
    const result = {
      success: false,
      status: 0,
      error: err.name === "AbortError" ? "Request timed out" : err.message,
      data: null,
      ts: Date.now()
    };
    res.json(result);
  }
};


// ═══════════════════════════════════════════════
// ELECTRICITY CONFIG & POWER METERS MANAGEMENT
// ═══════════════════════════════════════════════

const STANDARD_METERS = [
  // ─── EW21 (Factory 1 / WF1) ───
  { pm_id: "PM132", label: "F1 MAIN SUPPLY QC OFFICE & LAB (PM132)", model: "PM5100", endpoint_url: "electric_ew21", json_key: "PM132", group_id: "ew21", department: "Other", subArea: "QC & Office" },
  { pm_id: "PM133", label: "F1 MDP3 (PM133)", model: "PM5100", endpoint_url: "electric_ew21", json_key: "PM133", group_id: "ew21", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM134", label: "F1 WH 4 PENERANGAN (PM134)", model: "PM5100", endpoint_url: "electric_ew21", json_key: "PM134", group_id: "ew21", department: "Other", subArea: "Warehouse" },
  { pm_id: "PM135", label: "F1 MDP-2 (PM135)", model: "PM5100", endpoint_url: "electric_ew21", json_key: "PM135", group_id: "ew21", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM136", label: "F1 MDP-1.2 (PM136)", model: "PM5100", endpoint_url: "electric_ew21", json_key: "PM136", group_id: "ew21", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM138", label: "F1 FULL COOLING WF1-U3 (PM138)", model: "PM5100", endpoint_url: "electric_ew21", json_key: "PM138", group_id: "ew21", department: "Utility", subArea: "Cooling Towers" },
  { pm_id: "PM139", label: "F1 MDP-1.1 (PM139)", model: "PM5100", endpoint_url: "electric_ew21", json_key: "PM139", group_id: "ew21", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM140", label: "F1 COMPRESSED AIR ZT-55 (PM140)", model: "PM5100", endpoint_url: "electric_ew21", json_key: "PM140", group_id: "ew21", department: "Utility", subArea: "Compressors" },
  { pm_id: "PM151", label: "F1 HVAC OFFICE ATAS (PM151)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM151", group_id: "ew21", department: "HVAC", subArea: "Office" },
  { pm_id: "PM152", label: "F1 COOLING TOWER PUMP WF1-U3 (PM152)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM152", group_id: "ew21", department: "Utility", subArea: "Cooling Towers" },
  { pm_id: "PM153", label: "F1 HVAC-QC (PM153)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM153", group_id: "ew21", department: "HVAC", subArea: "QC" },
  { pm_id: "PM154", label: "F1 LIGHTING WH 1 (PM154)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM154", group_id: "ew21", department: "Other", subArea: "Warehouse" },
  { pm_id: "PM175", label: "F1 ST3 (PM175)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM175", group_id: "ew21", department: "Utility", subArea: "Steam / ST3" },
  { pm_id: "PM176", label: "F1 QC LAB (PM176)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM176", group_id: "ew21", department: "Other", subArea: "QC Laboratory" },
  { pm_id: "PM177", label: "F1 CHILLER PREP DAIKIN BARAT (PM177)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM177", group_id: "ew21", department: "HVAC", subArea: "Chillers" },
  { pm_id: "PM178", label: "F1 CHILLER PREP DAIKIN TIMUR (PM178)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM178", group_id: "ew21", department: "HVAC", subArea: "Chillers" },
  { pm_id: "PM179", label: "F1 HVAC WH-3 (PM179)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM179", group_id: "ew21", department: "HVAC", subArea: "Warehouse" },
  { pm_id: "PM180", label: "F1 CHILLER BP WF1-U3 (PM180)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM180", group_id: "ew21", department: "HVAC", subArea: "Chillers" },
  { pm_id: "PM181", label: "F1 COOLING TOWER FAN WF1-U3 (PM181)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM181", group_id: "ew21", department: "Utility", subArea: "Cooling Towers" },
  { pm_id: "PM182", label: "F1 COMPRESSED AIR ZT-30.1&2 (PM182)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM182", group_id: "ew21", department: "Utility", subArea: "Compressors" },
  { pm_id: "PM183", label: "F1 COMPRESSED AIR ALE-30 (PM183)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM183", group_id: "ew21", department: "Utility", subArea: "Compressors" },
  { pm_id: "PM184", label: "F1 BOILER 4 (PM184)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM184", group_id: "ew21", department: "Utility", subArea: "Boiler" },
  { pm_id: "PM185", label: "F1 HVAC WF1U3 (PM185)", model: "PA330", endpoint_url: "electric_ew21", json_key: "PM185", group_id: "ew21", department: "HVAC", subArea: "AHUs" },

  // ─── EW22 (Factory 2 / WF2) ───
  { pm_id: "PM201", label: "F2 PUTR-1 (PM201)", model: "PM5100", endpoint_url: "electric_ew22", json_key: "PM201", group_id: "ew22", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM202", label: "F2 PUTR-2 (PM202)", model: "PM5100", endpoint_url: "electric_ew22", json_key: "PM202", group_id: "ew22", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM203", label: "F2 HEATER WF2U2 (PM203)", model: "PM5100", endpoint_url: "electric_ew22", json_key: "PM203", group_id: "ew22", department: "Utility", subArea: "Heater" },
  { pm_id: "PM205", label: "F2 AHU WF2UI (PM205)", model: "PM5100", endpoint_url: "electric_ew22", json_key: "PM205", group_id: "ew22", department: "HVAC", subArea: "AHUs" },
  { pm_id: "PM206", label: "F2 COOLING FASE-1 (PM206)", model: "PM5100", endpoint_url: "electric_ew22", json_key: "PM206", group_id: "ew22", department: "Utility", subArea: "Cooling Towers" },
  { pm_id: "PM207", label: "F2 WH 6 (PM207)", model: "PM5100", endpoint_url: "electric_ew22", json_key: "PM207", group_id: "ew22", department: "Other", subArea: "Warehouse" },
  { pm_id: "PM208", label: "F2 WH 5 (PM208)", model: "PM5100", endpoint_url: "electric_ew22", json_key: "PM208", group_id: "ew22", department: "Other", subArea: "Warehouse" },
  { pm_id: "PM209", label: "F2 CHILLER - WF2U2 (PM209)", model: "PM5300", endpoint_url: "electric_ew22", json_key: "PM209", group_id: "ew22", department: "HVAC", subArea: "Chillers" },
  { pm_id: "PM210", label: "F2 MAIN CRITICAL PANEL (PM210)", model: "PM5350", endpoint_url: "electric_ew22", json_key: "PM210", group_id: "ew22", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM211", label: "F2 PANEL OTOKLAF WF2U1 (PM211)", model: "PM5350", endpoint_url: "electric_ew22", json_key: "PM211", group_id: "ew22", department: "Other", subArea: "Autoclave" },
  { pm_id: "PM212", label: "F2 PANEL OTOKLAF WF2U2 (PM212)", model: "PM5350", endpoint_url: "electric_ew22", json_key: "PM212", group_id: "ew22", department: "Other", subArea: "Autoclave" },
  { pm_id: "PM213", label: "F2 BOILER-5 (PM213)", model: "PM5350", endpoint_url: "electric_ew22", json_key: "PM213", group_id: "ew22", department: "Utility", subArea: "Boiler" },
  { pm_id: "PM214", label: "F2 COMPRESSED AIR ATLAS (PM214)", model: "PM5100", endpoint_url: "electric_ew22", json_key: "PM214", group_id: "ew22", department: "Utility", subArea: "Compressors" },
  { pm_id: "PM215", label: "F2 COOLING CRITICAL (PM215)", model: "PM5350", endpoint_url: "electric_ew22", json_key: "PM215", group_id: "ew22", department: "Utility", subArea: "Cooling Towers" },
  { pm_id: "PM226", label: "F2 WH-7 (PM226)", model: "PM5300", endpoint_url: "electric_ew22", json_key: "PM226", group_id: "ew22", department: "Other", subArea: "Warehouse" },
  { pm_id: "PM229", label: "F2 KOBELCO ALE-250 (PM229)", model: "PM5300", endpoint_url: "electric_ew22", json_key: "PM229", group_id: "ew22", department: "Utility", subArea: "Compressors" },
  { pm_id: "PM271", label: "F2 CHILLER RTAC 250 (RO&HVAC) (PM271)", model: "PA330", endpoint_url: "electric_ew22", json_key: "PM271", group_id: "ew22", department: "HVAC", subArea: "Chillers" },
  { pm_id: "PM272", label: "F2 CHILLER RTAC 170 (RO) (PM272)", model: "PA330", endpoint_url: "electric_ew22", json_key: "PM272", group_id: "ew22", department: "HVAC", subArea: "Chillers" },
  { pm_id: "PM273", label: "RETURN SAMPLE QC (PM273)", model: "PA330", endpoint_url: "electric_ew22", json_key: "PM273", group_id: "ew22", department: "Other", subArea: "QC Laboratory" },
  { pm_id: "PM274", label: "F2 CHILLER RTAC 100 (BP) (PM274)", model: "PA330", endpoint_url: "electric_ew22", json_key: "PM274", group_id: "ew22", department: "HVAC", subArea: "Chillers" },
  { pm_id: "PM288", label: "F2 Penerangan PD (PM288)", model: "PA330", endpoint_url: "electric_ew22", json_key: "PM288", group_id: "ew22", department: "Other", subArea: "Lighting" },

  // ─── EW23 (Factory 2 / WF2 Continued) ───
  { pm_id: "PM318", label: "F2 COOLING FASE-2 (PM318)", model: "PM5300", endpoint_url: "electric_ew23", json_key: "PM318", group_id: "ew23", department: "Utility", subArea: "Cooling Towers" },
  { pm_id: "PM319", label: "F2 CHILLER RTAC-27S (PREP) (PM319)", model: "PA330", endpoint_url: "electric_ew23", json_key: "PM319", group_id: "ew23", department: "HVAC", subArea: "Chillers" },
  { pm_id: "PM320", label: "F2 WT-DU-PSG (PM320)", model: "PM5300", endpoint_url: "electric_ew23", json_key: "PM320", group_id: "ew23", department: "Utility", subArea: "Water / WTP" },
  { pm_id: "PM321", label: "F2 AHU-1 - WF2U2 (PM321)", model: "PM5100", endpoint_url: "electric_ew23", json_key: "PM321", group_id: "ew23", department: "HVAC", subArea: "AHUs" },
  { pm_id: "PM322", label: "F2 AHU-2 - WF2U2 (PM322)", model: "PM5350", endpoint_url: "electric_ew23", json_key: "PM322", group_id: "ew23", department: "HVAC", subArea: "AHUs" },
  { pm_id: "PM323", label: "F2 PW GENERATION - RO (PM323)", model: "PM5300", endpoint_url: "electric_ew23", json_key: "PM323", group_id: "ew23", department: "Utility", subArea: "Water / WTP" },
  { pm_id: "PM324", label: "F2 COOLING TOWER CT-PUMP (PM324)", model: "PM5300", endpoint_url: "electric_ew23", json_key: "PM324", group_id: "ew23", department: "Utility", subArea: "Cooling Towers" },
  { pm_id: "PM325", label: "F2 COOLING TOWER CT-FAN (PM325)", model: "PM5100", endpoint_url: "electric_ew23", json_key: "PM325", group_id: "ew23", department: "Utility", subArea: "Cooling Towers" },
  { pm_id: "PM327", label: "F2 PUTR-NEW (PM327)", model: "PM5300", endpoint_url: "electric_ew23", json_key: "PM327", group_id: "ew23", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM337", label: "F2 MCC BP 7 (PM337)", model: "PA330", endpoint_url: "electric_ew23", json_key: "PM337", group_id: "ew23", department: "Other", subArea: "Production" },

  // ─── Main Feeders & Cubicles ───
  { pm_id: "PM410", label: "incoming cubicle WF2 (PM410)", model: "pm5560", endpoint_url: "electric_wf2", json_key: "PM410", group_id: "ew23", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM411", label: "incoming cubicle pln (PM411)", model: "pm8000", endpoint_url: "electric_pln", json_key: "PM411", group_id: "ew23", department: "Utility", subArea: "Electrical Substation" },
  { pm_id: "PM412", label: "incoming cubicle WF1 (PM412)", model: "pm5560", endpoint_url: "electric_wf1", json_key: "PM412", group_id: "ew23", department: "Utility", subArea: "Electrical Substation" }
];

export const getAvailablePowerMetersHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    const pmMap = new Map<string, any>();

    // 1. Seed standard meters
    for (const m of STANDARD_METERS) {
      const factory = m.group_id === "ew21" ? "consumption_fact_1" : (m.group_id === "ew22" || m.group_id === "ew23") ? "consumption_fact_2" : "all";
      pmMap.set(m.pm_id.toUpperCase(), { ...m, factory, is_database: true });
    }

    // 2. Query distinct PMs recorded in electric_pm_telemetry and minute table
    try {
      const dbRes = await pool.query(`
        SELECT DISTINCT UPPER(pm_id) as pm_id, LOWER(group_id) as group_id
        FROM (
          SELECT pm_id, group_id FROM electric_pm_telemetry
          UNION
          SELECT pm_id, group_id FROM electric_pm_telemetry_minute
        ) c
        WHERE pm_id IS NOT NULL AND pm_id != ''
      `);
      for (const row of dbRes.rows) {
        const id = String(row.pm_id).toUpperCase();
        if (!pmMap.has(id)) {
          const factory = row.group_id === "ew21" ? "consumption_fact_1" : (row.group_id === "ew22" || row.group_id === "ew23") ? "consumption_fact_2" : "all";
          pmMap.set(id, {
            pm_id: id,
            label: `${id} (${row.group_id || "Sub-distribution"})`,
            endpoint_url: `electric_${row.group_id || "ew23"}`,
            json_key: id,
            group_id: row.group_id || "ew23",
            factory,
            department: row.group_id === "hvac" ? "HVAC" : "Utility",
            subArea: "General",
            is_database: true
          });
        }
      }
    } catch {}

    // 3. Query electricity_config for any custom configured items
    try {
      const cfgRes = await pool.query(`
        SELECT config_type, config_key, label, value
        FROM electricity_config
        WHERE value->>'endpoint_url' IS NOT NULL
      `);
      for (const row of cfgRes.rows) {
        const val = row.value || {};
        const pmId = String(val.pm_id || val.json_key || row.config_key).toUpperCase().replace(/[^A-Z0-9_]/g, "");
        const normalizedPmId = pmId.startsWith("PM") ? pmId : `PM_${pmId}`;
        const factory = row.config_type || (val.group_id === "ew21" ? "consumption_fact_1" : "consumption_fact_2");
        if (!pmMap.has(normalizedPmId)) {
          pmMap.set(normalizedPmId, {
            pm_id: normalizedPmId,
            label: `${normalizedPmId} — ${row.label}`,
            endpoint_url: val.endpoint_url,
            json_key: val.json_key || normalizedPmId,
            group_id: (val.department || "utility").toLowerCase(),
            factory,
            department: val.department || "Utility",
            subArea: val.subArea || "General",
            is_database: !val.is_new_pm,
            is_new_pm: Boolean(val.is_new_pm)
          });
        } else {
          const existing = pmMap.get(normalizedPmId);
          if (row.config_type && existing.factory === "all") {
            existing.factory = row.config_type;
          }
        }
      }
    } catch {}

    const result = Array.from(pmMap.values()).sort((a, b) => a.pm_id.localeCompare(b.pm_id));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const getElectricityConfigHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configType = req.query.configType as string | undefined;
    const pool = getPostgresPool();
    const queryStr = configType
      ? `SELECT id, config_type, config_key, label, value, sort_order, enabled, created_at, updated_at FROM electricity_config WHERE config_type = $1 ORDER BY sort_order ASC, id ASC`
      : `SELECT id, config_type, config_key, label, value, sort_order, enabled, created_at, updated_at FROM electricity_config ORDER BY config_type, sort_order ASC, id ASC`;
    const values = configType ? [configType] : [];
    let pgRes = await pool.query(queryStr, values);

    // Auto-seed standard meters if table has no items for this factory config type
    if ((configType === "consumption_fact_1" || configType === "consumption_fact_2") && pgRes.rows.length === 0) {
      const targetMeters = STANDARD_METERS.filter(m => {
        const fact = m.group_id === "ew21" ? "consumption_fact_1" : (m.group_id === "ew22" || m.group_id === "ew23") ? "consumption_fact_2" : null;
        return fact === configType;
      });

      for (let i = 0; i < targetMeters.length; i++) {
        const m = targetMeters[i];
        const val = {
          endpoint_url: m.endpoint_url,
          json_key: m.json_key,
          pm_id: m.pm_id,
          department: m.department,
          subArea: m.subArea,
          factory: configType,
          kWh: 0
        };
        await pool.query(
          `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW())
           ON CONFLICT (config_type, config_key) DO NOTHING`,
          [configType, m.pm_id.toLowerCase(), m.label, JSON.stringify(val), i + 1]
        );
      }
      pgRes = await pool.query(queryStr, values);
    }

    // Enrich rows with real monthly factual consumption from batch analytics
    if (!configType || configType === "consumption_fact_1" || configType === "consumption_fact_2") {
      try {
        const { computeEquipmentMonthlyBatch } = require("../analytics/analytics.controller");
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const currMonthStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        const compMonthStr = now.getMonth() === 0 ? `${now.getFullYear() - 1}-12` : `${now.getFullYear()}-${pad(now.getMonth())}`;

        const batchRes = await computeEquipmentMonthlyBatch(currMonthStr, compMonthStr);
        if (batchRes && batchRes.data) {
          for (const row of pgRes.rows) {
            const val = typeof row.value === "object" && row.value !== null ? row.value : {};
            const rawPm = String(val.pm_id || val.json_key || row.config_key || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
            const normalizedPm = rawPm.startsWith("PM") ? rawPm : `PM${rawPm}`;
            const batchItem = batchRes.data[normalizedPm] || batchRes.data[rawPm] || batchRes.data[row.label?.toLowerCase()];
            const factualKwh = batchItem ? batchItem.currTotalKwh : (Number(val.kWh) || 0);
            row.value = {
              ...val,
              kWh: factualKwh
            };
          }
        }
      } catch (e: any) {
        console.warn("Failed to enrich electricity_config with factual consumption:", e.message);
      }
    }

    res.json({ data: pgRes.rows });
  } catch (err) {
    next(err);
  }
};

export const upsertElectricityConfigHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { config_type, config_key, label, value, sort_order, enabled, pm_id, endpoint_url, department, subArea } = req.body;
    if (!config_type || !label) {
      res.status(400).json({ error: "config_type and label are required" });
      return;
    }
    const pool = getPostgresPool();

    // Determine normalized PM ID
    const rawPmId = String(value?.pm_id || pm_id || value?.json_key || config_key || label).toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const resolvedPmId = rawPmId.startsWith("PM") ? rawPmId : `PM_${rawPmId}`;
    const cleanKey = (config_key || resolvedPmId).toLowerCase().replace(/[^a-z0-9_]/g, "");
    const cleanEndpoint = String(value?.endpoint_url || endpoint_url || "").trim();
    const resolvedDept = department || value?.department || "Utility";
    const resolvedSubArea = subArea || value?.subArea || "General";

    // Check if this PM ID already exists in the database
    let isExisting = false;
    try {
      const checkRes = await pool.query(`
        SELECT 1 FROM electric_pm_telemetry WHERE UPPER(pm_id) = $1
        UNION
        SELECT 1 FROM electric_pm_telemetry_minute WHERE UPPER(pm_id) = $1
        LIMIT 1
      `, [resolvedPmId]);
      isExisting = (checkRes.rowCount ?? 0) > 0;
    } catch {}

    // Also check standard meters set
    if (!isExisting) {
      isExisting = STANDARD_METERS.some(m => m.pm_id.toUpperCase() === resolvedPmId);
    }

    const itemValue = {
      ...(value || {}),
      pm_id: resolvedPmId,
      endpoint_url: cleanEndpoint,
      department: resolvedDept,
      subArea: resolvedSubArea,
      is_new_pm: !isExisting,
      registered_at: isExisting ? (value?.registered_at || undefined) : new Date().toISOString()
    };

    // If new PM, also register into api_sources so it is tracked uniformly
    if (!isExisting && cleanEndpoint) {
      try {
        await pool.query(`
          INSERT INTO api_sources (unit_id, name, url, method, enabled, polling_interval_ms)
          VALUES ('electric_pm', $1, $2, 'GET', true, 2000)
        `, [label, cleanEndpoint]);
      } catch {}
    }

    const pgRes = await pool.query(
      `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (config_type, config_key)
       DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order, enabled = EXCLUDED.enabled, updated_at = NOW()
       RETURNING id, config_type, config_key, label, value, sort_order, enabled`,
      [config_type, cleanKey, label, JSON.stringify(itemValue), sort_order ?? 0, enabled !== false]
    );

    // Refresh dynamic custom PM polling in scheduler
    try {
      await refreshDynamicCustomPmSources();
    } catch {}

    const message = isExisting
      ? `Power meter '${resolvedPmId}' terdaftar di database (data historis aktif).`
      : `Power meter baru '${resolvedPmId}' berhasil didaftarkan ke database electric_pm, sistem mulai menyimpan per menit dan per jam.`;

    res.json({
      data: pgRes.rows[0],
      isExisting,
      pmId: resolvedPmId,
      message
    });
  } catch (err) {
    next(err);
  }
};

export const toggleElectricityPmHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { config_type, pm_id, enabled, label, endpoint_url, department, subArea } = req.body;
    if (!config_type || !pm_id) {
      res.status(400).json({ error: "config_type and pm_id are required" });
      return;
    }

    const pool = getPostgresPool();
    const rawPmId = String(pm_id).toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const resolvedPmId = rawPmId.startsWith("PM") ? rawPmId : `PM_${rawPmId}`;
    const configKey = resolvedPmId.toLowerCase();

    // Check existing row
    const existingRes = await pool.query(
      `SELECT id, label, value FROM electricity_config WHERE config_type = $1 AND config_key = $2`,
      [config_type, configKey]
    );

    let resultRow;
    if (existingRes.rows.length > 0) {
      const existingVal = existingRes.rows[0].value || {};
      const updatedVal = {
        ...existingVal,
        pm_id: resolvedPmId,
        endpoint_url: endpoint_url || existingVal.endpoint_url || "",
        department: department || existingVal.department || "Utility",
        subArea: subArea || existingVal.subArea || ""
      };
      const updateRes = await pool.query(
        `UPDATE electricity_config 
         SET enabled = $1, value = $2, label = COALESCE($3, label), updated_at = NOW() 
         WHERE id = $4 RETURNING *`,
        [enabled === true, JSON.stringify(updatedVal), label || null, existingRes.rows[0].id]
      );
      resultRow = updateRes.rows[0];
    } else {
      const itemVal = {
        pm_id: resolvedPmId,
        endpoint_url: endpoint_url || "",
        department: department || "Utility",
        subArea: subArea || ""
      };
      const insertRes = await pool.query(
        `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
         VALUES ($1, $2, $3, $4, 0, $5, NOW())
         RETURNING *`,
        [config_type, configKey, label || resolvedPmId, JSON.stringify(itemVal), enabled === true]
      );
      resultRow = insertRes.rows[0];
    }

    res.json({ success: true, data: resultRow });
  } catch (err) {
    next(err);
  }
};

export const batchToggleElectricityPmHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { config_type, enabled, pms } = req.body;
    if (!config_type || !Array.isArray(pms)) {
      res.status(400).json({ error: "config_type and pms array are required" });
      return;
    }

    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const pm of pms) {
        const rawPmId = String(pm.pm_id).toUpperCase().replace(/[^A-Z0-9_]/g, "");
        const resolvedPmId = rawPmId.startsWith("PM") ? rawPmId : `PM_${rawPmId}`;
        const configKey = resolvedPmId.toLowerCase();

        const itemVal = {
          pm_id: resolvedPmId,
          endpoint_url: pm.endpoint_url || "",
          department: pm.department || "Utility",
          subArea: pm.subArea || ""
        };

        await client.query(
          `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
           VALUES ($1, $2, $3, $4, 0, $5, NOW())
           ON CONFLICT (config_type, config_key)
           DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
          [config_type, configKey, pm.label || resolvedPmId, JSON.stringify(itemVal), enabled === true]
        );
      }
      await client.query("COMMIT");
      res.json({ success: true, count: pms.length });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

export const deleteElectricityConfigHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pool = getPostgresPool();
    await pool.query(`DELETE FROM electricity_config WHERE id = $1`, [id]);

    // Refresh dynamic custom PM polling in scheduler
    try {
      await refreshDynamicCustomPmSources();
    } catch {}

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════
// API SOURCES MAP MANAGEMENT
// ═══════════════════════════════════════════════

export const upsertApiSourcesMapHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { unitId, sources, rows } = req.body;
    if (!unitId) {
      res.status(400).json({ error: "unitId is required" });
      return;
    }

    const pool = getPostgresPool();

    // Fetch before state for audit log
    const beforeMapRes = await pool.query(
      "SELECT value FROM global_configs WHERE key = $1",
      [`api_sources_map_${unitId}`]
    );
    const beforeListRes = await pool.query(
      "SELECT value FROM global_configs WHERE key = $1",
      [`api_sources_list_${unitId}`]
    );
    const beforeMap = beforeMapRes.rows[0]?.value || null;
    const beforeList = beforeListRes.rows[0]?.value || null;
    
    if (sources) {
      await pool.query(
        `INSERT INTO global_configs (key, value)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [`api_sources_map_${unitId}`, JSON.stringify(sources)]
      );
    }

    if (rows) {
      await pool.query(
        `INSERT INTO global_configs (key, value)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [`api_sources_list_${unitId}`, JSON.stringify(rows)]
      );
    }

    // Record audit trail only if changed
    const isMapEqual = JSON.stringify(beforeMap) === JSON.stringify(sources);
    const isListEqual = JSON.stringify(beforeList) === JSON.stringify(rows);
    if (!isMapEqual || !isListEqual) {
      await recordAudit({
        actorId: req.user?.name || req.user?.id || "anonymous",
        action: "update_api_sources",
        resourceType: "api_sources_map",
        resourceId: unitId,
        ip: getClientIp(req),
        meta: {
          before: { sources: beforeMap, rows: beforeList },
          after: { sources, rows }
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const getApiSourcesMapHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { unitId } = req.query;
    if (!unitId) {
      res.status(400).json({ error: "unitId is required" });
      return;
    }

    const pool = getPostgresPool();
    const listRes = await pool.query(
      "SELECT value FROM global_configs WHERE key = $1",
      [`api_sources_list_${unitId}`]
    );
    const mapRes = await pool.query(
      "SELECT value FROM global_configs WHERE key = $1",
      [`api_sources_map_${unitId}`]
    );

    res.json({
      success: true,
      rows: listRes.rows[0]?.value || null,
      sources: mapRes.rows[0]?.value || null
    });
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════════
// ─── EQUIPMENT DISPLAY & NEW PM VERIFICATION HANDLERS ────────────
// ═════════════════════════════════════════════════════════════════

export const DEFAULT_EQUIPMENT_DISPLAY_ITEMS = [
  // 1. Cooling Tower (7 Units)
  { pm_id: "PM152", label: "Cooling Tower Pump WF1-U3", seriesKey: "F1 COOLING TOWER PUMP WF1-U3", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 1 },
  { pm_id: "PM181", label: "Cooling Tower Fan WF1-U3", seriesKey: "F1 COOLING TOWER FAN WF1-U3", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 2 },
  { pm_id: "PM206", label: "Cooling Fase-1 WF2", seriesKey: "F2 COOLING FASE-1", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 3 },
  { pm_id: "PM215", label: "Cooling Critical WF2", seriesKey: "F2 COOLING CRITICAL", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 4 },
  { pm_id: "PM318", label: "Cooling Fase-2 WF2", seriesKey: "F2 COOLING FASE-2", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew23", factory: "wf2", department: "Utility", sort_order: 5 },
  { pm_id: "PM324", label: "Cooling Tower CT-Pump WF2", seriesKey: "F2 COOLING TOWER CT-PUMP", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew23", factory: "wf2", department: "Utility", sort_order: 6 },
  { pm_id: "PM325", label: "Cooling Tower CT-Fan WF2", seriesKey: "F2 COOLING TOWER CT-FAN", category: "cooling_tower", categoryLabel: "Cooling Tower", endpoint_url: "electric_ew23", factory: "wf2", department: "Utility", sort_order: 7 },

  // 2. Boiler (2 Units)
  { pm_id: "PM184", label: "Boiler 4 WF1", seriesKey: "F1 BOILER 4", category: "boiler", categoryLabel: "Boiler", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 8 },
  { pm_id: "PM213", label: "Boiler-5 WF2", seriesKey: "F2 BOILER-5", category: "boiler", categoryLabel: "Boiler", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 9 },

  // 3. Compressed Air (5 Units)
  { pm_id: "PM140", label: "Compressed Air ZT-55 WF1", seriesKey: "F1 COMPRESSED AIR ZT-55", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 10 },
  { pm_id: "PM182", label: "Compressed Air ZT-30.1&2 WF1", seriesKey: "F1 COMPRESSED AIR ZT-30.1&2", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 11 },
  { pm_id: "PM183", label: "Compressed Air ALE-30 WF1", seriesKey: "F1 COMPRESSED AIR ALE-30", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 12 },
  { pm_id: "PM214", label: "Compressed Air Atlas WF2", seriesKey: "F2 COMPRESSED AIR ATLAS", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 13 },
  { pm_id: "PM229", label: "Kobelco ALE-250 WF2", seriesKey: "F2 KOBELCO ALE-250", category: "compressed_air", categoryLabel: "Compressed Air", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 14 },

  // 4. Chiller (8 Units)
  { pm_id: "PM177", label: "Chiller Prep Daikin Barat WF1", seriesKey: "F1 CHILLER PREP DAIKIN BARAT", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew21", factory: "wf1", department: "HVAC", sort_order: 15 },
  { pm_id: "PM178", label: "Chiller Prep Daikin Timur WF1", seriesKey: "F1 CHILLER PREP DAIKIN TIMUR", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew21", factory: "wf1", department: "HVAC", sort_order: 16 },
  { pm_id: "PM180", label: "Chiller BP WF1-U3", seriesKey: "F1 CHILLER BP WF1-U3", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew21", factory: "wf1", department: "HVAC", sort_order: 17 },
  { pm_id: "PM209", label: "Chiller - WF2U2", seriesKey: "F2 CHILLER - WF2U2", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew22", factory: "wf2", department: "HVAC", sort_order: 18 },
  { pm_id: "PM271", label: "Chiller RTAC 250 (RO & HVAC) WF2", seriesKey: "F2 CHILLER RTAC 250 (RO&HVAC)", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew22", factory: "wf2", department: "HVAC", sort_order: 19 },
  { pm_id: "PM272", label: "Chiller RTAC 170 (RO) WF2", seriesKey: "F2 CHILLER RTAC 170 (RO)", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew22", factory: "wf2", department: "HVAC", sort_order: 20 },
  { pm_id: "PM274", label: "Chiller RTAC 100 (BP) WF2", seriesKey: "F2 CHILLER RTAC 100 (BP)", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew22", factory: "wf2", department: "HVAC", sort_order: 21 },
  { pm_id: "PM319", label: "Chiller RTAC-275 (Prep) WF2", seriesKey: "F2 CHILLER RTAC-275 (PREP)", category: "chiller", categoryLabel: "Chiller", endpoint_url: "electric_ew23", factory: "wf2", department: "HVAC", sort_order: 22 },

  // 5. HVAC Warehouse & Penerangan (8 Units)
  { pm_id: "PM134", label: "WH 4 Penerangan WF1", seriesKey: "F1 WH 4 PENERANGAN", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew21", factory: "wf1", department: "Other", sort_order: 23 },
  { pm_id: "PM154", label: "Lighting WH 1 WF1", seriesKey: "F1 LIGHTING WH 1", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew21", factory: "wf1", department: "Other", sort_order: 24 },
  { pm_id: "PM151", label: "HVAC Office Atas WF1", seriesKey: "F1 HVAC OFFICE ATAS", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew21", factory: "wf1", department: "HVAC", sort_order: 25 },
  { pm_id: "PM179", label: "HVAC WH-3 WF1", seriesKey: "F1 HVAC WH-3", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew21", factory: "wf1", department: "HVAC", sort_order: 26 },
  { pm_id: "PM207", label: "WH 6 WF2", seriesKey: "F2 WH 6", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew22", factory: "wf2", department: "Other", sort_order: 27 },
  { pm_id: "PM208", label: "WH 5 WF2", seriesKey: "F2 WH 5", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew22", factory: "wf2", department: "Other", sort_order: 28 },
  { pm_id: "PM226", label: "WH-7 WF2", seriesKey: "F2 WH-7", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew22", factory: "wf2", department: "Other", sort_order: 29 },
  { pm_id: "PM288", label: "Penerangan PD WF2", seriesKey: "F2 Penerangan PD", category: "hvac_wh", categoryLabel: "HVAC Warehouse & Penerangan", endpoint_url: "electric_ew22", factory: "wf2", department: "Other", sort_order: 30 },

  // 6. HVAC QC & Produksi (9 Units)
  { pm_id: "PM138", label: "Full Cooling WF1-U3", seriesKey: "F1 FULL COOLING WF1-U3", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 31 },
  { pm_id: "PM153", label: "HVAC-QC WF1", seriesKey: "F1 HVAC-QC", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew21", factory: "wf1", department: "HVAC", sort_order: 32 },
  { pm_id: "PM185", label: "HVAC WF1U3", seriesKey: "F1 HVAC WF1U3", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew21", factory: "wf1", department: "HVAC", sort_order: 33 },
  { pm_id: "PM203", label: "Heater WF2U2", seriesKey: "F2 HEATER WF2U2", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 34 },
  { pm_id: "PM205", label: "AHU WF2UI", seriesKey: "F2 AHU WF2UI", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew22", factory: "wf2", department: "HVAC", sort_order: 35 },
  { pm_id: "PM273", label: "Return Sample QC WF2", seriesKey: "RETURN SAMPLE QC", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew22", factory: "wf2", department: "Other", sort_order: 36 },
  { pm_id: "PM321", label: "AHU-1 - WF2U2", seriesKey: "F2 AHU-1 - WF2U2", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew23", factory: "wf2", department: "HVAC", sort_order: 37 },
  { pm_id: "PM322", label: "AHU-2 - WF2U2", seriesKey: "F2 AHU-2 - WF2U2", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew23", factory: "wf2", department: "HVAC", sort_order: 38 },
  { pm_id: "PM132", label: "Main Supply QC Office & Lab WF1", seriesKey: "F1 MAIN SUPPLY QC OFFICE & LAB", category: "hvac_qc", categoryLabel: "HVAC QC & Produksi", endpoint_url: "electric_ew21", factory: "wf1", department: "Other", sort_order: 39 },

  // 7. Panel Distribusi & Water Treatment / Process (15 Units)
  { pm_id: "PM133", label: "MDP3 WF1", seriesKey: "F1 MDP3", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 40 },
  { pm_id: "PM135", label: "MDP-2 WF1", seriesKey: "F1 MDP-2", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 41 },
  { pm_id: "PM136", label: "MDP-1.2 WF1", seriesKey: "F1 MDP-1.2", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 42 },
  { pm_id: "PM139", label: "MDP-1.1 WF1", seriesKey: "F1 MDP-1.1", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 43 },
  { pm_id: "PM175", label: "ST3 WF1", seriesKey: "F1 ST3", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21", factory: "wf1", department: "Utility", sort_order: 44 },
  { pm_id: "PM176", label: "QC Lab WF1", seriesKey: "F1 QC LAB", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew21", factory: "wf1", department: "Other", sort_order: 45 },
  { pm_id: "PM201", label: "PUTR-1 WF2", seriesKey: "F2 PUTR-1", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 46 },
  { pm_id: "PM202", label: "PUTR-2 WF2", seriesKey: "F2 PUTR-2", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 47 },
  { pm_id: "PM210", label: "Main Critical Panel WF2", seriesKey: "F2 MAIN CRITICAL PANEL", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22", factory: "wf2", department: "Utility", sort_order: 48 },
  { pm_id: "PM211", label: "Panel Otoklaf WF2U1", seriesKey: "F2 PANEL OTOKLAF WF2U1", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22", factory: "wf2", department: "Other", sort_order: 49 },
  { pm_id: "PM212", label: "Panel Otoklaf WF2U2", seriesKey: "F2 PANEL OTOKLAF WF2U2", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew22", factory: "wf2", department: "Other", sort_order: 50 },
  { pm_id: "PM320", label: "WT-DU-PSG WF2", seriesKey: "F2 WT-DU-PSG", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew23", factory: "wf2", department: "Utility", sort_order: 51 },
  { pm_id: "PM323", label: "PW Generation - RO WF2", seriesKey: "F2 PW GENERATION - RO", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew23", factory: "wf2", department: "Utility", sort_order: 52 },
  { pm_id: "PM327", label: "PUTR-NEW WF2", seriesKey: "F2 PUTR-NEW", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew23", factory: "wf2", department: "Utility", sort_order: 53 },
  { pm_id: "PM337", label: "MCC BP 7 WF2", seriesKey: "F2 MCC BP 7", category: "distribution", categoryLabel: "Panel Distribusi & Water Treatment", endpoint_url: "electric_ew23", factory: "wf2", department: "Other", sort_order: 54 },

  // 8. Incoming Cubicles (3 Units)
  { pm_id: "PM410", label: "Incoming Cubicle PLN (PM8000)", seriesKey: "incoming cubicle pln", category: "cubicles", categoryLabel: "Incoming Cubicles", endpoint_url: "electric_pln", factory: "wf2", department: "Utility", sort_order: 55 },
  { pm_id: "PM411", label: "Incoming Cubicle WF1 (PM5560)", seriesKey: "incoming cubicle WF1", category: "cubicles", categoryLabel: "Incoming Cubicles", endpoint_url: "electric_wf1", factory: "wf1", department: "Utility", sort_order: 56 },
  { pm_id: "PM412", label: "Incoming Cubicle WF2 (PM5560)", seriesKey: "incoming cubicle WF2", category: "cubicles", categoryLabel: "Incoming Cubicles", endpoint_url: "electric_wf2", factory: "wf2", department: "Utility", sort_order: 57 }
];

export const getEquipmentItemsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    let pgRes = await pool.query(
      `SELECT id, config_type, config_key, label, value, sort_order, enabled, created_at, updated_at 
       FROM electricity_config 
       WHERE config_type = 'equipment_display' 
       ORDER BY sort_order ASC, id ASC`
    );

    // Auto-seed default 57 items if table is empty
    if (pgRes.rows.length === 0) {
      for (const item of DEFAULT_EQUIPMENT_DISPLAY_ITEMS) {
        const cleanKey = item.pm_id.toLowerCase();
        const itemVal = {
          pm_id: item.pm_id,
          seriesKey: item.seriesKey,
          category: item.category,
          categoryLabel: item.categoryLabel,
          endpoint_url: item.endpoint_url,
          factory: item.factory,
          department: item.department,
          is_new_pm: false
        };
        await pool.query(
          `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
           VALUES ('equipment_display', $1, $2, $3, $4, true, NOW())
           ON CONFLICT (config_type, config_key) DO NOTHING`,
          [cleanKey, item.label, JSON.stringify(itemVal), item.sort_order]
        );
      }
      pgRes = await pool.query(
        `SELECT id, config_type, config_key, label, value, sort_order, enabled, created_at, updated_at 
         FROM electricity_config 
         WHERE config_type = 'equipment_display' 
         ORDER BY sort_order ASC, id ASC`
      );
    }

    res.json({ success: true, data: pgRes.rows });
  } catch (err) {
    next(err);
  }
};

export const upsertEquipmentItemHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { config_key, label, value, sort_order, enabled } = req.body;
    if (!label) {
      res.status(400).json({ error: "label is required" });
      return;
    }
    const pool = getPostgresPool();
    const rawPmId = String(value?.pm_id || config_key || label).toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const resolvedPmId = rawPmId.startsWith("PM") ? rawPmId : `PM_${rawPmId}`;
    const cleanKey = (config_key || resolvedPmId).toLowerCase().replace(/[^a-z0-9_]/g, "");

    const pgRes = await pool.query(
      `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
       VALUES ('equipment_display', $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (config_type, config_key)
       DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order, enabled = EXCLUDED.enabled, updated_at = NOW()
       RETURNING id, config_type, config_key, label, value, sort_order, enabled`,
      [cleanKey, label, JSON.stringify(value || {}), sort_order ?? 0, enabled !== false]
    );

    const io = getSocketServer();
    if (io) {
      io.emit("electricity:equipment_config_updated", { action: "upsert", item: pgRes.rows[0] });
    }

    res.json({ success: true, data: pgRes.rows[0] });
  } catch (err) {
    next(err);
  }
};

export const toggleEquipmentItemHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { config_key, enabled } = req.body;
    if (!config_key) {
      res.status(400).json({ error: "config_key is required" });
      return;
    }
    const pool = getPostgresPool();
    const pgRes = await pool.query(
      `UPDATE electricity_config 
       SET enabled = $1, updated_at = NOW() 
       WHERE config_type = 'equipment_display' AND config_key = $2
       RETURNING id, config_key, label, enabled`,
      [Boolean(enabled), String(config_key).toLowerCase()]
    );

    const io = getSocketServer();
    if (io) {
      io.emit("electricity:equipment_config_updated", { action: "toggle", config_key, enabled });
    }

    res.json({ success: true, data: pgRes.rows[0] });
  } catch (err) {
    next(err);
  }
};

export const deleteEquipmentItemHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { configKey } = req.params;
    if (!configKey) {
      res.status(400).json({ error: "configKey is required" });
      return;
    }
    const pool = getPostgresPool();
    await pool.query(
      `DELETE FROM electricity_config WHERE config_type = 'equipment_display' AND config_key = $1`,
      [String(configKey).toLowerCase()]
    );

    const io = getSocketServer();
    if (io) {
      io.emit("electricity:equipment_config_updated", { action: "delete", configKey });
    }

    res.json({ success: true, message: `Item '${configKey}' berhasil dihapus dari tampilan` });
  } catch (err) {
    next(err);
  }
};

export const reorderEquipmentItemsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "items array is required" });
      return;
    }

    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of items) {
        const cleanKey = String(item.config_key || item.pm_id).toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (!cleanKey) continue;

        const curRes = await client.query(
          `SELECT value FROM electricity_config WHERE config_type = 'equipment_display' AND config_key = $1`,
          [cleanKey]
        );
        if (curRes.rows.length > 0) {
          const curVal = typeof curRes.rows[0].value === "object" && curRes.rows[0].value !== null
            ? curRes.rows[0].value
            : JSON.parse(curRes.rows[0].value || "{}");

          const updatedVal = {
            ...curVal,
            category: item.category || curVal.category,
            categoryLabel: item.categoryLabel || curVal.categoryLabel,
            sort_order: item.sort_order !== undefined ? item.sort_order : curVal.sort_order
          };

          await client.query(
            `UPDATE electricity_config 
             SET sort_order = $1, value = $2, updated_at = NOW() 
             WHERE config_type = 'equipment_display' AND config_key = $3`,
            [item.sort_order ?? 0, JSON.stringify(updatedVal), cleanKey]
          );
        } else {
          const newVal = {
            pm_id: String(item.pm_id || cleanKey).toUpperCase(),
            category: item.category || "custom",
            categoryLabel: item.categoryLabel || "Kustom",
            sort_order: item.sort_order ?? 0
          };
          await client.query(
            `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
             VALUES ('equipment_display', $1, $2, $3, $4, true, NOW())
             ON CONFLICT (config_type, config_key) DO UPDATE
             SET sort_order = EXCLUDED.sort_order, value = EXCLUDED.value, updated_at = NOW()`,
            [cleanKey, item.label || cleanKey, JSON.stringify(newVal), item.sort_order ?? 0]
          );
        }
      }
      await client.query("COMMIT");

      const io = getSocketServer();
      if (io) {
        io.emit("electricity:equipment_config_updated", { action: "reorder", count: items.length });
      }

      res.json({ success: true, count: items.length });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

export const renameEquipmentCategoryHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, newCategoryLabel } = req.body;
    if (!category || !newCategoryLabel) {
      res.status(400).json({ error: "category and newCategoryLabel are required" });
      return;
    }

    const pool = getPostgresPool();
    const cleanCat = String(category).trim();
    const cleanLabel = String(newCategoryLabel).trim();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const rowsRes = await client.query(
        `SELECT id, value FROM electricity_config 
         WHERE config_type = 'equipment_display' AND value->>'category' = $1`,
        [cleanCat]
      );

      for (const row of rowsRes.rows) {
        const curVal = typeof row.value === "object" && row.value !== null
          ? row.value
          : JSON.parse(row.value || "{}");

        curVal.categoryLabel = cleanLabel;

        await client.query(
          `UPDATE electricity_config SET value = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(curVal), row.id]
        );
      }

      await client.query("COMMIT");

      const io = getSocketServer();
      if (io) {
        io.emit("electricity:equipment_config_updated", { action: "rename_category", category: cleanCat, newCategoryLabel: cleanLabel });
      }

      res.json({ success: true, updatedCount: rowsRes.rows.length, newCategoryLabel: cleanLabel });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

export const verifyAndRegisterNewPmHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pm_id, label, endpoint_url, category, categoryLabel, department, factory, subArea } = req.body;
    if (!pm_id || !label || !endpoint_url) {
      res.status(400).json({ success: false, error: "pm_id, label, and endpoint_url are required" });
      return;
    }

    const pool = getPostgresPool();
    const rawPmId = String(pm_id).toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const resolvedPmId = rawPmId.startsWith("PM") ? rawPmId : `PM_${rawPmId}`;
    const cleanKey = resolvedPmId.toLowerCase();
    const cleanEndpoint = String(endpoint_url).trim();

    // 1. Verifikasi agar tidak ada data redundan atau duplikat
    let isDuplicate = false;
    try {
      const checkRes = await pool.query(`
        SELECT 1 FROM electric_pm_telemetry WHERE UPPER(pm_id) = $1
        UNION
        SELECT 1 FROM electric_pm_telemetry_minute WHERE UPPER(pm_id) = $1
        UNION
        SELECT 1 FROM electricity_config WHERE (UPPER(value->>'pm_id') = $1 OR UPPER(config_key) = $1)
        LIMIT 1
      `, [resolvedPmId]);
      isDuplicate = (checkRes.rowCount ?? 0) > 0;
    } catch {}

    if (!isDuplicate) {
      isDuplicate = STANDARD_METERS.some(m => m.pm_id.toUpperCase() === resolvedPmId);
    }

    if (isDuplicate) {
      res.status(409).json({
        success: false,
        duplicate: true,
        message: `Power Meter '${resolvedPmId}' sudah ada di database/sistem. Tidak dapat menambahkan duplikat. Anda dapat langsung mengaktifkannya dari daftar item yang ada.`
      });
      return;
    }

    // 2. Verifikasi endpoint URL dan deteksi isinya secara otomatis
    let fullUrl = cleanEndpoint;
    const CORE_URLS: Record<string, string> = {
      "electric_pln": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln",
      "electric_wf1": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf1",
      "electric_wf2": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_wf2",
      "electric_plts": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_plts",
      "electric_ew21": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew21",
      "electric_ew22": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew22",
      "electric_ew23": "http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_ew23"
    };
    if (CORE_URLS[fullUrl]) fullUrl = CORE_URLS[fullUrl];

    let apiData: any = null;
    let detectedFields: string[] = [];
    let initialActivePower: number | null = null;
    let initialActiveEnergy: number | null = null;

    if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        const fetchRes = await fetch(fullUrl, {
          method: "GET",
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!fetchRes.ok) {
          res.status(400).json({
            success: false,
            message: `Endpoint mengembalikan status HTTP ${fetchRes.status}: ${fetchRes.statusText}`
          });
          return;
        }

        apiData = await fetchRes.json();
      } catch (fErr: any) {
        clearTimeout(timeoutId);
        res.status(400).json({
          success: false,
          message: `Gagal menghubungi endpoint: ${fErr.message}`
        });
        return;
      }
    }

    // Ekstraksi otomatis parameter dari isi endpoint
    if (apiData && typeof apiData === "object") {
      const inspectObj = Array.isArray(apiData)
        ? (apiData.find((p: any) => String(p.pm_id || p.pm || "").toUpperCase() === resolvedPmId) || apiData[0] || {})
        : (apiData[resolvedPmId] && typeof apiData[resolvedPmId] === "object" ? apiData[resolvedPmId] : apiData);

      const allKeys = Object.keys(inspectObj);
      detectedFields = allKeys.slice(0, 20);

      // Cari Active Power (exact, suffixed like _PM181, or substring)
      const powerCandidates = ["Active_Power_Total", "Active_Power", "Power", "kW", "ActivePower", "Scale_Total_KW"];
      for (const k of powerCandidates) {
        if (inspectObj[k] !== undefined && inspectObj[k] !== null && !isNaN(Number(inspectObj[k]))) {
          initialActivePower = Number(inspectObj[k]);
          break;
        }
        const suffixed = `${k}_${resolvedPmId}`;
        if (inspectObj[suffixed] !== undefined && inspectObj[suffixed] !== null && !isNaN(Number(inspectObj[suffixed]))) {
          initialActivePower = Number(inspectObj[suffixed]);
          break;
        }
      }
      if (initialActivePower === null) {
        const pKey = allKeys.find((k) => k.toLowerCase().includes("active_power") || k.toLowerCase().includes("power"));
        if (pKey && inspectObj[pKey] !== undefined && !isNaN(Number(inspectObj[pKey]))) {
          initialActivePower = Number(inspectObj[pKey]);
        }
      }

      // Cari Active Energy (exact, suffixed like _PM181, or substring)
      const energyCandidates = ["ActiveEnergy", "Active_Energy", "Energy", "total_kwh", "Total_KWH", "kWh", "Total_kWh"];
      for (const k of energyCandidates) {
        if (inspectObj[k] !== undefined && inspectObj[k] !== null && !isNaN(Number(inspectObj[k]))) {
          initialActiveEnergy = Number(inspectObj[k]);
          break;
        }
        const suffixed = `${k}_${resolvedPmId}`;
        if (inspectObj[suffixed] !== undefined && inspectObj[suffixed] !== null && !isNaN(Number(inspectObj[suffixed]))) {
          initialActiveEnergy = Number(inspectObj[suffixed]);
          break;
        }
      }
      if (initialActiveEnergy === null) {
        const eKey = allKeys.find((k) => k.toLowerCase().includes("activeenergy") || k.toLowerCase().includes("energy") || k.toLowerCase().includes("kwh"));
        if (eKey && inspectObj[eKey] !== undefined && !isNaN(Number(inspectObj[eKey]))) {
          initialActiveEnergy = Number(inspectObj[eKey]);
        }
      }
    }

    // 3. Simpan konfigurasi item baru ke database
    const resolvedCat = category || "custom";
    const resolvedCatLabel = categoryLabel || (resolvedCat === "cooling_tower" ? "Cooling Tower" : resolvedCat === "chiller" ? "Chiller" : resolvedCat === "boiler" ? "Boiler" : resolvedCat === "compressed_air" ? "Compressed Air" : resolvedCat === "hvac_wh" ? "HVAC Warehouse" : resolvedCat === "hvac_qc" ? "HVAC QC & Produksi" : resolvedCat === "distribution" ? "Panel Distribusi" : "Kustom");
    const resolvedDept = department || "Utility";
    const resolvedFact = factory || "wf1";

    const itemValue = {
      pm_id: resolvedPmId,
      seriesKey: label.toUpperCase(),
      category: resolvedCat,
      categoryLabel: resolvedCatLabel,
      endpoint_url: cleanEndpoint,
      department: resolvedDept,
      factory: resolvedFact,
      subArea: subArea || "General",
      is_new_pm: true,
      registered_at: new Date().toISOString()
    };

    // A. Simpan ke electricity_config (equipment_display)
    const eqRes = await pool.query(
      `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
       VALUES ('equipment_display', $1, $2, $3, 999, true, NOW())
       ON CONFLICT (config_type, config_key)
       DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, enabled = true, updated_at = NOW()
       RETURNING id, config_type, config_key, label, value, sort_order, enabled`,
      [cleanKey, label, JSON.stringify(itemValue)]
    );

    // B. Simpan ke sub-metering fact list
    const factType = resolvedFact === "wf1" ? "consumption_fact_1" : "consumption_fact_2";
    await pool.query(
      `INSERT INTO electricity_config (config_type, config_key, label, value, sort_order, enabled, updated_at)
       VALUES ($1, $2, $3, $4, 999, true, NOW())
       ON CONFLICT (config_type, config_key)
       DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, enabled = true, updated_at = NOW()`,
      [factType, cleanKey, label, JSON.stringify(itemValue)]
    );

    // C. Daftarkan ke api_sources
    if (cleanEndpoint.startsWith("http://") || cleanEndpoint.startsWith("https://")) {
      try {
        await pool.query(
          `INSERT INTO api_sources (unit_id, name, url, method, enabled, polling_interval_ms)
           VALUES ('electric_pm', $1, $2, 'GET', true, 2000)`,
          [label, cleanEndpoint]
        );
      } catch {}
    }

    // D. Simpan baris telemetri perdana jika pembacaan nilai terdeteksi
    if (initialActiveEnergy !== null || initialActivePower !== null) {
      try {
        const now = new Date();
        await pool.query(`
          INSERT INTO electric_pm_telemetry_minute (
            t_stamp, group_id, pm_id, status, active_power_total, active_energy, frequency
          ) VALUES ($1, $2, $3, true, $4, $5, 50.0)
          ON CONFLICT (t_stamp, pm_id) DO UPDATE SET
            active_power_total = EXCLUDED.active_power_total,
            active_energy = EXCLUDED.active_energy
        `, [now, (resolvedDept || "utility").toLowerCase(), resolvedPmId, initialActivePower, initialActiveEnergy]);

        await pool.query(`
          INSERT INTO electric_pm_telemetry (
            t_stamp, group_id, pm_id, status, active_power_total, active_energy, frequency
          ) VALUES (date_trunc('hour', $1::timestamp), $2, $3, true, $4, $5, 50.0)
          ON CONFLICT (t_stamp, pm_id) DO UPDATE SET
            active_power_total = EXCLUDED.active_power_total,
            active_energy = EXCLUDED.active_energy
        `, [now, (resolvedDept || "utility").toLowerCase(), resolvedPmId, initialActivePower, initialActiveEnergy]);
      } catch (err: any) {
        console.warn("Initial telemetry insertion warning:", err.message);
      }
    }

    // E. Segarkan scheduler agar continuous polling segera aktif
    try {
      await refreshDynamicCustomPmSources();
    } catch {}

    const io = getSocketServer();
    if (io) {
      io.emit("electricity:equipment_config_updated", { action: "register_pm", item: eqRes.rows[0] });
    }

    res.json({
      success: true,
      message: `Power Meter baru '${resolvedPmId}' (${label}) berhasil diverifikasi, disimpan ke database, dan siap ditampilkan ke web.`,
      item: eqRes.rows[0],
      detectedFields,
      initialValues: {
        activePower: initialActivePower,
        activeEnergy: initialActiveEnergy
      }
    });
  } catch (err) {
    next(err);
  }
};

