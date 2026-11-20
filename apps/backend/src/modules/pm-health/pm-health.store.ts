import fs from "fs";
import path from "path";
import type {
  AnomalyEvent,
  AnomalyType,
  PmChecklistItem,
  PmChecklistPatch,
  SourceTable
} from "./pm-health.types";

const DATA_DIR = path.resolve(__dirname, "..", "..", "..", "data", "pm-health");
const LOG_FILE = path.join(DATA_DIR, "anomaly-logs.json");
const STATE_FILE = path.join(DATA_DIR, "monitor-state.json");
const CHECKLIST_FILE = path.join(DATA_DIR, "pm-checklist.json");
const MAX_LOGS = 5000;

interface MonitorPersistedState {
  resetAt: string | null;
}

function createEmptyChecklistItem(pmId: string): PmChecklistItem {
  return {
    pmId,
    ewonChecked: false,
    endpointChecked: false,
    panelLcdChecked: false,
    ewonCheckedAt: null,
    endpointCheckedAt: null,
    panelLcdCheckedAt: null,
    notes: "",
    updatedAt: null,
    updatedBy: null
  };
}

class PmHealthLocalStore {
  private logs: Map<string, AnomalyEvent> = new Map();
  private checklist: Map<string, PmChecklistItem> = new Map();
  private state: MonitorPersistedState = { resetAt: null };
  private loaded = false;

