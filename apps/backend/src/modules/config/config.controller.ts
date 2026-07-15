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
    itemKey: "FAN-1",
    displayName: "FAN-1 (Motor Fan 1)",
    rules: [
      { targetHours: 500, tasks: ["Check V-Belt Tension", "Visual Inspection"] },
      { targetHours: 1000, tasks: ["Clean Fan Blades"] }
    ]
  },
  {
    itemKey: "FAN-2",
    displayName: "FAN-2 (Motor Fan 2)",
    rules: [
      { targetHours: 500, tasks: ["Check V-Belt Tension", "Visual Inspection"] },
      { targetHours: 1000, tasks: ["Clean Fan Blades"] }
    ]
  },
  {
    itemKey: "FAN-3",
    displayName: "FAN-3 (Motor Fan 3)",
    rules: [
      { targetHours: 500, tasks: ["Check V-Belt Tension", "Visual Inspection"] },
      { targetHours: 1000, tasks: ["Clean Fan Blades"] }
    ]
  },
  {
    itemKey: "MTR-1",
    displayName: "MTR-1 (Motor Sirkulasi 1)",
    rules: [
      { targetHours: 500, tasks: ["Strainer Inspection", "Pump Bearing Lubrication"] },
      { targetHours: 1000, tasks: ["Seal Inspection"] }
    ]
  },
  {
    itemKey: "MTR-2",
    displayName: "MTR-2 (Motor Sirkulasi 2)",
    rules: [
      { targetHours: 1000, tasks: ["Motor Overhaul/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "MTR-3",
    displayName: "MTR-3 (Motor Sirkulasi 3)",
    rules: [
      { targetHours: 1000, tasks: ["Motor Overhaul/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "MTR-4",
    displayName: "MTR-4 (Motor DU-3)",
    rules: [
      { targetHours: 1000, tasks: ["Motor Overhaul/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "MTR-5",
    displayName: "MTR-5 (Motor BP-3)",
    rules: [
      { targetHours: 1000, tasks: ["Motor Overhaul/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "MTR-6",
    displayName: "MTR-6 (Motor SP-3)",
    rules: [
      { targetHours: 1000, tasks: ["Motor Overhaul/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "MTR-7",
    displayName: "MTR-7 (Motor ST-3)",
    rules: [
      { targetHours: 1000, tasks: ["Motor Overhaul/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "MTR-8",
    displayName: "MTR-8 (Motor Washing)",
    rules: [
      { targetHours: 1000, tasks: ["Motor Overhaul/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "MTR-9",
    displayName: "MTR-9 (Motor Mini Lab)",
    rules: [
      { targetHours: 1000, tasks: ["Motor Overhaul/Bearing Inspection"] }
    ]
  },
  {
    itemKey: "Dosing Pump 1",
    displayName: "Dosing Pump 1",
    rules: [
      { targetHours: 500, tasks: ["Strainer Inspection"] }
    ]
  },
  {
    itemKey: "Dosing Pump 2",
    displayName: "Dosing Pump 2",
    rules: [
      { targetHours: 500, tasks: ["Strainer Inspection"] }
    ]
  },
  {
    itemKey: "Strainer 1",
    displayName: "Strainer 1",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Strainer 2",
    displayName: "Strainer 2",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Strainer 3",
    displayName: "Strainer 3",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Strainer 4",
    displayName: "Strainer 4",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Strainer 5",
    displayName: "Strainer 5",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Strainer 6",
    displayName: "Strainer 6",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Strainer 7",
    displayName: "Strainer 7",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Strainer 8",
    displayName: "Strainer 8",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "Strainer 9",
    displayName: "Strainer 9",
    rules: [
      { targetHours: 200, tasks: ["Check Cleanliness"] },
      { targetHours: 600, tasks: ["Clean Filter Element"] }
    ]
  },
  {
    itemKey: "CT 1",
    displayName: "CT 1",
    rules: [
      { targetHours: 600, tasks: ["Basin Debris Clean", "Float Valve Inspection"] }
    ]
  },
  {
    itemKey: "CT 2",
    displayName: "CT 2",
    rules: [
      { targetHours: 600, tasks: ["Basin Debris Clean", "Float Valve Inspection"] }
    ]
  },
  {
    itemKey: "CT 3",
    displayName: "CT 3",
    rules: [
      { targetHours: 600, tasks: ["Basin Debris Clean", "Float Valve Inspection"] }
    ]
  },
  {
    itemKey: "Cooling Tank",
    displayName: "Cooling Tank",
    rules: [
      { targetHours: 1000, tasks: ["Basin Sediment Cleaning", "Flushing & Corrosion Inspect"] }
    ]
  },
  {
    itemKey: "Panel",
    displayName: "Panel",
    rules: [
      { targetHours: 1000, tasks: ["Inverter Cleaning", "Wiring Inspection"] }
    ]
  }
];

export const getRhTaskRulesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query("SELECT value FROM global_configs WHERE key = $1", ["rh_task_rules"]);
    if (result.rows.length > 0) {
      res.json({ data: result.rows[0].value });
    } else {
      res.json({ data: defaultRhTaskRules });
    }
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
