import { z } from "zod";

export const telemetryPointSchema = z.object({
  tagId: z.string().min(1),
  deviceId: z.string().min(1).optional(),
  unit: z.string().optional(),
  area: z.string().optional(),
  value: z.union([z.number(), z.string(), z.boolean()]),
  quality: z.enum(["good", "bad", "uncertain"]).optional(),
  ts: z.coerce.date().optional()
});

export const telemetryIngestSchema = z.object({
  points: z.array(telemetryPointSchema).min(1)
});

export const telemetryRangeQuerySchema = z.object({
  tagId: z.string().min(1),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(5000).default(500)
});

export type TelemetryPointInput = z.infer<typeof telemetryPointSchema>;
