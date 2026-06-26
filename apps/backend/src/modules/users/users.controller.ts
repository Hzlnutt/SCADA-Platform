import { NextFunction, Request, Response } from "express";
import { recordAudit } from "../../services/audit.service";
import { verifyPassword } from "../auth/auth.service";
import { env } from "../../config/env.config";
import {
  createUser,
  getUserById,
  listUsers,
  updateUserProfile,
  updateUserRole,
  deleteUser,
  listOperators,
  updateUserBiometrics,
  getBiometricDescriptors
} from "./users.service";
import {
  createUserSchema,
  updateProfileSchema,
  updateUserSchema,
  usersQuerySchema,
  updateBiometricsSchema,
  verifyBiometricsSchema
} from "./users.validation";

export const createUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = createUserSchema.parse(req.body);
    const result = await createUser(parsed);

    const actorId = (req as unknown as { user?: { id: string } }).user?.id;
    if (actorId) {
      await recordAudit({
        actorId,
        action: "user.create",
        resourceType: "user",
        resourceId: result.id,
        meta: { email: result.email, role: result.role }
      });
    }

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const listUsersHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = usersQuerySchema.parse(req.query);
    const data = await listUsers(parsed.limit);

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getMeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) {
      const error = new Error("Unauthorized") as Error & { statusCode?: number };
      error.statusCode = 401;
      return next(error);
    }

    const user = await getUserById(userId);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
};

export const updateMeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) {
      const error = new Error("Unauthorized") as Error & { statusCode?: number };
      error.statusCode = 401;
      return next(error);
    }

    const parsed = updateProfileSchema.parse(req.body);
    const user = await updateUserProfile(userId, parsed);

    await recordAudit({
      actorId: userId,
      action: "user.update_profile",
      resourceType: "user",
      resourceId: userId
    });

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
};

export const updateUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = updateUserSchema.parse(req.body);
    const result = await updateUserRole(req.params.id, parsed);

    const actorId = (req as unknown as { user?: { id: string } }).user?.id;
    if (actorId) {
      await recordAudit({
        actorId,
        action: "user.update_role",
        resourceType: "user",
        resourceId: req.params.id,
        meta: { role: parsed.role }
      });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const deleteUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await deleteUser(req.params.id);

    const actorId = (req as unknown as { user?: { id: string } }).user?.id;
    if (actorId) {
      await recordAudit({
        actorId,
        action: "user.delete",
        resourceType: "user",
        resourceId: req.params.id
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const listOperatorsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listOperators();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateMeBiometricsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parsed = updateBiometricsSchema.parse(req.body);

    const valid = await verifyPassword(userId, parsed.password);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Password salah. Gagal menyimpan data biometrik." });
    }

    // Call Python biometrics service to extract the descriptor for each base64 image
    const descriptors: number[][] = [];
    for (const image of parsed.images) {
      const response = await fetch(`${env.pythonBiometricsUrl}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image })
      });

      if (!response.ok) {
        return res.status(500).json({ success: false, message: "Gagal terhubung dengan layanan computer vision Python." });
      }

      const result = (await response.json()) as { success: boolean; descriptor?: number[]; message?: string };
      if (!result.success || !result.descriptor) {
        return res.status(400).json({ success: false, message: result.message || "Gagal mendeteksi pola wajah pada salah satu foto." });
      }

      descriptors.push(result.descriptor);
    }

    const user = await updateUserBiometrics(userId, descriptors);

    await recordAudit({
      actorId: userId,
      action: "user.update_biometrics",
      resourceType: "user",
      resourceId: userId
    });

    res.json({ success: true, message: "Data biometrik wajah berhasil disimpan.", data: user });
  } catch (err) {
    next(err);
  }
};

export const verifyMeBiometricsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) {
      return res.status(401).json({ valid: false, message: "Unauthorized" });
    }

    const parsed = verifyBiometricsSchema.parse(req.body);

    const storedDescriptors = await getBiometricDescriptors(userId);
    if (!storedDescriptors || storedDescriptors.length === 0) {
      return res.status(400).json({ valid: false, message: "Biometrik wajah belum terdaftar untuk akun ini." });
    }

    // Call Python biometrics service to extract descriptor for comparison
    const response = await fetch(`${env.pythonBiometricsUrl}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: parsed.image })
    });

    if (!response.ok) {
      return res.status(500).json({ valid: false, message: "Gagal terhubung dengan layanan computer vision Python." });
    }

    const result = (await response.json()) as { success: boolean; descriptor?: number[]; message?: string };
    if (!result.success || !result.descriptor) {
      return res.status(400).json({ valid: false, message: result.message || "Gagal mendeteksi pola wajah pada kamera." });
    }

    // Compare the current descriptor against all stored descriptors
    let minDistance = Infinity;
    for (const stored of storedDescriptors) {
      if (stored.length !== result.descriptor.length) continue;
      
      let sum = 0;
      for (let i = 0; i < stored.length; i++) {
        sum += Math.pow(stored[i] - result.descriptor[i], 2);
      }
      const distance = Math.sqrt(sum);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    if (minDistance === Infinity) {
      return res.status(400).json({ valid: false, message: "Format deskriptor wajah tidak cocok." });
    }

    // Face shape matching threshold: 0.22 (robust for normalized 3D shapes)
    const valid = minDistance <= 0.22;

    res.json({ valid, distance: minDistance });
  } catch (err) {
    next(err);
  }
};

