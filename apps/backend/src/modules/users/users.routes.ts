import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware";
import {
  createUserHandler,
  getMeHandler,
  listUsersHandler,
  updateMeHandler,
  updateUserHandler,
  deleteUserHandler,
  listOperatorsHandler,
  updateMeBiometricsHandler,
  verifyMeBiometricsHandler
} from "./users.controller";

export const usersRouter = Router();

usersRouter.get("/users/me", authenticate, getMeHandler);
usersRouter.patch("/users/me", authenticate, updateMeHandler);
usersRouter.post("/users/me/biometrics", authenticate, updateMeBiometricsHandler);
usersRouter.post("/users/me/verify-biometrics", authenticate, verifyMeBiometricsHandler);
usersRouter.get("/users/operators", authenticate, listOperatorsHandler);
usersRouter.get("/users", authenticate, authorize(["admin"]), listUsersHandler);
usersRouter.post("/users", authenticate, authorize(["admin"]), createUserHandler);
usersRouter.patch("/users/:id", authenticate, authorize(["admin"]), updateUserHandler);
usersRouter.delete("/users/:id", authenticate, authorize(["admin"]), deleteUserHandler);
