import { NextFunction, Request, Response } from "express";
import {
  listThresholds,
  getThresholdByGroup,
  upsertThreshold
} from "./thresholds.service";
import {
  thresholdPatchSchema,
  thresholdUpsertSchema
} from "./thresholds.validation";

export const listThresholdsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listThresholds();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getThresholdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const groupId = req.params.groupId;
    const data = await getThresholdByGroup(groupId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const upsertThresholdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const groupId = req.params.groupId;
    const parsed = req.method === "PUT"
      ? thresholdUpsertSchema.parse({ ...req.body, groupId })
      : thresholdPatchSchema.parse({ ...req.body, groupId });
    const data = await upsertThreshold(groupId, parsed);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
