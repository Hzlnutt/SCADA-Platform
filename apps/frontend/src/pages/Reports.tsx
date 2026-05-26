import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { getJson, postJson } from "../services/api.client";

type ReportItem = {
  id: string;
  name: string;
  description: string;
  lastRun: string | null;
  status: string;
};

type ReportsResponse = {
  data: ReportItem[];
};

export default function Reports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getJson<ReportsResponse>("/reports").then((result) => {
      if (mounted) {
        setReports(result.data);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleExport = async (report: ReportItem) => {
    setBusyId(report.id);
    try {
      await postJson("/reports/export", {
        type: report.id === "alarm-summary" ? "alarms" : "daily",
        format: "pdf"
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate PDF and Excel exports."
      />
      <div className="rounded-2xl border border-slate-900 bg-slate-950/60 p-4">
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-900 bg-slate-950/80 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="text-sm font-medium text-slate-100">
                  {report.name}
                </div>
                <div className="text-xs text-slate-400">
                  {report.description}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Last run: {report.lastRun ?? "-"}</span>
                <button
                  type="button"
                  onClick={() => handleExport(report)}
                  disabled={busyId === report.id}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === report.id ? "Queueing..." : "Request Export"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
