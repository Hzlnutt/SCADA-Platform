import { Router } from "express";
import { authenticate, authorize } from "../auth/auth.middleware";
import {
  createUserHandler,
  getMeHandler,
  listUsersHandler,
  updateMeHandler,
  updateUserHandler
} from "./users.controller";

export const usersRouter = Router();

usersRouter.get("/users/me", authenticate, getMeHandler);
usersRouter.patch("/users/me", authenticate, updateMeHandler);
usersRouter.get("/users", authenticate, authorize(["admin"]), listUsersHandler);
usersRouter.post("/users", authenticate, authorize(["admin"]), createUserHandler);
usersRouter.patch("/users/:id", authenticate, authorize(["admin"]), updateUserHandler);
