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

/* ═══════════ MULTI-IMAGE PM CROSSCHECK (eWON / ENDPOINT / PANEL LCD) ═══════════ */
export type CrosscheckSource = "ewon" | "endpoint" | "panel_lcd";
export type CrosscheckSourceTag = CrosscheckSource | "auto";
export type CrosscheckConfidence = "high" | "medium" | "low";

export type CrosscheckParamKey =
  | "active_energy"
  | "active_power_total"
  | "reactive_power_total"
  | "apparent_power_total"
  | "power_factor"
  | "volt_ab"
  | "volt_bc"
  | "volt_ca"
  | "volt_ll"
  | "volt_an"
  | "volt_bn"
  | "volt_cn"
  | "volt_ln"
  | "current_a"
  | "current_b"
  | "current_c"
  | "frequency"
  | "voltage_unbalance"
  | "current_unbalance"
  | "thd_volt_a"
  | "thd_volt_b"
  | "thd_volt_c"
  | "thd_current_a"
  | "thd_current_b"
  | "thd_current_c";

export interface CrosscheckParamSpec {
  key: CrosscheckParamKey;
  label: string;
  group: string;
  unit: string;
  tightPct: number;
  tightAbs: number;
  driftPct: number;
  driftAbs: number;
}

export interface CrosscheckExtractedValue {
  key: CrosscheckParamKey;
  value: number;
  unit: string;
  rawText: string;
  confidence: CrosscheckConfidence;
  imageId: string;
  imageName: string;
  manualOverride?: boolean;
  isLiveEndpoint?: boolean;
}

export interface CrosscheckImageItem {
  id: string;
  pmId: string;
  source: CrosscheckSourceTag;
  detectedSource: CrosscheckSource | null;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  uploadedAt: string;
  uploadedBy: string;
  extractedCount: number;
  extractedParams: Record<string, CrosscheckExtractedValue>;
  aiNotes?: string | null;
  analyzedAt?: string | null;
}

export type CrosscheckRowStatus =
  | "match"
  | "slight_diff"
  | "scale_mismatch"
  | "mismatch"
  | "single_source"
  | "missing";

export interface CrosscheckComparisonRow {
  key: CrosscheckParamKey;
  label: string;
  group: string;
  unit: string;
  ewon: CrosscheckExtractedValue | null;
  endpoint: CrosscheckExtractedValue | null;
  panel_lcd: CrosscheckExtractedValue | null;
  status: CrosscheckRowStatus;
  maxAbsDiff: number | null;
  maxPctDiff: number | null;
  note: string;
  scaleFactorDetected?: string | null;
}

export interface CrosscheckPairSummary {
  comparedCount: number;
  matchCount: number;
  slightDiffCount: number;
  mismatchCount: number;
  status: "match" | "warning" | "mismatch" | "insufficient";
}

export type CrosscheckOverallStatus = "all_match" | "warning" | "mismatch" | "incomplete";
export type CrosscheckToleranceMode = "strict" | "normal" | "relaxed";
export type CrosscheckLiveEndpointOrigin =
  | "live_endpoint_http"
  | "live_endpoint_cache"
  | "db_minute_latest"
  | "db_minute_at_time";

export interface PmCrosscheckRecord {
  pmId: string;
  toleranceMode?: CrosscheckToleranceMode;
  images: CrosscheckImageItem[];
  liveEndpointSnapshot: {
    capturedAt: string;
    tStamp: string | null;
    sourceOrigin?: CrosscheckLiveEndpointOrigin;
    sourceLabel?: string;
    values: Record<string, CrosscheckExtractedValue>;
  } | null;
  manualOverrides: Partial<Record<CrosscheckSource, Record<string, CrosscheckExtractedValue>>>;
  lastAnalyzedAt: string | null;
  lastAnalyzedBy: string | null;
  aiModel: string | null;
  aiSummary: string | null;
  updatedAt: string | null;
}

export interface PmCrosscheckReport {
  pmId: string;
  toleranceMode: CrosscheckToleranceMode;
  overallStatus: CrosscheckOverallStatus;
  verdictTitle: string;
  verdictDetail: string;
  sourceCoverage: {
    ewonParams: number;
    endpointParams: number;
    panelLcdParams: number;
    ewonImages: number;
    endpointImages: number;
    panelLcdImages: number;
    autoImages: number;
    hasLiveEndpoint: boolean;
  };
  stats: {
    totalDetectedParams: number;
    comparedParams: number;
    matchCount: number;
    slightDiffCount: number;
    scaleMismatchCount: number;
    mismatchCount: number;
    singleSourceCount: number;
  };
  pairs: {
    ewonVsEndpoint: CrosscheckPairSummary;
    ewonVsLcd: CrosscheckPairSummary;
    endpointVsLcd: CrosscheckPairSummary;
  };
  rows: CrosscheckComparisonRow[];
}

export interface PmCrosscheckSummaryItem {
  pmId: string;
  imageCount: number;
  ewonImages: number;
  endpointImages: number;
  panelLcdImages: number;
  hasLiveEndpoint: boolean;
  comparedParams: number;
  matchCount: number;
  slightDiffCount: number;
  mismatchCount: number;
  overallStatus: CrosscheckOverallStatus;
  lastAnalyzedAt: string | null;
}

export interface CrosscheckSummariesResponse {
  ok: boolean;
  summaries: Record<string, PmCrosscheckSummaryItem>;
  paramSpecs: CrosscheckParamSpec[];
}

export interface CrosscheckDetailResponse {
  ok: boolean;
  pm: PmCatalogMeta;
  record: PmCrosscheckRecord;
  report: PmCrosscheckReport;
  paramSpecs: CrosscheckParamSpec[];
}
