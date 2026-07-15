import { NextFunction, Request, Response } from "express";
import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import {
  MACHINE_CATEGORIES_COLLECTION,
  MACHINE_CONFIGS_COLLECTION,
  MACHINE_THRESHOLDS_COLLECTION,
  GLOBAL_CONFIG_COLLECTION
} from "../../database/collections";
import { z } from "zod";
import { getSocketServer } from "../../services/socket.manager";
import { recordAudit, getClientIp } from "../../services/audit.service";

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
        before: beforeThresholds.map(t => ({
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

const utilityConfigSchema = z.object({
  wbpRate: z.number().nonnegative(),
  lwbpRate: z.number().nonnegative()
});

export const getUtilityConfigHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const config = await db.collection(GLOBAL_CONFIG_COLLECTION).findOne({ key: "utility" });
    if (config) {
      res.json({
        data: {
          wbpRate: config.wbpRate,
          lwbpRate: config.lwbpRate
        }
      });
    } else {
      res.json({
        data: {
          wbpRate: 1600,
          lwbpRate: 1112
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

    const doc = {
      key: "utility",
      wbpRate: parsed.wbpRate,
      lwbpRate: parsed.lwbpRate,
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
        before: { wbpRate: oldWbpRate, lwbpRate: oldLwbpRate },
        after: { wbpRate: parsed.wbpRate, lwbpRate: parsed.lwbpRate }
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
    
    res.json({ success: true, data: rules });
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

    // 5. Query tasks using filters
    const { status, unitId, motorKey, startDate, endDate } = req.query;
    
    // Date Range filters default: This month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const filterStart = startDate ? new Date(startDate as string) : startOfMonth;
    const filterEnd = endDate ? new Date((endDate as string) + " 23:59:59") : endOfMonth;

    let queryStr = `
      SELECT id, unit_id, motor_key, target_hours, warning_hours, task_name, status, trigger_base_hours, actual_hours_at_trigger, completed_at, completion_status, created_at
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
    await pool.query(
      `UPDATE running_hours_tasks 
       SET status = 'close', completed_at = CURRENT_TIMESTAMP, completion_status = $1
       WHERE id = $2`,
      [completionStatus, id]
    );

    // Save baseline
    await pool.query(
      `INSERT INTO running_hours_baselines (unit_id, motor_key, target_hours, task_name, baseline_hours)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (unit_id, motor_key, target_hours, task_name)
       DO UPDATE SET baseline_hours = EXCLUDED.baseline_hours`,
      [task.unit_id, task.motor_key, task.target_hours, task.task_name, actualRh]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
