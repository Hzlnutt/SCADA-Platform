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
  verifyMeBiometricsHandler,
  requestPasswordChangeHandler,
  getMyPasswordRequestHandler,
  cancelMyPasswordRequestHandler,
  listPasswordChangeApprovalsHandler,
  reviewPasswordChangeApprovalHandler
} from "./users.controller";

export const usersRouter = Router();

// Current User profile & security
usersRouter.get("/users/me", authenticate, getMeHandler);
usersRouter.patch("/users/me", authenticate, updateMeHandler);
usersRouter.post("/users/me/biometrics", authenticate, updateMeBiometricsHandler);
usersRouter.post("/users/me/verify-biometrics", authenticate, verifyMeBiometricsHandler);

// Password change request workflow (Self-service)
usersRouter.post("/users/me/password-request", authenticate, requestPasswordChangeHandler);
usersRouter.get("/users/me/password-request", authenticate, getMyPasswordRequestHandler);
usersRouter.delete("/users/me/password-request", authenticate, cancelMyPasswordRequestHandler);
usersRouter.delete("/users/me/password-request/:id", authenticate, cancelMyPasswordRequestHandler);

// Password change approvals (Admin / Approver)
usersRouter.get(
  "/approvals/password-requests",
  authenticate,
  authorize(["admin", "senior_unit_head", "unit_head_utility", "unit_head_hvac", "unit_head", "leader", "team_head"]),
  listPasswordChangeApprovalsHandler
);
usersRouter.patch(
  "/approvals/password-requests/:id",
  authenticate,
  authorize(["admin", "senior_unit_head", "unit_head_utility", "unit_head_hvac", "unit_head", "leader", "team_head"]),
  reviewPasswordChangeApprovalHandler
);

// Admin User Management
usersRouter.get("/users/operators", authenticate, listOperatorsHandler);
usersRouter.get("/users", authenticate, authorize(["admin"]), listUsersHandler);
usersRouter.post("/users", authenticate, authorize(["admin"]), createUserHandler);
usersRouter.patch("/users/:id", authenticate, authorize(["admin"]), updateUserHandler);
usersRouter.delete("/users/:id", authenticate, authorize(["admin"]), deleteUserHandler);

