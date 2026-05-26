import { z } from "zod";

export const userRoleSchema = z.enum([
  "admin",
  "leader",
  "operator",
  "team_head",
  "user"
]);

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: userRoleSchema,
  password: z.string().min(8)
});

export const usersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50)
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().min(4).nullable().optional()
});

export const updateUserSchema = z.object({
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
