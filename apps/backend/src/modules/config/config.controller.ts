import { NextFunction, Request, Response } from "express";
import { getMongoDb } from "../../database/mongo";
import {
  MACHINE_CATEGORIES_COLLECTION,
  MACHINE_CONFIGS_COLLECTION,
  MACHINE_THRESHOLDS_COLLECTION,
  GLOBAL_CONFIG_COLLECTION
} from "../../database/collections";
import { z } from "zod";

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

    if (!result) {
      return res.status(404).json({ message: "Machine not found" });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const deleteMachineHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getMongoDb();
    const { id } = req.params;

    // Hard-delete config, thresholds, etc.
    await db.collection(MACHINE_CONFIGS_COLLECTION).deleteOne({ id });
    await db.collection(MACHINE_THRESHOLDS_COLLECTION).deleteMany({ machineId: id });

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

    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
};
