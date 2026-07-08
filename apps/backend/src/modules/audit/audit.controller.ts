import { NextFunction, Request, Response } from "express";
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

    // Search by actorId, action, resourceType, resourceId, or meta fields
    if (req.query.search) {
      const searchStr = String(req.query.search);
      const searchRegex = new RegExp(searchStr, "i");
      query.$or = [
        { actorId: searchRegex },
        { action: searchRegex },
        { resourceType: searchRegex },
        { resourceId: searchRegex },
        { "meta.name": searchRegex },
        { "meta.email": searchRegex },
        { "meta.role": searchRegex },
        { "meta.before": searchRegex },
        { "meta.after": searchRegex }
      ];
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
