import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.config";

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;
  if (!header) {
    return next(createError("Missing Authorization header", 401));
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(createError("Invalid Authorization header", 401));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & {
      role?: string;
      name?: string;
    };
    (req as unknown as { user?: { id: string; role: string; name?: string } })
      .user = {
      id: payload.sub as string,
      role: payload.role ?? "user",
      name: payload.name
    };

    return next();
  } catch {
    return next(createError("Invalid token", 401));
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as unknown as { user?: { role: string } }).user;
    if (!user) {
      return next(createError("Unauthorized", 401));
    }

    if (!roles.includes(user.role)) {
      return next(createError("Forbidden", 403));
    }

    return next();
  };
};
