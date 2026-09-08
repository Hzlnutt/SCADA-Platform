import { NextFunction, Request, Response } from "express";
import { recordAudit, getClientIp, getClientMac } from "../../services/audit.service";
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
    } else if (actorRole === "unit_head" || actorRole === "unit_head_utility" || actorRole === "unit_head_hvac") {
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
    } else if (actorRole === "unit_head" || actorRole === "unit_head_utility" || actorRole === "unit_head_hvac") {
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
    const actorRole = getActorRole(req);
    if (actorRole) {
      const normalizedRole = actorRole.toLowerCase().trim().replace(/[\s-]+/g, "_");
      const isAuthorized =
        normalizedRole === "admin" ||
        normalizedRole === "superadmin" ||
        normalizedRole === "developer" ||
        normalizedRole === "dev" ||
        normalizedRole === "senior_unit_head" ||
        normalizedRole === "unit_head_utility" ||
        normalizedRole === "unit_head_hvac" ||
        normalizedRole === "unit_head" ||
        normalizedRole === "unithead" ||
        normalizedRole.startsWith("senior_unit_head") ||
        normalizedRole.startsWith("unit_head");

      if (!isAuthorized) {
        return res.status(403).json({
          message: "Akses ditolak: Hanya role Senior Unit Head, Unit Head Utility, Unit Head HVAC, dan Admin yang diizinkan mengubah setpoints atau kontrol HVAC."
        });
      }
    }

    const parsed = hvacControlSchema.parse(req.body);
    const actorId = getActorId(req);
    const clientIp = parsed.clientIp || getClientIp(req);
    const clientMac = parsed.clientMac || getClientMac(req, clientIp);

    const roomMap: Record<string, string> = {
      "ahu-01": "AHU-01",
      "ahu-02": "AHU-02",
      "ahu-03": "AHU-03",
      "utility": "UTILITY"
    };
    const roomName = roomMap[parsed.unitId] || parsed.unitId.toUpperCase();

    const data = await updateHvacState(parsed.unitId, {
      status: parsed.status,
      mode: parsed.mode,
      temp: parsed.temp,
      humid: parsed.humid
    });

    const previous = (data as any).previous || parsed.previousState || {};

    // 1. Check if setpoint changed (Temperature or Humidity)
    const isTempChanged = parsed.temp !== undefined && Math.abs(parsed.temp - (previous.temp ?? parsed.temp)) > 0.01;
    const isHumidChanged = parsed.humid !== undefined && Math.abs(parsed.humid - (previous.humid ?? parsed.humid)) > 0.01;

    if ((isTempChanged || isHumidChanged) && actorId) {
      const changes: Array<{ field: string; from: string; to: string; delta: string }> = [];
      if (isTempChanged) {
        const prevT = typeof previous.temp === "number" ? previous.temp : 0;
        const delta = parsed.temp! - prevT;
        const sign = delta > 0 ? "+" : "";
        changes.push({
          field: "Temperature Setpoint",
          from: `${previous.temp !== undefined ? Number(previous.temp).toFixed(1) : "—"} °C`,
          to: `${parsed.temp!.toFixed(1)} °C`,
          delta: `${sign}${delta.toFixed(1)} °C`
        });
      }
      if (isHumidChanged) {
        const prevH = typeof previous.humid === "number" ? previous.humid : 0;
        const delta = parsed.humid! - prevH;
        const sign = delta > 0 ? "+" : "";
        changes.push({
          field: "Humidity Setpoint",
          from: `${previous.humid !== undefined ? Number(previous.humid).toFixed(1) : "—"} %RH`,
          to: `${parsed.humid!.toFixed(1)} %RH`,
          delta: `${sign}${delta.toFixed(1)} %RH`
        });
      }

      const changeSummary = changes.map(c => `${c.field}: ${c.from} → ${c.to} (${c.delta})`).join(", ");
      const actionTitle = `SETPOINT DIUBAH (${changes.map(c => `${c.field.split(" ")[0]} ${c.to}`).join(", ")})`;

      await recordAudit({
        actorId,
        action: "hvac.setpoint_change",
        resourceType: "hvac",
        resourceId: parsed.unitId,
        ip: clientIp,
        mac: clientMac,
        meta: {
          actionLabel: actionTitle,
          roomName,
          type: "setpoint",
          operatorRole: actorRole || "Operator",
          changes,
          before: { temp: previous.temp, humid: previous.humid },
          after: { temp: data.temp, humid: data.humid },
          description: `Perubahan setpoint pada ${roomName}: ${changeSummary}`,
          networkInfo: {
            ip: clientIp,
            mac: clientMac,
            userAgent: req.headers["user-agent"]
          }
        }
      });
    }

    // 2. Check if operational command / status changed (START / STOP / MAINTENANCE / MODE)
    const isStatusChanged = parsed.status !== undefined && parsed.status !== previous.status;
    const isModeChanged = parsed.mode !== undefined && parsed.mode !== previous.mode;

    if ((parsed.actionLabel || isStatusChanged || isModeChanged) && actorId) {
      let type: "start" | "stop" | "maintenance" | "other" = "other";
      const effectiveStatus = parsed.status || previous.status;
      if (parsed.actionLabel) {
        const lower = parsed.actionLabel.toLowerCase();
        if (lower.includes("start")) type = "start";
        else if (lower.includes("stop")) type = "stop";
        else if (lower.includes("maintenance")) type = "maintenance";
      } else if (effectiveStatus === "Running") {
        type = "start";
      } else if (effectiveStatus === "Stopped") {
        type = "stop";
      } else if (effectiveStatus === "Maintenance") {
        type = "maintenance";
      }

      const statusFrom = previous.status || "Stopped";
      const statusTo = parsed.status || statusFrom;
      const modeFrom = previous.mode || "Auto";
      const modeTo = parsed.mode || modeFrom;

      const actionTitle = parsed.actionLabel || (type === "start" ? "START (ON)" : type === "stop" ? "STOP (OFF)" : type === "maintenance" ? "MAINTENANCE" : "MODE UPDATE");

      const changes: Array<{ field: string; from: string; to: string; delta?: string }> = [];
      if (isStatusChanged) {
        changes.push({
          field: "Status Operasional",
          from: `${statusFrom} (${statusFrom === "Running" ? "ON" : "OFF"})`,
          to: `${statusTo} (${statusTo === "Running" ? "ON" : "OFF"})`
        });
      }
      if (isModeChanged) {
        changes.push({
          field: "Mode Sistem",
          from: modeFrom,
          to: modeTo
        });
      }

      await recordAudit({
        actorId,
        action: "hvac.control",
        resourceType: "hvac",
        resourceId: parsed.unitId,
        ip: clientIp,
        mac: clientMac,
        meta: {
          actionLabel: actionTitle,
          roomName,
          type,
          operatorRole: actorRole || "Operator",
          changes,
          before: { status: statusFrom, mode: modeFrom },
          after: { status: statusTo, mode: modeTo },
          description: `Eksekusi kendali pada ${roomName}: ${actionTitle}. Status: ${statusFrom} → ${statusTo}, Mode: ${modeFrom} → ${modeTo}`,
          networkInfo: {
            ip: clientIp,
            mac: clientMac,
            userAgent: req.headers["user-agent"]
          }
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

export const getHvacRetainLiveHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { getHvacRetainLiveState } = await import("../../core/scheduler");
    const data = getHvacRetainLiveState();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
