import { NextFunction, Request, Response } from "express";
import {
  getWarehouse7AlarmPreference,
  getWarehouse7Config,
  getWarehouse7LiveOverview,
  getWarehouse7Trend,
  pollWarehouse7Once,
  saveWarehouse7Config,
  setWarehouse7AlarmPreference,
  testWarehouse7Connection,
  WH7_ALLOWED_EDIT_ROLES
} from "../../services/warehouse7.service";

function canEditWh7(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return WH7_ALLOWED_EDIT_ROLES.includes(normalized);
}

export const getWh7OverviewHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const force = req.query.force === "true";
    const [overview, alarmEnabled] = await Promise.all([
      force ? pollWarehouse7Once() : getWarehouse7LiveOverview(),
      getWarehouse7AlarmPreference(req.user?.id || "")
    ]);
    res.json({
      success: true,
      canEditConfig: canEditWh7(req.user?.role),
      alarmEnabled,
      data: overview
    });
  } catch (err) {
    next(err);
  }
};

export const getWh7TrendHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawFilter = String(req.query.filter || "1d");
    const filter = (["1d", "7d", "1m", "custom"].includes(rawFilter) ? rawFilter : "1d") as "1d" | "7d" | "1m" | "custom";
    const start = typeof req.query.start === "string" ? req.query.start : undefined;
    const end = typeof req.query.end === "string" ? req.query.end : undefined;
    const deviceMode = typeof req.query.deviceMode === "string" ? req.query.deviceMode : "all";

    const data = await getWarehouse7Trend({ filter, start, end, deviceMode });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getWh7ConfigHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cfg = await getWarehouse7Config();
    const canEdit = canEditWh7(req.user?.role);
    res.json({
      success: true,
      canEdit,
      data: {
        baseUrl: cfg.baseUrl,
        authMode: cfg.authMode,
        hasApiKey: Boolean(cfg.apiKey),
        apiKeyMasked: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}****${cfg.apiKey.slice(-4)}` : "",
        username: canEdit ? cfg.username : "",
        hasPassword: Boolean(cfg.password),
        idWh: cfg.idWh,
        nmGudang: cfg.nmGudang,
        minTemp: cfg.minTemp,
        maxTemp: cfg.maxTemp,
        pollIntervalMs: cfg.pollIntervalMs
      }
    });
  } catch (err) {
    next(err);
  }
};

export const updateWh7ConfigHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canEditWh7(req.user?.role)) {
      res.status(403).json({
        error: "Akses ditolak. Hanya Unit Head HVAC, Senior Unit Head, Unit Head Utility, dan Admin yang dapat mengubah konfigurasi Warehouse 7."
      });
      return;
    }

    const body = req.body || {};
    const saved = await saveWarehouse7Config({
      baseUrl: body.baseUrl,
      authMode: body.authMode,
      apiKey: body.apiKey,
      username: body.username,
      password: body.password,
      idWh: body.idWh,
      nmGudang: body.nmGudang,
      minTemp: body.minTemp,
      maxTemp: body.maxTemp,
      pollIntervalMs: body.pollIntervalMs
    });

    // Trigger an immediate poll cycle after config update
    pollWarehouse7Once().catch(() => {});

    res.json({
      success: true,
      message: "Konfigurasi Warehouse 7 berhasil disimpan.",
      data: {
        baseUrl: saved.baseUrl,
        authMode: saved.authMode,
        hasApiKey: Boolean(saved.apiKey),
        apiKeyMasked: saved.apiKey ? `${saved.apiKey.slice(0, 4)}****${saved.apiKey.slice(-4)}` : "",
        username: saved.username,
        hasPassword: Boolean(saved.password),
        idWh: saved.idWh,
        nmGudang: saved.nmGudang,
        minTemp: saved.minTemp,
        maxTemp: saved.maxTemp,
        pollIntervalMs: saved.pollIntervalMs
      }
    });
  } catch (err) {
    next(err);
  }
};

export const testWh7ConnectionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!canEditWh7(req.user?.role)) {
      res.status(403).json({ error: "Akses ditolak." });
      return;
    }
    const result = await testWarehouse7Connection(req.body || {});
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || "Gagal terhubung ke API Warehouse"
    });
  }
};

export const getWh7AlarmPrefHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alarmEnabled = await getWarehouse7AlarmPreference(req.user?.id || "");
    res.json({ success: true, alarmEnabled });
  } catch (err) {
    next(err);
  }
};

export const updateWh7AlarmPrefHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || "";
    const alarmEnabled = await setWarehouse7AlarmPreference(userId, Boolean(req.body?.alarmEnabled));
    res.json({ success: true, alarmEnabled });
  } catch (err) {
    next(err);
  }
};
