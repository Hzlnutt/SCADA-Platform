import { z } from "zod";

export const reportRequestSchema = z.object({
  type: z.enum(["daily", "alarms", "telemetry", "custom"]).default("daily"),
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export type ReportRequestInput = z.infer<typeof reportRequestSchema>;
