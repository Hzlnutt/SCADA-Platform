import { Router } from "express";
import {
	bootstrapHandler,
	googleConfigHandler,
	googleLoginHandler,
	loginHandler,
	logoutHandler,
	registerHandler,
	refreshHandler
} from "./auth.controller";

export const authRouter = Router();

authRouter.post("/auth/login", loginHandler);
authRouter.post("/auth/register", registerHandler);
authRouter.post("/auth/google", googleLoginHandler);
authRouter.get("/auth/google-config", googleConfigHandler);
authRouter.post("/auth/refresh", refreshHandler);
authRouter.post("/auth/logout", logoutHandler);
authRouter.post("/auth/bootstrap", bootstrapHandler);
