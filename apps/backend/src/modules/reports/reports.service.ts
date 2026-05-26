import crypto from "crypto";
import type { ReportRequestInput } from "./reports.validation";

export const listReports = async () => {
  return [
    {
      id: "daily-ops",
      name: "Daily Operations",
      description: "Daily summary of critical utilities.",
      lastRun: null,
      status: "idle"
    },
    {
      id: "alarm-summary",
      name: "Alarm Summary",
      description: "Alarm events grouped by severity.",
      lastRun: null,
      status: "idle"
    }
  ];
};

export const requestReport = async (input: ReportRequestInput) => {
  return {
    jobId: crypto.randomUUID(),
    status: "queued",
    type: input.type,
    format: input.format
  };
};
