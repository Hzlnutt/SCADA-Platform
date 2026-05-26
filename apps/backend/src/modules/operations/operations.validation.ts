import { z } from "zod";

export const maintenanceSchema = z.object({
  date: z.string().min(10),
  item: z.string().min(2),
  abnormality: z.string().optional(),
  action: z.string().min(2),
  downtimeHours: z.coerce.number().min(0),
  technician: z.string().min(2),
  status: z.enum(["completed", "monitoring", "planned"]),
  notes: z.string().optional()
});

export const shiftReportSchema = z.object({
  reportDate: z.string().min(10),
  shift: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  runtimeHours: z.coerce.number().min(0),
  downtimeHours: z.coerce.number().min(0),
  output: z.coerce.number().min(0),
  energy: z.coerce.number().min(0),
  notes: z.string().optional()
});

export const maintenanceUpdateSchema = maintenanceSchema.partial();
export const shiftReportUpdateSchema = shiftReportSchema.partial();

export const approvalStatusSchema = z.enum([
  "pending_team_head",
  "pending_leader",
  "approved",
  "rejected"
]);

export const approvalReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().min(2).optional()
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  status: approvalStatusSchema.or(z.literal("all")).optional()
});

export type MaintenanceInput = z.infer<typeof maintenanceSchema>;
export type ShiftReportInput = z.infer<typeof shiftReportSchema>;
export type MaintenanceUpdateInput = z.infer<typeof maintenanceUpdateSchema>;
export type ShiftReportUpdateInput = z.infer<typeof shiftReportUpdateSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type ApprovalReviewInput = z.infer<typeof approvalReviewSchema>;
