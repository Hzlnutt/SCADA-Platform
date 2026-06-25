import { Router } from "express";
import {
  bootstrapHandler,
  googleConfigHandler,
  googleLoginHandler,
  loginHandler,
  logoutHandler,
  registerHandler,
  refreshHandler,
  verifyPasswordHandler, // tambahkan
} from "./auth.controller";
import { authenticate } from "./auth.middleware"; // pastikan path benar

export const authRouter = Router();

authRouter.post("/auth/login", loginHandler);
authRouter.post("/auth/register", registerHandler);
authRouter.post("/auth/google", googleLoginHandler);
authRouter.get("/auth/google-config", googleConfigHandler);
authRouter.post("/auth/refresh", refreshHandler);
authRouter.post("/auth/logout", logoutHandler);
authRouter.post("/auth/bootstrap", bootstrapHandler);

// ===== TAMBAHAN: verifikasi password (butuh authentication) =====
authRouter.post("/auth/verify-password", authenticate, verifyPasswordHandler);