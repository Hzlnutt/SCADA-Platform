import { z } from "zod";

export const thresholdMetricSchema = z.enum([
  "kw",
  "kwh",
  "pressure",
  "temperature",
  "flow",
  "vibration"
]);

export const thresholdUpsertSchema = z.object({
  groupId: z.string().min(2),
  groupName: z.string().min(2),
  metric: thresholdMetricSchema,
  unit: z.string().min(1),
  tagIds: z.array(z.string().min(2)).min(1),
  lower: z.coerce.number().optional().nullable(),
  upper: z.coerce.number().optional().nullable(),
  warningPct: z.coerce.number().min(0.5).max(0.99).default(0.9),
  actionText: z.string().min(2).optional()
});

export const thresholdPatchSchema = thresholdUpsertSchema.partial().extend({
  groupId: z.string().min(2)
});

export type ThresholdUpsertInput = z.infer<typeof thresholdUpsertSchema>;
export type ThresholdPatchInput = z.infer<typeof thresholdPatchSchema>;
export type ThresholdMetric = z.infer<typeof thresholdMetricSchema>;
