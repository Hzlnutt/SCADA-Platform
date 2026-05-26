import { z } from "zod";

export const historianPointSchema = z.object({
  tagId: z.string().min(1),
  deviceId: z.string().min(1).optional(),
  unit: z.string().optional(),
  area: z.string().optional(),
  value: z.union([z.number(), z.string(), z.boolean()]),
  quality: z.enum(["good", "bad", "uncertain"]).optional(),
  ts: z.coerce.date().optional()
});

export const historianIngestSchema = z.object({
  points: z.array(historianPointSchema).min(1)
});

export const historianRangeQuerySchema = z.object({
  tagId: z.string().min(1),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  resolution: z.enum(["1m", "1h"]).default("1m"),
  limit: z.coerce.number().int().positive().max(10000).default(1000)
});

export type HistorianPointInput = z.infer<typeof historianPointSchema>;
