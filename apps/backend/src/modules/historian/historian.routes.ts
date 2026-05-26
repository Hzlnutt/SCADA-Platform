import { Router } from "express";
import {
  getHistorianRangeHandler,
  ingestHistorianHandler
} from "./historian.controller";

export const historianRouter = Router();

historianRouter.post("/historian/ingest", ingestHistorianHandler);
historianRouter.get("/historian/range", getHistorianRangeHandler);
