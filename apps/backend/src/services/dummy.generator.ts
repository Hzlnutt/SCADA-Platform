import { env } from "../config/env.config";
import { logger } from "../config/logger.config";
import type { TelemetryPointInput } from "../modules/telemetry/telemetry.validation";
import { ingestTelemetry } from "../modules/telemetry/telemetry.service";
import { publishTelemetry } from "./telemetry.publisher";
import { processThresholdAlerts } from "./thresholds.monitor";
import type { AlarmEventInput } from "../modules/alarms/alarms.validation";
import { ingestAlarmEvents } from "../modules/alarms/alarms.service";
import { publishAlarmEvents } from "./alarms.publisher";

const baseTags = [
  { tagId: "cooling-water/flow_1", unit: "m3/h", base: 42, variance: 7 },
  { tagId: "cooling-water/flow_2", unit: "m3/h", base: 38, variance: 6 },
  { tagId: "cooling-water/flow_3", unit: "m3/h", base: 41, variance: 6.5 },
  { tagId: "boiler/steam_pressure_a", unit: "bar", base: 18.2, variance: 0.6 },
  { tagId: "boiler/steam_pressure_b", unit: "bar", base: 17.4, variance: 0.7 },
  { tagId: "boiler/boiler_3_pressure", unit: "bar", base: 18.0, variance: 0.5 },
  { tagId: "boiler/boiler_4_pressure", unit: "bar", base: 17.5, variance: 0.4 },
  { tagId: "boiler/boiler_5_pressure", unit: "bar", base: 17.8, variance: 0.4 },
  { tagId: "ro/output_flow_1", unit: "m3/h", base: 11.8, variance: 1.6 },
  { tagId: "ro/output_flow_2", unit: "m3/h", base: 12.2, variance: 1.4 },
  { tagId: "distillate/output_flow_1", unit: "m3/h", base: 12.4, variance: 1.8 },
  { tagId: "pw/flow_rate_1", unit: "m3/h", base: 18.3, variance: 2.2 },
  { tagId: "psg/pressure_1", unit: "bar", base: 3.4, variance: 0.6 },
  { tagId: "wfi/conductivity_1", unit: "uS", base: 0.78, variance: 0.18 },
  { tagId: "compressor/temp_a", unit: "C", base: 82, variance: 6 },
  { tagId: "compressor/temp_b", unit: "C", base: 80, variance: 5.5 },
  { tagId: "chiller/trane_cgam_40_temp", unit: "C", base: 6.8, variance: 1.1 },
  { tagId: "chiller/daikin_wf1u3_temp", unit: "C", base: 7.2, variance: 1.2 },
  { tagId: "chiller/rtac_100_temp", unit: "C", base: 6.9, variance: 1.0 },
  { tagId: "chiller/rtac_275_temp", unit: "C", base: 6.5, variance: 0.9 },
  { tagId: "compressed-air/ale_30_pressure", unit: "bar", base: 7.2, variance: 0.5 },
  { tagId: "compressed-air/zt_30_1_pressure", unit: "bar", base: 7.0, variance: 0.4 },
  { tagId: "compressed-air/zt_30_2_pressure", unit: "bar", base: 7.1, variance: 0.45 },
  { tagId: "compressed-air/zt_55_pressure", unit: "bar", base: 7.4, variance: 0.6 },
  { tagId: "compressed-air/ingersoll_55_pressure", unit: "bar", base: 7.3, variance: 0.55 },
  { tagId: "compressed-air/ale_250_pressure", unit: "bar", base: 7.5, variance: 0.7 },
  { tagId: "compressed-air/zt_110_pressure", unit: "bar", base: 7.2, variance: 0.5 }
];

const hvacUnitSubIds = [
  "qc-lab", "qc-retained-sample", "wh-3", "wh-4", "wh-5", "wh-6", "wh-7",
  "preparation-wf1u3", "bottlepack-wf1u3", "qc-sampling-wf1u3", "corridor-wf1u3", "steril-ip-wf1u3",
  "preparation-wf2u1", "bottlepack-wf2u1", "weighing-wf2u1", "laundry-wf2u1", "steril-wf2u1", "ip-wf2u1", "corridor-wf2u1", "material-wf2u1", "wt-wf2u1", "qc-wf2u1", "oac-1-wf2u1", "oac-2-wf2u1",
  "preparation-wf2u2", "bottlepack-wf2u2", "steril-wf2u2", "ip-wf2u2", "corridor-bp-wf2u2", "oac-wf2u2"
];

const telemetryTags = [
  ...baseTags,
  ...hvacUnitSubIds.map((subId) => ({
    tagId: `hvac/${subId}_temp`,
    unit: "C",
    base: 22.0,
    variance: 2.0
  }))
];

const alarmDefs = [
  {
    alarmKey: "boiler/high_pressure",
    tagId: "boiler/steam_pressure_a",
    message: "Tekanan boiler tinggi",
    severity: "high"
  },
  {
    alarmKey: "compressor/high_temp",
    tagId: "compressor/temp_a",
    message: "Suhu kompresor tinggi",
    severity: "medium"
  }
] as const;

const activeAlarms = new Set<string>();

const jitter = (base: number, variance: number) => {
  return base + (Math.random() * 2 - 1) * variance;
};

const buildTelemetryPoints = () => {
  const ts = new Date();
  return telemetryTags.map<TelemetryPointInput>((tag) => ({
    tagId: tag.tagId,
    deviceId: "plc-sim",
    unit: tag.unit,
    area: "Utilities",
    value: Number(jitter(tag.base, tag.variance).toFixed(2)),
    quality: "good",
    ts
  }));
};

const buildAlarmEvents = () => {
  const events: AlarmEventInput[] = [];
  const ts = new Date();

  alarmDefs.forEach((alarm) => {
    if (!activeAlarms.has(alarm.alarmKey) && Math.random() < 0.08) {
      activeAlarms.add(alarm.alarmKey);
      events.push({
        alarmKey: alarm.alarmKey,
        tagId: alarm.tagId,
        message: alarm.message,
        severity: alarm.severity,
        status: "active",
        ts
      });
    } else if (activeAlarms.has(alarm.alarmKey) && Math.random() < 0.15) {
      activeAlarms.delete(alarm.alarmKey);
      events.push({
        alarmKey: alarm.alarmKey,
        tagId: alarm.tagId,
        message: alarm.message,
        severity: alarm.severity,
        status: "cleared",
        ts
      });
    }
  });

  return events;
};

export const startDummyGenerator = () => {
  logger.info({ intervalMs: env.dummyIntervalMs }, "dummy generator enabled");

  const runCycle = async () => {
    const telemetryPoints = buildTelemetryPoints();
    const telemetryResult = await ingestTelemetry(telemetryPoints);
    publishTelemetry(telemetryResult.docs);
    await processThresholdAlerts(telemetryResult.docs);

    const alarmEvents = buildAlarmEvents();
    if (alarmEvents.length > 0) {
      const alarmResult = await ingestAlarmEvents(alarmEvents);
      publishAlarmEvents(alarmResult.events);
    }
  };

  setInterval(() => {
    runCycle().catch((err) => {
      logger.error({ err }, "dummy generator cycle failed");
    });
  }, env.dummyIntervalMs);
};
