import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.config";

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

// Definisikan tipe user yang akan disimpan di req.user
interface UserPayload {
  id: string;
  role: string;
  name?: string;
  machineAccess?: string[]; // daftar machineId yang boleh diakses user
}

// Extend Express Request agar TypeScript mengenali req.user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

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
      machineAccess?: string[];
    };

    req.user = {
      id: payload.sub as string,
      role: payload.role ?? "user",
      name: payload.name,
      machineAccess: payload.machineAccess ?? [] // ambil dari token, default array kosong
    };

    return next();
  } catch {
    return next(createError("Invalid token", 401));
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return next(createError("Unauthorized", 401));
    }

    if (!roles.includes(user.role)) {
      return next(createError("Forbidden", 403));
    }

    return next();
  };
};

/**
 * Middleware untuk mengecek akses ke mesin tertentu (machineId di params)
 */
export const checkMachineScope = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const user = req.user;
  if (!user) {
    return next(createError("Unauthorized", 401));
  }

  const machineId = req.params.machineId;
  if (!machineId) {
    return next(createError("Machine ID is required", 400));
  }

  // Role yang dianggap super admin / dapat mengakses semua mesin
  const superRoles = ["admin", "senior_unit_head", "unit_head"];
  if (superRoles.includes(user.role)) {
    return next();
  }

  // Untuk role lain, cek apakah machineId ada di daftar akses user
  const accessList = user.machineAccess ?? [];
  if (accessList.includes(machineId)) {
    return next();
  }

  return next(createError("Access denied to this machine", 403));
};