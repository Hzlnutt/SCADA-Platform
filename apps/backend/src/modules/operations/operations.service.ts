import { ObjectId } from "mongodb";
import { MAINTENANCE_COLLECTION, SHIFT_REPORTS_COLLECTION } from "../../database/collections";
import { getMongoDb } from "../../database/mongo";
import type {
  ApprovalReviewInput,
  ApprovalStatus,
  MaintenanceInput,
  MaintenanceUpdateInput,
  ShiftReportInput,
  ShiftReportUpdateInput
} from "./operations.validation";

type ApprovalStep = {
  userId?: string;
  note?: string;
  ts: Date;
};

type ApprovalState = {
  status: ApprovalStatus;
  teamHead?: ApprovalStep;
  leader?: ApprovalStep;
  rejected?: ApprovalStep;
};

type MaintenanceDoc = {
  _id: ObjectId;
  machineId: string;
  date: Date;
  item: string;
  abnormality?: string;
  action: string;
  downtimeHours: number;
  technician: string;
  status: "completed" | "monitoring" | "planned";
  notes?: string;
  approval?: ApprovalState;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

type ShiftReportDoc = {
  _id: ObjectId;
  machineId: string;
  reportDate: Date;
  shift: string;
  start: string;
  end: string;
  runtimeHours: number;
  downtimeHours: number;
  output: number;
  energy: number;
  notes?: string;
  approval?: ApprovalState;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const parseDate = (value: string, field: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError(`Invalid ${field}`, 400);
  }
  return date;
};

const toMaintenanceResponse = (doc: MaintenanceDoc & { issue?: string }) => ({
  id: doc._id.toString(),
  machineId: doc.machineId,
  date: doc.date.toISOString(),
  item: doc.item ?? doc.issue ?? "Unknown",
  abnormality: doc.abnormality ?? null,
  action: doc.action,
  downtimeHours: doc.downtimeHours,
  technician: doc.technician,
  status: doc.status,
  notes: doc.notes ?? null,
  approvalStatus: doc.approval?.status ?? "approved"
});

const toShiftReportResponse = (doc: ShiftReportDoc) => ({
  id: doc._id.toString(),
  machineId: doc.machineId,
  reportDate: doc.reportDate.toISOString(),
  shift: doc.shift,
  start: doc.start,
  end: doc.end,
  runtimeHours: doc.runtimeHours,
  downtimeHours: doc.downtimeHours,
  output: doc.output,
  energy: doc.energy,
  notes: doc.notes ?? null,
  approvalStatus: doc.approval?.status ?? "approved"
});

const buildApprovalFilter = (status?: ApprovalStatus | "all") => {
  if (!status) {
    return {
      $or: [
        { "approval.status": "approved" },
        { approval: { $exists: false } }
      ]
    };
  }

  if (status === "all") {
    return {};
  }

  if (status === "approved") {
    return {
      $or: [
        { "approval.status": "approved" },
        { approval: { $exists: false } }
      ]
    };
  }

  return { "approval.status": status };
};

const assertReviewAllowed = (
  current: ApprovalStatus,
  role: "team_head" | "leader" | "admin"
) => {
  if (role === "team_head" && current !== "pending_team_head") {
    throw createError("Approval already processed", 409);
  }

  if (role === "leader" && current !== "pending_leader") {
    throw createError("Approval already processed", 409);
  }
};

export const listMaintenance = async (
  machineId: string,
  limit: number,
  status?: ApprovalStatus | "all"
) => {
  const db = getMongoDb();
  const maintenance = db.collection<MaintenanceDoc>(MAINTENANCE_COLLECTION);

  const rows = await maintenance
    .find({ machineId, ...buildApprovalFilter(status) })
    .sort({ date: -1 })
    .limit(limit)
    .toArray();

  return rows.map(toMaintenanceResponse);
};

export const listAllMaintenance = async (
  limit: number,
  status?: ApprovalStatus | "all"
) => {
  const db = getMongoDb();
  const maintenance = db.collection<MaintenanceDoc>(MAINTENANCE_COLLECTION);

  const rows = await maintenance
    .find(buildApprovalFilter(status))
    .sort({ date: -1 })
    .limit(limit)
    .toArray();

  return rows.map(toMaintenanceResponse);
};

export const createMaintenance = async (
  machineId: string,
  input: MaintenanceInput,
  actorId?: string
) => {
  const db = getMongoDb();
  const maintenance = db.collection<MaintenanceDoc>(MAINTENANCE_COLLECTION);

  const now = new Date();
  const record: MaintenanceDoc = {
    _id: new ObjectId(),
    machineId,
    date: parseDate(input.date, "date"),
    item: input.item,
    abnormality: input.abnormality,
    action: input.action,
    downtimeHours: input.downtimeHours,
    technician: input.technician,
    status: input.status,
    notes: input.notes,
    approval: { status: "pending_team_head" },
    createdBy: actorId,
    createdAt: now,
    updatedAt: now
  };

  await maintenance.insertOne(record);
  return toMaintenanceResponse(record);
};

export const updateMaintenance = async (
  machineId: string,
  recordId: string,
  input: MaintenanceUpdateInput
) => {
  const db = getMongoDb();
  const maintenance = db.collection<MaintenanceDoc>(MAINTENANCE_COLLECTION);

  const update: Partial<MaintenanceDoc> = { updatedAt: new Date() };
  if (input.date) {
    update.date = parseDate(input.date, "date");
  }
  if (input.item) {
    update.item = input.item;
  }
  if (input.abnormality !== undefined) {
    update.abnormality = input.abnormality;
  }
  if (input.action) {
    update.action = input.action;
  }
  if (input.downtimeHours !== undefined) {
    update.downtimeHours = input.downtimeHours;
  }
  if (input.technician) {
    update.technician = input.technician;
  }
  if (input.status) {
    update.status = input.status;
  }
  if (input.notes !== undefined) {
    update.notes = input.notes;
  }

  const result = await maintenance.findOneAndUpdate(
    { _id: new ObjectId(recordId), machineId },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result.value) {
    throw createError("Maintenance record not found", 404);
  }

  return toMaintenanceResponse(result.value);
};

export const listShiftReports = async (
  machineId: string,
  limit: number,
  status?: ApprovalStatus | "all"
) => {
  const db = getMongoDb();
  const shiftReports = db.collection<ShiftReportDoc>(SHIFT_REPORTS_COLLECTION);

  const rows = await shiftReports
    .find({ machineId, ...buildApprovalFilter(status) })
    .sort({ reportDate: -1 })
    .limit(limit)
    .toArray();

  return rows.map(toShiftReportResponse);
};

export const listAllShiftReports = async (
  limit: number,
  status?: ApprovalStatus | "all"
) => {
  const db = getMongoDb();
  const shiftReports = db.collection<ShiftReportDoc>(SHIFT_REPORTS_COLLECTION);

  const rows = await shiftReports
    .find(buildApprovalFilter(status))
    .sort({ reportDate: -1 })
    .limit(limit)
    .toArray();

  return rows.map(toShiftReportResponse);
};

export const createShiftReport = async (
  machineId: string,
  input: ShiftReportInput,
  actorId?: string
) => {
  const db = getMongoDb();
  const shiftReports = db.collection<ShiftReportDoc>(SHIFT_REPORTS_COLLECTION);

  const now = new Date();
  const record: ShiftReportDoc = {
    _id: new ObjectId(),
    machineId,
    reportDate: parseDate(input.reportDate, "reportDate"),
    shift: input.shift,
    start: input.start,
    end: input.end,
    runtimeHours: input.runtimeHours,
    downtimeHours: input.downtimeHours,
    output: input.output,
    energy: input.energy,
    notes: input.notes,
    approval: { status: "pending_team_head" },
    createdBy: actorId,
    createdAt: now,
    updatedAt: now
  };

  await shiftReports.insertOne(record);
  return toShiftReportResponse(record);
};

export const updateShiftReport = async (
  machineId: string,
  recordId: string,
  input: ShiftReportUpdateInput
) => {
  const db = getMongoDb();
  const shiftReports = db.collection<ShiftReportDoc>(SHIFT_REPORTS_COLLECTION);

  const update: Partial<ShiftReportDoc> = { updatedAt: new Date() };
  if (input.reportDate) {
    update.reportDate = parseDate(input.reportDate, "reportDate");
  }
  if (input.shift) {
    update.shift = input.shift;
  }
  if (input.start) {
    update.start = input.start;
  }
  if (input.end) {
    update.end = input.end;
  }
  if (input.runtimeHours !== undefined) {
    update.runtimeHours = input.runtimeHours;
  }
  if (input.downtimeHours !== undefined) {
    update.downtimeHours = input.downtimeHours;
  }
  if (input.output !== undefined) {
    update.output = input.output;
  }
  if (input.energy !== undefined) {
    update.energy = input.energy;
  }
  if (input.notes !== undefined) {
    update.notes = input.notes;
  }

  const result = await shiftReports.findOneAndUpdate(
    { _id: new ObjectId(recordId), machineId },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result.value) {
    throw createError("Shift report not found", 404);
  }

  return toShiftReportResponse(result.value);
};

export const reviewMaintenance = async (
  recordId: string,
  input: ApprovalReviewInput,
  role: "team_head" | "leader" | "admin",
  actorId?: string
) => {
  const db = getMongoDb();
  const maintenance = db.collection<MaintenanceDoc>(MAINTENANCE_COLLECTION);
  const record = await maintenance.findOne({ _id: new ObjectId(recordId) });

  if (!record) {
    throw createError("Maintenance record not found", 404);
  }

  const currentStatus = record.approval?.status ?? "approved";
  assertReviewAllowed(currentStatus, role);

  const ts = new Date();
  const step = { userId: actorId, note: input.note, ts };
  let nextStatus: ApprovalStatus = currentStatus;
  const update: Partial<MaintenanceDoc> = { updatedAt: ts };

  if (input.action === "reject") {
    nextStatus = "rejected";
    update.approval = {
      ...(record.approval ?? { status: currentStatus }),
      status: nextStatus,
      rejected: step
    };
  } else if (role === "team_head") {
    nextStatus = "pending_leader";
    update.approval = {
      ...(record.approval ?? { status: currentStatus }),
      status: nextStatus,
      teamHead: step
    };
  } else {
    nextStatus = "approved";
    update.approval = {
      ...(record.approval ?? { status: currentStatus }),
      status: nextStatus,
      leader: step
    };
  }

  const result = await maintenance.findOneAndUpdate(
    { _id: new ObjectId(recordId) },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result.value) {
    throw createError("Maintenance record not found", 404);
  }

  return toMaintenanceResponse(result.value);
};

export const reviewShiftReport = async (
  recordId: string,
  input: ApprovalReviewInput,
  role: "team_head" | "leader" | "admin",
  actorId?: string
) => {
  const db = getMongoDb();
  const shiftReports = db.collection<ShiftReportDoc>(SHIFT_REPORTS_COLLECTION);
  const record = await shiftReports.findOne({ _id: new ObjectId(recordId) });

  if (!record) {
    throw createError("Shift report not found", 404);
  }

  const currentStatus = record.approval?.status ?? "approved";
  assertReviewAllowed(currentStatus, role);

  const ts = new Date();
  const step = { userId: actorId, note: input.note, ts };
  let nextStatus: ApprovalStatus = currentStatus;
  const update: Partial<ShiftReportDoc> = { updatedAt: ts };

  if (input.action === "reject") {
    nextStatus = "rejected";
    update.approval = {
      ...(record.approval ?? { status: currentStatus }),
      status: nextStatus,
      rejected: step
    };
  } else if (role === "team_head") {
    nextStatus = "pending_leader";
    update.approval = {
      ...(record.approval ?? { status: currentStatus }),
      status: nextStatus,
      teamHead: step
    };
  } else {
    nextStatus = "approved";
    update.approval = {
      ...(record.approval ?? { status: currentStatus }),
      status: nextStatus,
      leader: step
    };
  }

  const result = await shiftReports.findOneAndUpdate(
    { _id: new ObjectId(recordId) },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result.value) {
    throw createError("Shift report not found", 404);
  }

  return toShiftReportResponse(result.value);
};
