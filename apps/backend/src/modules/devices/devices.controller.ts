import { NextFunction, Request, Response } from "express";
import { listDeviceStatus } from "./devices.service";

export const getDeviceStatusHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listDeviceStatus();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
