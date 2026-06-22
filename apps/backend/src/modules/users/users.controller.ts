import { NextFunction, Request, Response } from "express";
import { recordAudit } from "../../services/audit.service";
import {
  createUser,
  getUserById,
  listUsers,
  updateUserProfile,
  updateUserRole,
  deleteUser,
  listOperators
} from "./users.service";
import {
  createUserSchema,
  updateProfileSchema,
  updateUserSchema,
  usersQuerySchema
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