  private ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STATE_FILE)) {
        const rawState = fs.readFileSync(STATE_FILE, "utf-8");
        const parsedState = JSON.parse(rawState);
        if (parsedState && (typeof parsedState.resetAt === "string" || parsedState.resetAt === null)) {
          this.state = { resetAt: parsedState.resetAt || null };
        }
      }
      if (fs.existsSync(LOG_FILE)) {
        const raw = fs.readFileSync(LOG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item.id === "string") {
              this.logs.set(item.id, item as AnomalyEvent);
            }
          }
        }
      }
      if (fs.existsSync(CHECKLIST_FILE)) {
        const rawChecklist = fs.readFileSync(CHECKLIST_FILE, "utf-8");
        const parsedChecklist = JSON.parse(rawChecklist);
        if (parsedChecklist && typeof parsedChecklist === "object" && !Array.isArray(parsedChecklist)) {
          for (const [key, val] of Object.entries(parsedChecklist as Record<string, any>)) {
            if (!val || typeof val !== "object") continue;
            const normId = String(val.pmId || key).trim().toUpperCase();
            if (!normId) continue;
            this.checklist.set(normId, {
              pmId: normId,
              ewonChecked: Boolean(val.ewonChecked),
              endpointChecked: Boolean(val.endpointChecked),
              panelLcdChecked: Boolean(val.panelLcdChecked),
              ewonCheckedAt: typeof val.ewonCheckedAt === "string" ? val.ewonCheckedAt : null,
              endpointCheckedAt: typeof val.endpointCheckedAt === "string" ? val.endpointCheckedAt : null,
              panelLcdCheckedAt: typeof val.panelLcdCheckedAt === "string" ? val.panelLcdCheckedAt : null,
              notes: typeof val.notes === "string" ? val.notes : "",
              updatedAt: typeof val.updatedAt === "string" ? val.updatedAt : null,
              updatedBy: typeof val.updatedBy === "string" ? val.updatedBy : null
            });
          }
        }
      }
    } catch {
      // Ignore corrupt local file and start clean without affecting SCADA
    }
  }

  private persistLogs() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const sorted = this.getAllSorted().slice(0, MAX_LOGS);
      if (sorted.length < this.logs.size) {
        this.logs = new Map(sorted.map((item) => [item.id, item]));
      }
      const tmpPath = `${LOG_FILE}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(sorted, null, 2), "utf-8");
      fs.renameSync(tmpPath, LOG_FILE);
    } catch {
      // Non-fatal local persistence error
    }
  }

  private persistState() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = `${STATE_FILE}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), "utf-8");
      fs.renameSync(tmpPath, STATE_FILE);
    } catch {
      // Non-fatal local persistence error
    }
  }

  private getAllSorted(): AnomalyEvent[] {
    return Array.from(this.logs.values()).sort((a, b) => {
      if (a.timestamp !== b.timestamp) return b.timestamp.localeCompare(a.timestamp);
      return b.detectedAt.localeCompare(a.detectedAt);
    });
  }

  public getResetAt(): string | null {
    this.ensureLoaded();
    return this.state.resetAt;
  }

  public resetBaseline(resetAtWib: string): { clearedCount: number; resetAt: string } {
    this.ensureLoaded();
    const clearedCount = this.logs.size;
    this.logs.clear();
    this.state = { resetAt: resetAtWib };
    this.persistLogs();
    this.persistState();
    return { clearedCount, resetAt: resetAtWib };
  }

  public clearResetBaseline(): void {
    this.ensureLoaded();
    this.state = { resetAt: null };
    this.persistState();
  }

  public upsertAnomalies(
    events: AnomalyEvent[],
    options?: { respectResetAt?: boolean }
  ): AnomalyEvent[] {
    this.ensureLoaded();
    const respectResetAt = options?.respectResetAt !== false;
    const cutoff = respectResetAt ? this.state.resetAt : null;

    const newlyAdded: AnomalyEvent[] = [];
    for (const ev of events) {
      if (cutoff && ev.timestamp <= cutoff) continue;
      if (!this.logs.has(ev.id)) {
        this.logs.set(ev.id, ev);
        newlyAdded.push(ev);
      }
    }
    if (newlyAdded.length > 0) {
      this.persistLogs();
    }
    return newlyAdded.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  public queryLogs(filter?: {
    pmId?: string;
    type?: AnomalyType | "all";
    source?: SourceTable | "both";
    startDate?: string;
    endDate?: string;
    ack?: "all" | "open" | "acked";
    search?: string;
    limit?: number;
  }) {
    this.ensureLoaded();
    const all = this.getAllSorted();
    const unreadCount = all.filter((l) => !l.read).length;
    const unacknowledgedCount = all.filter((l) => !l.acknowledged).length;

    let filtered = all;
    if (filter?.pmId && filter.pmId !== "all") {
      const target = filter.pmId.trim().toUpperCase();
      filtered = filtered.filter((l) => l.pmId.toUpperCase() === target);
    }
    if (filter?.type && filter.type !== "all") {
      filtered = filtered.filter((l) => l.type === filter.type);
    }
    if (filter?.source && filter.source !== "both") {
      filtered = filtered.filter((l) => l.sourceTable === filter.source);
    }
    if (filter?.startDate) {
      filtered = filtered.filter((l) => l.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      filtered = filtered.filter((l) => l.date <= filter.endDate!);
    }
    if (filter?.ack === "open") {
      filtered = filtered.filter((l) => !l.acknowledged);
    } else if (filter?.ack === "acked") {
      filtered = filtered.filter((l) => l.acknowledged);
    }
    if (filter?.search && filter.search.trim()) {
      const tokens = filter.search.trim().toLowerCase().replace(/[-_/]+/g, " ").split(/\s+/);
      filtered = filtered.filter((l) => {
        const hay = `${l.pmId} ${l.pmName} ${l.factory} ${l.area} ${l.type} ${l.message} ${l.timestamp}`.toLowerCase();
        const clean = hay.replace(/[-_/]+/g, " ");
        return tokens.every((tok) => hay.includes(tok) || clean.includes(tok));
      });
    }

    const total = filtered.length;
    const limit = filter?.limit && filter.limit > 0 ? Math.min(filter.limit, 5000) : 500;
    return {
      logs: filtered.slice(0, limit),
      total,
      unreadCount,
      unacknowledgedCount,
      resetAt: this.state.resetAt
    };
  }

  public acknowledge(id: string): AnomalyEvent | null {
    this.ensureLoaded();
    const existing = this.logs.get(id);
    if (!existing) return null;
    existing.acknowledged = true;
    existing.read = true;
    existing.acknowledgedAt = new Date().toISOString();
    this.persistLogs();
    return existing;
  }

  public acknowledgeAll(): number {
    this.ensureLoaded();
    const now = new Date().toISOString();
    let count = 0;
    for (const item of this.logs.values()) {
      if (!item.acknowledged || !item.read) {
        item.acknowledged = true;
        item.read = true;
        item.acknowledgedAt = item.acknowledgedAt || now;
        count++;
      }
    }
    if (count > 0) this.persistLogs();
    return count;
  }

  public markAllRead(): number {
    this.ensureLoaded();
    let count = 0;
    for (const item of this.logs.values()) {
      if (!item.read) {
        item.read = true;
        count++;
      }
    }
    if (count > 0) this.persistLogs();
    return count;
  }

  private persistChecklist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const obj: Record<string, PmChecklistItem> = {};
      for (const [key, item] of this.checklist.entries()) {
        obj[key] = item;
      }
      const tmpPath = `${CHECKLIST_FILE}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), "utf-8");
      fs.renameSync(tmpPath, CHECKLIST_FILE);
    } catch {
      // Non-fatal local persistence error
    }
  }

  public getAllChecklist(): Record<string, PmChecklistItem> {
    this.ensureLoaded();
    const out: Record<string, PmChecklistItem> = {};
    for (const [key, item] of this.checklist.entries()) {
      out[key] = { ...item };
    }
    return out;
  }

  public getChecklistItem(pmId: string): PmChecklistItem {
    this.ensureLoaded();
    const key = String(pmId || "").trim().toUpperCase();
    const existing = this.checklist.get(key);
    return existing ? { ...existing } : createEmptyChecklistItem(key);
  }

  public upsertChecklistItem(
    pmId: string,
    patch: PmChecklistPatch,
    actor: string,
    nowWib: string
  ): PmChecklistItem {
    this.ensureLoaded();
    const key = String(pmId || "").trim().toUpperCase();
    const current = this.checklist.get(key) ?? createEmptyChecklistItem(key);

    const nextEwon = typeof patch.ewonChecked === "boolean" ? patch.ewonChecked : current.ewonChecked;
    const nextEndpoint = typeof patch.endpointChecked === "boolean" ? patch.endpointChecked : current.endpointChecked;
    const nextPanelLcd = typeof patch.panelLcdChecked === "boolean" ? patch.panelLcdChecked : current.panelLcdChecked;
    const nextNotes = typeof patch.notes === "string" ? patch.notes.slice(0, 500) : current.notes;

    const updated: PmChecklistItem = {
      pmId: key,
      ewonChecked: nextEwon,
      endpointChecked: nextEndpoint,
      panelLcdChecked: nextPanelLcd,
      ewonCheckedAt: nextEwon
        ? current.ewonChecked
          ? current.ewonCheckedAt ?? nowWib
          : nowWib
        : null,
      endpointCheckedAt: nextEndpoint
        ? current.endpointChecked
          ? current.endpointCheckedAt ?? nowWib
          : nowWib
        : null,
      panelLcdCheckedAt: nextPanelLcd
        ? current.panelLcdChecked
          ? current.panelLcdCheckedAt ?? nowWib
          : nowWib
        : null,
      notes: nextNotes,
      updatedAt: nowWib,
      updatedBy: actor || "Admin"
    };

    const isEmpty =
      !updated.ewonChecked &&
      !updated.endpointChecked &&
      !updated.panelLcdChecked &&
      !updated.notes.trim();

    if (isEmpty) {
      this.checklist.delete(key);
      this.persistChecklist();
      return createEmptyChecklistItem(key);
    }

    this.checklist.set(key, updated);
    this.persistChecklist();
    return { ...updated };
  }

  public resetChecklist(pmId?: string): { clearedCount: number; item?: PmChecklistItem } {
    this.ensureLoaded();
    if (pmId) {
      const key = String(pmId).trim().toUpperCase();
      const existed = this.checklist.delete(key);
      if (existed) this.persistChecklist();
      return { clearedCount: existed ? 1 : 0, item: createEmptyChecklistItem(key) };
    }
    const clearedCount = this.checklist.size;
    this.checklist.clear();
    this.persistChecklist();
    return { clearedCount };
  }

  public getStats() {
    this.ensureLoaded();
    let unread = 0;
    let unacked = 0;
    for (const item of this.logs.values()) {
      if (!item.read) unread++;
      if (!item.acknowledged) unacked++;
    }
    return {
      totalLogs: this.logs.size,
      unreadCount: unread,
      unacknowledgedCount: unacked,
      resetAt: this.state.resetAt,
      storagePath: LOG_FILE
    };
  }
}

export const pmHealthStore = new PmHealthLocalStore();
