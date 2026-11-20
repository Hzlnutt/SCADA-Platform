export type SourceTable = "electric_pm_telemetry" | "electric_pm_telemetry_minute";

export type AnomalyType =
  | "ENERGY_DECREASE"
  | "ROLLOVER_16BIT"
  | "DROP_TO_ZERO"
  | "REBOUND_AFTER_DROP"
  | "NEGATIVE_ENERGY"
  | "ENERGY_SPIKE"
  | "ENERGY_STUCK";

export type AnomalySeverity = "critical" | "warning";
export type HealthStatus = "healthy" | "warning" | "critical" | "offline";

export interface AnomalyEvent {
  id: string;
  detectedAt: string;
  sourceTable: SourceTable;
  pmId: string;
  pmName: string;
  factory: string;
  area: string;
  groupId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  date: string;
  time: string;
  timestamp: string;
  prevTimestamp: string;
  prevEnergy: number;
  currEnergy: number;
  deltaEnergy: number;
  activePower: number | null;
  message: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  read: boolean;
}

export interface SparklinePoint {
  t: string;
  v: number;
  anomaly?: boolean;
}

export interface PmHealthSummary {
  pmId: string;
  pmName: string;
  factory: string;
  area: string;
  groupId: string;
  healthStatus: HealthStatus;
  statusReason: string;
  latestSource: SourceTable | null;
  lastTimestamp: string | null;
  staleMinutes: number | null;
  isOnline: boolean;
  latestEnergy: number | null;
  latestPowerKw: number | null;
  latestVoltLl: number | null;
  latestPowerFactor: number | null;
  minEnergy: number | null;
  maxEnergy: number | null;
  netDeltaEnergy: number | null;
  sampleCountMinute: number;
  sampleCountHourly: number;
  dropCount: number;
  reboundCount: number;
  fluctuationCount: number;
  spikeCount: number;
  stuckCount: number;
  totalAnomalies: number;
  lastAnomalyAt: string | null;
  lastAnomalyType: AnomalyType | null;
  lastAnomalyDelta: number | null;
  sparkline: SparklinePoint[];
}

export interface OverviewResponse {
  range: {
    startTimestamp: string;
    endTimestamp: string;
    hours: number;
    source: string;
    sinceReset?: boolean;
    resetAt?: string | null;
  };
  scannedAt: string;
  summary: {
    totalPms: number;
    healthyCount: number;
    criticalCount: number;
    warningCount: number;
    offlineCount: number;
    totalDropsInWindow: number;
    totalAnomaliesInWindow: number;
    newlyLoggedCount: number;
    minuteRowsScanned: number;
    hourlyRowsScanned: number;
  };
  pms: PmHealthSummary[];
  newlyLogged?: AnomalyEvent[];
  logStats: {
    totalLogs: number;
    unreadCount: number;
    unacknowledgedCount: number;
    resetAt: string | null;
  };
}

export interface AnnotatedReading {
  id: number;
  t_stamp: string;
  group_id: string;
  pm_id: string;
  status: boolean | null;
  volt_ll: number | null;
  current_a: number | null;
  current_b: number | null;
  current_c: number | null;
  active_power_total: number | null;
  power_factor: number | null;
  frequency: number | null;
  active_energy: number | null;
  source_table: SourceTable;
  delta_energy: number | null;
  anomaly_type: AnomalyType | null;
  anomaly_severity: AnomalySeverity | null;
  anomaly_message: string | null;
}

export interface PmSeriesResponse {
  pm: {
    pmId: string;
    name: string;
    factory: string;
    groupId: string;
    area: string;
  };
  range: {
    startTimestamp: string;
    endTimestamp: string;
    hours: number;
    source: string;
    sinceReset?: boolean;
    resetAt?: string | null;
  };
  minuteSeries: AnnotatedReading[];
  hourlySeries: AnnotatedReading[];
  anomalies: AnomalyEvent[];
}

export interface HealthResponse {
  ok: boolean;
  mode: string;
  db: {
    connected: boolean;
    readOnlyEnforced: boolean;
    host: string;
    database: string;
    hourlyLatest: string | null;
    minuteLatest: string | null;
    distinctPmCount: number;
    error?: string;
  };
  monitor: {
    pollIntervalMs: number;
    defaultLookbackHours: number;
    lastPollAt: string | null;
    lastPollError: string | null;
    isPolling: boolean;
    resetAt?: string | null;
  };
  logs: {
    totalLogs: number;
    unreadCount: number;
    unacknowledgedCount: number;
    resetAt?: string | null;
    storagePath: string;
  };
}

export interface PmChecklistItem {
  pmId: string;
  ewonChecked: boolean;
  endpointChecked: boolean;
  panelLcdChecked: boolean;
  ewonCheckedAt: string | null;
  endpointCheckedAt: string | null;
  panelLcdCheckedAt: string | null;
  notes: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PmChecklistPatch {
  ewonChecked?: boolean;
  endpointChecked?: boolean;
  panelLcdChecked?: boolean;
  notes?: string;
}

export interface PmCatalogMeta {
  pmId: string;
  name: string;
  factory: string;
  groupId: string;
  area: string;
}

export interface ChecklistResponse {
  ok: boolean;
  items: Record<string, PmChecklistItem>;
  catalog: PmCatalogMeta[];
}
