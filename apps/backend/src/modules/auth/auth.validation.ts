import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20)
});

export const bootstrapSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8)
});

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8)
});

export const googleSchema = z.object({
  credential: z.string().min(20)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type BootstrapInput = z.infer<typeof bootstrapSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GoogleLoginInput = z.infer<typeof googleSchema>;
