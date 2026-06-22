import { NextFunction, Request, Response } from "express";
import { recordAudit } from "../../services/audit.service";
import {
  bootstrapAdmin,
  loginWithGoogle,
  login,
  logout,
  register,
  refreshAccessToken
} from "./auth.service";
import { env } from "../../config/env.config";
import {
  bootstrapSchema,
  googleSchema,
  loginSchema,
  logoutSchema,
  registerSchema,
  refreshSchema
} from "./auth.validation";

export const loginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const result = await login(parsed);

    await recordAudit({
      actorId: result.user.id,
      action: "auth.login",
      resourceType: "user",
      resourceId: result.user.id,
      meta: { ip: req.ip }
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const refreshHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = refreshSchema.parse(req.body);
    const result = await refreshAccessToken(parsed);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const registerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const err = new Error("Self-registration is disabled. Contact your administrator.") as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  } catch (err) {
    next(err);
  }
};

export const googleLoginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = googleSchema.parse(req.body);
    const result = await loginWithGoogle(parsed);

    await recordAudit({
      actorId: result.user.id,
      action: "auth.google",
      resourceType: "user",
      resourceId: result.user.id
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const googleConfigHandler = (_req: Request, res: Response) => {
  res.json({ clientId: env.googleClientId || null });
};

export const logoutHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = logoutSchema.parse(req.body);
    const result = await logout(parsed);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const bootstrapHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = bootstrapSchema.parse(req.body);
    const result = await bootstrapAdmin(parsed);

    await recordAudit({
      actorId: result.id,
      action: "auth.bootstrap",
      resourceType: "user",
      resourceId: result.id
    });

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
};
