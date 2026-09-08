import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.config";
import { getPostgresPool } from "../../database/postgres";

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

type CachedUser = {
  id: number | string;
  username: string;
  name: string;
  role: string;
  status: string;
  cachedAt: number;
};

const userAuthCache = new Map<string, CachedUser | null>();
const CACHE_TTL_MS = 5000; // 5 detik untuk performa tinggi & invalidasi cepat

export const invalidateUserAuthCache = (userId?: string) => {
  if (userId) {
    userAuthCache.delete(userId);
    userAuthCache.delete(String(userId).toLowerCase());
  } else {
    userAuthCache.clear();
  }
};

const getActiveUserForAuth = async (userId: string): Promise<CachedUser | null> => {
  const cached = userAuthCache.get(userId);
  const now = Date.now();
  if (cached !== undefined && (now - (cached ? cached.cachedAt : 0) < CACHE_TTL_MS)) {
    return cached;
  }

  const pool = getPostgresPool();
  try {
    const res = await pool.query(`
      SELECT id, username, name, role, status
      FROM users
      WHERE id::text = $1 OR LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
      LIMIT 1
    `, [userId]);

    if (res.rows.length === 0) {
      userAuthCache.set(userId, null);
      return null;
    }

    const u: CachedUser = {
      ...res.rows[0],
      cachedAt: now
    };
    userAuthCache.set(userId, u);
    return u;
  } catch {
    // Jika terjadi error koneksi sementara, fallback ke null agar aman
    return null;
  }
};

export const authenticate = async (
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

  let payload: jwt.JwtPayload & {
    role?: string;
    name?: string;
    machineAccess?: string[];
  };

  try {
    payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & {
      role?: string;
      name?: string;
      machineAccess?: string[];
    };
  } catch {
    return next(createError("Invalid token", 401));
  }

  const userId = payload.sub as string;
  if (!userId) {
    return next(createError("Invalid token subject", 401));
  }

  // Real-time verification: cek keberadaan & status user di database PostgreSQL
  const dbUser = await getActiveUserForAuth(userId);
  if (!dbUser) {
    return next(createError("Sesi login tidak valid atau akun telah dihapus. Silakan login kembali.", 401));
  }

  if (dbUser.status === "disabled") {
    return next(createError("Akun Anda telah dinonaktifkan. Silakan hubungi administrator.", 403));
  }

  req.user = {
    id: String(dbUser.id),
    role: dbUser.role || payload.role || "user",
    name: dbUser.name || payload.name,
    machineAccess: payload.machineAccess ?? [] // ambil dari token, default array kosong
  };

  return next();
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
  const superRoles = [
    "admin",
    "senior_unit_head",
    "unit_head_utility",
    "unit_head_hvac",
    "unit_head"
  ];
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