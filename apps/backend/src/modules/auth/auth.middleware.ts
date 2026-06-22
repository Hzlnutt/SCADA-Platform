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

export const hasMachineAccess = (role: string, machineId: string): boolean => {
  // Admin, senior_unit_head, unit_head, kashift_utility_hvac, and leader have full write access to all machines
  const fullWriteRoles = ["admin", "senior_unit_head", "unit_head", "kashift_utility_hvac", "leader"];
  if (fullWriteRoles.includes(role)) {
    return true;
  }

  const isHvac = machineId.startsWith("hvac-") || 
                 machineId.startsWith("oac-") || 
                 machineId.includes("hvac") ||
                 machineId === "chiller-trane-rtac-250-wf2" || 
                 machineId === "chiller-trane-185-wf2";

  if (role === "kashift_hvac") {
    return isHvac;
  }

  if (role === "kashift_utility") {
    // kashift_utility has access to everything EXCEPT HVAC
    return !isHvac;
  }

  return false;
};

export const checkMachineScope = (req: Request, _res: Response, next: NextFunction) => {
  const user = (req as unknown as { user?: { role: string } }).user;
  const machineId = req.params.machineId;

  if (!user) {
    return next(createError("Unauthorized", 401));
  }

  // Operator has view-only access, they cannot POST/PATCH anything
  if (user.role === "operator") {
    // If it's a GET request, we allow it (handled by routes). For write requests, reject operators.
    if (req.method !== "GET") {
      return next(createError("Forbidden: Operators are view-only", 403));
    }
  }

  if (machineId && !hasMachineAccess(user.role, machineId)) {
    return next(createError("Forbidden: Scoped role cannot access this machine", 403));
  }

  return next();
};
