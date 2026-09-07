import { z } from "zod";

export const userRoleSchema = z.enum([
  "admin",
  "senior_unit_head",
  "unit_head_utility",
  "unit_head_hvac",
  "unit_head",
  "kashift_utility_hvac",
  "kashift_utility",
  "kashift_hvac",
  "leader",
  "operator",
  "user"
]);

export const createUserSchema = z
  .object({
    username: z.string().min(2).optional(),
    email: z.string().optional(),
    name: z.string().min(2),
    role: userRoleSchema,
    password: z.string().min(1)
  })
  .refine((data) => !!(data.username || data.email), {
    message: "Username or email is required"
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

export const updateBiometricsSchema = z.object({
  password: z.string(),
  images: z.array(z.string())
});

export const verifyBiometricsSchema = z.object({
  image: z.string()
});

export const requestPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter")
});

export const reviewPasswordChangeSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional()
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateBiometricsInput = z.infer<typeof updateBiometricsSchema>;
export type VerifyBiometricsInput = z.infer<typeof verifyBiometricsSchema>;
export type RequestPasswordChangeInput = z.infer<typeof requestPasswordChangeSchema>;
export type ReviewPasswordChangeInput = z.infer<typeof reviewPasswordChangeSchema>;

