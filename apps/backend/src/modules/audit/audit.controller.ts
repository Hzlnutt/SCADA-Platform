import { NextFunction, Request, Response } from "express";
import os from "os";
import { getMongoDb } from "../../database/mongo";
import { AUDIT_COLLECTION } from "../../database/collections";

export const getAuditLogsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const db = getMongoDb();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    // Unit / Machine specific filtering
    if (req.query.unitId) {
      const unitIdStr = String(req.query.unitId);
      const unitRegex = new RegExp(unitIdStr, "i");
      query.$or = [
        { resourceId: unitIdStr },
        { resourceId: unitRegex },
        { "meta.unitId": unitIdStr },
        { "meta.unitId": unitRegex },
        { "meta.machineId": unitIdStr },
        { "meta.machineId": unitRegex }
      ];
    }

    // Search by actorId, action, resourceType, resourceId, or meta fields
    if (req.query.search) {
      const searchStr = String(req.query.search);
      const searchRegex = new RegExp(searchStr, "i");
      const searchConditions = [
        { actorId: searchRegex },
        { action: searchRegex },
        { resourceType: searchRegex },
        { resourceId: searchRegex },
        { ip: searchRegex },
        { "meta.name": searchRegex },
        { "meta.email": searchRegex },
        { "meta.role": searchRegex },
        { "meta.before": searchRegex },
        { "meta.after": searchRegex }
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    if (req.query.action) {
      query.action = req.query.action;
    }

    const collection = db.collection(AUDIT_COLLECTION);
    const total = await collection.countDocuments(query);
    const logs = await collection
      .find(query)
      .sort({ ts: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getNetworkInfoHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const interfaces = os.networkInterfaces();
    let serverIp = "127.0.0.1";

    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (!ifaceList) continue;
      for (const iface of ifaceList) {
        if (iface.family === "IPv4" && !iface.internal) {
          serverIp = iface.address;
          break;
        }
      }
      if (serverIp !== "127.0.0.1") break;
    }

    const forwarded = req.headers["x-forwarded-for"];
    let clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
    if (forwarded) {
      clientIp = String(forwarded).split(",")[0].trim();
    }
    if (clientIp.startsWith("::ffff:")) {
      clientIp = clientIp.substring(7);
    }
    if (clientIp === "::1") {
      clientIp = "127.0.0.1";
    }

    res.json({
      serverIp,
      clientIp,
      hostname: os.hostname()
    });
  } catch (err) {
    next(err);
  }
};
