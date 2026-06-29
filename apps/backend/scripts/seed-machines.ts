import { connectMongo, closeMongo } from "../src/database/mongo";
import {
  MACHINE_CATEGORIES_COLLECTION,
  MACHINE_CONFIGS_COLLECTION,
  MACHINE_THRESHOLDS_COLLECTION
} from "../src/database/collections";
import { logger } from "../src/config/logger.config";

const seed = async () => {
  try {
    const db = await connectMongo();
    logger.info("Starting machine configuration seed...");

    // 1. Clear existing collections
    await db.collection(MACHINE_CATEGORIES_COLLECTION).deleteMany({});
    await db.collection(MACHINE_CONFIGS_COLLECTION).deleteMany({});
    await db.collection(MACHINE_THRESHOLDS_COLLECTION).deleteMany({});

    logger.info("Existing config collections cleared.");

    // 2. Comprehensive Categories List
    const categories = [
      {
        id: "cooling-water",
        name: "Cooling Water System (Cooling Tower)",
        parameters: [
          { key: "temp", label: "Supply Water Temp", unit: "°C", type: "realtime" },
          { key: "return_temp", label: "Return Water Temp", unit: "°C", type: "realtime" },
          { key: "flow", label: "Supply Water Flow", unit: "m³/h", type: "realtime" },
          { key: "tds", label: "Supply Water TDS", unit: "µS/cm", type: "realtime" },
          { key: "ph", label: "Supply Water pH", unit: "pH", type: "realtime" },
          { key: "humidity", label: "Ambient Humidity", unit: "%", type: "realtime" }
        ]
      },
      {
        id: "boiler",
        name: "Boiler Plant System (Steam)",
        parameters: [
          { key: "steam_press", label: "Steam Pressure", unit: "bar", type: "realtime" },
          { key: "temp", label: "Steam Temperature", unit: "°C", type: "realtime" },
          { key: "flow", label: "Feedwater Flow Rate", unit: "m³/h", type: "realtime" },
          { key: "fuel_flow", label: "Fuel Gas Flow Rate", unit: "m³/h", type: "realtime" }
        ]
      },
      {
        id: "chiller",
        name: "Chiller Plant System",
        parameters: [
          { key: "evap_temp", label: "Evaporator Temp", unit: "°C", type: "realtime" },
          { key: "cond_temp", label: "Condenser Temp", unit: "°C", type: "realtime" },
          { key: "power", label: "Compressor Power", unit: "kW", type: "realtime" },
          { key: "flow", label: "Chilled Water Flow", unit: "m³/h", type: "realtime" }
        ]
      },
      {
        id: "purified-water",
        name: "Purified Water System (RO)",
        parameters: [
          { key: "flow", label: "RO Product Flow", unit: "m³/h", type: "realtime" },
          { key: "cond", label: "Water Conductivity", unit: "µS/cm", type: "realtime" },
          { key: "recovery", label: "Recovery Rate", unit: "%", type: "realtime" },
          { key: "ph", label: "Water pH", unit: "pH", type: "realtime" }
        ]
      },
      {
        id: "distillation",
        name: "Distillation Plant System",
        parameters: [
          { key: "feed_flow", label: "Feedwater Flow", unit: "m³/h", type: "realtime" },
          { key: "dist_flow", label: "Distillate Flow", unit: "m³/h", type: "realtime" },
          { key: "cond", label: "Distillate Conductivity", unit: "µS/cm", type: "realtime" },
          { key: "temp", label: "Distillate Temp", unit: "°C", type: "realtime" }
        ]
      },
      {
        id: "compressed-air",
        name: "Compressed Air System",
        parameters: [
          { key: "press", label: "Discharge Pressure", unit: "bar", type: "realtime" },
          { key: "temp", label: "Discharge Temperature", unit: "°C", type: "realtime" },
          { key: "flow", label: "Airflow Rate", unit: "m³/h", type: "realtime" }
        ]
      },
      {
        id: "hvac",
        name: "HVAC Clean Room System",
        parameters: [
          { key: "temp", label: "Room Temperature", unit: "°C", type: "realtime" },
          { key: "humidity", label: "Room Relative Humidity", unit: "%", type: "realtime" },
          { key: "dp", label: "Differential Pressure", unit: "Pa", type: "realtime" },
          { key: "flow", label: "Supply Airflow Rate", unit: "m³/h", type: "realtime" }
        ]
      },
      {
        id: "wwtp",
        name: "WWTP Treatment System",
        parameters: [
          { key: "influent_flow", label: "Influent Flow Rate", unit: "m³/h", type: "realtime" },
          { key: "effluent_flow", label: "Effluent Flow Rate", unit: "m³/h", type: "realtime" },
          { key: "ph", label: "Effluent pH", unit: "pH", type: "realtime" },
          { key: "cod", label: "Effluent COD Level", unit: "mg/L", type: "realtime" },
          { key: "bod", label: "Effluent BOD Level", unit: "mg/L", type: "realtime" }
        ]
      }
    ];

    await db.collection(MACHINE_CATEGORIES_COLLECTION).insertMany(categories);
    logger.info(`Inserted ${categories.length} categories.`);

    // 3. Machines
    const machines = [
      {
        id: "cooling-tower-1",
        name: "Cooling Tower WF1-U3",
        categoryId: "cooling-water",
        area: "Utility",
        status: "active",
        apiBindings: {
          temp: "cooling-water/temp_1",
          return_temp: "cooling-water/return_temp_1",
          flow: "cooling-water/flow_1",
          tds: "cooling-water/tds_1",
          ph: "cooling-water/ph_1",
          humidity: "cooling-water/humidity_1"
        },
        analysisConfig: {
          trendWindow: 24,
          samplingRate: 5,
          enabledAnalytics: ["trend", "histogram"]
        }
      },
      {
        id: "hvac-qc-retained-sample",
        name: "QC Retained Sample AHU",
        categoryId: "hvac",
        area: "HVAC",
        status: "active",
        apiBindings: {
          temp: "hvac/qc-retained-sample_temp",
          humidity: "hvac/qc-retained-sample_humidity",
          dp: "hvac/qc-retained-sample_dp",
          flow: "hvac/qc-retained-sample_flow"
        },
        analysisConfig: {
          trendWindow: 24,
          samplingRate: 5,
          enabledAnalytics: ["trend"]
        }
      }
    ];

    // Find the category DB _ids to link correctly
    const savedCategories = await db.collection(MACHINE_CATEGORIES_COLLECTION).find().toArray();
    const catMap = new Map(savedCategories.map((c) => [c.id, c._id.toString()]));

    const machinesToInsert = machines.map((m) => ({
      ...m,
      categoryId: catMap.get(m.categoryId) || m.categoryId,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await db.collection(MACHINE_CONFIGS_COLLECTION).insertMany(machinesToInsert);
    logger.info(`Inserted ${machinesToInsert.length} machines.`);

    // 4. Default thresholds for pilot project machines
    const thresholds = [
      // Cooling Tower
      { machineId: "cooling-tower-1", parameter: "temp", warningLow: 15.0, warningHigh: 32.0, alarmLow: 10.0, alarmHigh: 35.0 },
      { machineId: "cooling-tower-1", parameter: "return_temp", warningLow: 20.0, warningHigh: 42.0, alarmLow: 15.0, alarmHigh: 45.0 },
      { machineId: "cooling-tower-1", parameter: "flow", warningLow: 250.0, warningHigh: 550.0, alarmLow: 200.0, alarmHigh: 600.0 },
      { machineId: "cooling-tower-1", parameter: "tds", warningLow: 50.0, warningHigh: 450.0, alarmLow: 0.0, alarmHigh: 500.0 },
      { machineId: "cooling-tower-1", parameter: "ph", warningLow: 6.5, warningHigh: 8.5, alarmLow: 6.0, alarmHigh: 9.0 },
      { machineId: "cooling-tower-1", parameter: "humidity", warningLow: 30.0, warningHigh: 85.0, alarmLow: 20.0, alarmHigh: 95.0 },

      // HVAC
      { machineId: "hvac-qc-retained-sample", parameter: "temp", warningLow: 18.0, warningHigh: 24.0, alarmLow: 16.0, alarmHigh: 26.0 },
      { machineId: "hvac-qc-retained-sample", parameter: "humidity", warningLow: 40.0, warningHigh: 60.0, alarmLow: 30.0, alarmHigh: 70.0 },
      { machineId: "hvac-qc-retained-sample", parameter: "dp", warningLow: 5.0, warningHigh: 25.0, alarmLow: 2.0, alarmHigh: 30.0 },
      { machineId: "hvac-qc-retained-sample", parameter: "flow", warningLow: 800.0, warningHigh: 1500.0, alarmLow: 500.0, alarmHigh: 1800.0 }
    ];

    await db.collection(MACHINE_THRESHOLDS_COLLECTION).insertMany(thresholds);
    logger.info(`Inserted ${thresholds.length} thresholds.`);

    logger.info("Seed successful!");
  } catch (error) {
    logger.error({ error }, "Error seeding machines");
  } finally {
    await closeMongo();
  }
};

seed();
