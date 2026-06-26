import { NextFunction, Request, Response } from "express";
import { recordAudit } from "../../services/audit.service";
import {
  createMaintenance,
  createShiftReport,
  listAllMaintenance,
  listAllShiftReports,
  listMaintenance,
  listShiftReports,
  reviewMaintenance,
  reviewShiftReport,
  updateMaintenance,
  updateShiftReport,
  getHvacStates,
  updateHvacState,
  getHvacLogs
} from "./operations.service";
import {
  approvalReviewSchema,
  listQuerySchema,
  maintenanceSchema,
  maintenanceUpdateSchema,
  shiftReportSchema,
  shiftReportUpdateSchema,
  hvacControlSchema
} from "./operations.validation";

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const getMachineId = (req: Request) => req.params.machineId;

const getActorId = (req: Request) =>
  (req as unknown as { user?: { id: string } }).user?.id;

const getActorRole = (req: Request) =>
  (req as unknown as { user?: { role: string } }).user?.role ?? "user";

export const listMaintenanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const machineId = getMachineId(req);
    const parsed = listQuerySchema.parse(req.query);
    const role = getActorRole(req);
    if (parsed.status && parsed.status !== "approved" && role === "user") {
      throw createError("Forbidden", 403);
    }
    const data = await listMaintenance(machineId, parsed.limit, parsed.status);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const listAllMaintenanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = listQuerySchema.parse(req.query);
    const role = getActorRole(req);
    if (parsed.status && parsed.status !== "approved" && role === "user") {
      throw createError("Forbidden", 403);
    }
    const data = await listAllMaintenance(parsed.limit, parsed.status);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const createMaintenanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const machineId = getMachineId(req);
    const parsed = maintenanceSchema.parse(req.body);
    const actorId = getActorId(req);
    const data = await createMaintenance(machineId, parsed, actorId);

    if (actorId) {
      await recordAudit({
        actorId,
        action: "maintenance.create",
        resourceType: "maintenance",
        resourceId: data.id,
        meta: { machineId }
      });
    }

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateMaintenanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const machineId = getMachineId(req);
    const recordId = req.params.id;
    const parsed = maintenanceUpdateSchema.parse(req.body);
    const actorId = getActorId(req);
    const data = await updateMaintenance(machineId, recordId, parsed);

    if (actorId) {
      await recordAudit({
        actorId,
        action: "maintenance.update",
        resourceType: "maintenance",
        resourceId: data.id,
        meta: { machineId }
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const listShiftReportsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const machineId = getMachineId(req);
    const parsed = listQuerySchema.parse(req.query);
    const role = getActorRole(req);
    if (parsed.status && parsed.status !== "approved" && role === "user") {
      throw createError("Forbidden", 403);
    }
    const data = await listShiftReports(machineId, parsed.limit, parsed.status);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const listAllShiftReportsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = listQuerySchema.parse(req.query);
    const data = await listAllShiftReports(parsed.limit, parsed.status);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const createShiftReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const machineId = getMachineId(req);
    const parsed = shiftReportSchema.parse(req.body);
    const actorId = getActorId(req);
    const data = await createShiftReport(machineId, parsed, actorId);

    if (actorId) {
      await recordAudit({
        actorId,
        action: "shift_report.create",
        resourceType: "shift_report",
        resourceId: data.id,
        meta: { machineId }
      });
    }

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateShiftReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const machineId = getMachineId(req);
    const recordId = req.params.id;
    const parsed = shiftReportUpdateSchema.parse(req.body);
    const actorId = getActorId(req);
    const data = await updateShiftReport(machineId, recordId, parsed);

    if (actorId) {
      await recordAudit({
        actorId,
        action: "shift_report.update",
        resourceType: "shift_report",
        resourceId: data.id,
        meta: { machineId }
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const reviewMaintenanceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const recordId = req.params.id;
    const parsed = approvalReviewSchema.parse(req.body);
    const actorId = getActorId(req);
    
    const actorRole = getActorRole(req);
    let role: "team_head" | "leader" | "admin" = "team_head";
    if (actorRole === "admin" || actorRole === "senior_unit_head") {
      role = "admin";
    } else if (actorRole === "unit_head") {
      role = "leader";
    } else if (actorRole.startsWith("kashift_") || actorRole === "leader" || actorRole === "team_head") {
      role = "team_head";
    }

    const data = await reviewMaintenance(recordId, parsed, role, actorId);

    if (actorId) {
      await recordAudit({
        actorId,
        action: `maintenance.${parsed.action}`,
        resourceType: "maintenance",
        resourceId: data.id
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const reviewShiftReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const recordId = req.params.id;
    const parsed = approvalReviewSchema.parse(req.body);
    const actorId = getActorId(req);
    
    const actorRole = getActorRole(req);
    let role: "team_head" | "leader" | "admin" = "team_head";
    if (actorRole === "admin" || actorRole === "senior_unit_head") {
      role = "admin";
    } else if (actorRole === "unit_head") {
      role = "leader";
    } else if (actorRole.startsWith("kashift_") || actorRole === "leader" || actorRole === "team_head") {
      role = "team_head";
    }

    const data = await reviewShiftReport(recordId, parsed, role, actorId);

    if (actorId) {
      await recordAudit({
        actorId,
        action: `shift_report.${parsed.action}`,
        resourceType: "shift_report",
        resourceId: data.id
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getHvacStatesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getHvacStates();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateHvacStateHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = hvacControlSchema.parse(req.body);
    const actorId = getActorId(req);

    const data = await updateHvacState(parsed.unitId, {
      status: parsed.status,
      mode: parsed.mode,
      temp: parsed.temp,
      humid: parsed.humid
    });

    if (parsed.actionLabel && actorId) {
      const roomMap: Record<string, string> = {
        "ahu-01": "AHU-01",
        "ahu-02": "AHU-02",
        "ahu-03": "AHU-03",
        "utility": "UTILITY"
      };
      const roomName = roomMap[parsed.unitId] || parsed.unitId.toUpperCase();

      let type: "start" | "stop" | "maintenance" | "other" = "other";
      const lowerAction = parsed.actionLabel.toLowerCase();
      if (lowerAction.includes("start")) type = "start";
      else if (lowerAction.includes("stop")) type = "stop";
      else if (lowerAction.includes("maintenance")) type = "maintenance";

      await recordAudit({
        actorId,
        action: "hvac.control",
        resourceType: "hvac",
        resourceId: parsed.unitId,
        meta: {
          actionLabel: parsed.actionLabel,
          roomName,
          type
        }
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getHvacLogsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const data = await getHvacLogs(parsedLimit);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
