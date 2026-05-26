import { z } from "zod";

export const alarmEventSchema = z.object({
  alarmKey: z.string().min(1),
  tagId: z.string().min(1),
  deviceId: z.string().min(1).optional(),
  unit: z.string().optional(),
  area: z.string().optional(),
  message: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["active", "ack", "cleared"]),
  ts: z.coerce.date().optional(),
  ack: z
    .object({
      userId: z.string().min(1).optional(),
      note: z.string().optional()
    })
    .optional()
});

export const alarmIngestSchema = z.object({
  events: z.array(alarmEventSchema).min(1)
});

export const alarmActiveQuerySchema = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100)
});

export const alarmHistoryQuerySchema = z.object({
  alarmKey: z.string().min(1).optional(),
  tagId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(5000).default(1000)
});

export const alarmAckSchema = z.object({
  alarmKey: z.string().min(1),
  userId: z.string().min(1),
  note: z.string().optional()
});

export type AlarmEventInput = z.infer<typeof alarmEventSchema>;
export type AlarmAckInput = z.infer<typeof alarmAckSchema>;
