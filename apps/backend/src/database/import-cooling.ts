import fs from "fs";
import readline from "readline";
import path from "path";
import { connectMongo, closeMongo } from "./mongo";
import { TELEMETRY_COLLECTION, HISTORIAN_COLLECTION, HISTORIAN_HOURLY_COLLECTION } from "./collections";
import { ensureMongoCollections } from "./setup";

const importDataDir = path.join(
  "C:",
  "Users",
  "Acer Nitro 5",
  "Documents",
  "PKL PT Widatra Bhakti",
  "company-scada-platform",
  "import-data",
  "Cooling"
);

function cleanVal(val: string): number | null {
  if (!val) return null;
  const clean = val.replace(/'/g, "").trim();
  if (clean === "NULL" || clean === "null" || clean === "") return null;
  const num = Number(clean);
  if (isNaN(num)) return null;
  // Scaling logic: values >= 1000 represent raw scale multiplied by 1000
  return num >= 1000 ? num / 1000.0 : num;
}

function cleanStr(val: string): string {
  return val.replace(/'/g, "").trim();
}

async function importCoolingCsv() {
  console.log("Connecting to MongoDB...");
  await ensureMongoCollections();
  const db = await connectMongo();
  const telemetryCollection = db.collection(TELEMETRY_COLLECTION);
  const historianCollection = db.collection(HISTORIAN_COLLECTION);
  const hourlyCollection = db.collection(HISTORIAN_HOURLY_COLLECTION);

  console.log(`Checking CSV files in import data folder: ${importDataDir}...`);
  if (!fs.existsSync(importDataDir)) {
    throw new Error(`Import directory not found at ${importDataDir}`);
  }

  const csvFiles = fs.readdirSync(importDataDir)
    .filter((f) => f.endsWith(".csv"))
    .sort();

  console.log(`Found ${csvFiles.length} CSV files to import: ${csvFiles.join(", ")}`);

  let totalRowsFound = 0;
  let telemetryBatch: any[] = [];
  let historianBatch: any[] = [];
  const BATCH_SIZE = 5000;

  // Let's drop existing documents for these specific tags to avoid duplicates if re-run
  console.log("Clearing existing cooling telemetry/historian data for return_temp and supply_temp...");
  await telemetryCollection.deleteMany({
    "meta.tagId": { $in: ["cooling/return_temp", "chiller/daikin_wf1u3_temp"] }
  });
  await historianCollection.deleteMany({
    "meta.tagId": { $in: ["cooling/return_temp", "chiller/daikin_wf1u3_temp"] }
  });
  await hourlyCollection.deleteMany({
    "meta.tagId": { $in: ["cooling/return_temp", "chiller/daikin_wf1u3_temp"] }
  });

  for (const csvFile of csvFiles) {
    const csvFilePath = path.join(importDataDir, csvFile);
    console.log(`\nProcessing CSV File: ${csvFile}`);

    const fileStream = fs.createReadStream(csvFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let isHeader = true;
    let headers: string[] = [];
    let returnTempIdx = -1;
    let supplyTempIdx = -1;
    let tStampIdx = -1;

    for await (const line of rl) {
      if (!line.trim()) continue;

      const row = line.split(",");
      if (isHeader) {
        headers = row.map(h => h.trim());
        returnTempIdx = headers.indexOf("Temp_ST3_Return");
        supplyTempIdx = headers.indexOf("Temp_ST3_Supply");
        tStampIdx = headers.indexOf("t_stamp");
        isHeader = false;
        console.log(`Headers found. ReturnTemp Index: ${returnTempIdx}, SupplyTemp Index: ${supplyTempIdx}, Timestamp Index: ${tStampIdx}`);
        if (returnTempIdx === -1 || tStampIdx === -1) {
          throw new Error("Required columns not found in CSV!");
        }
        continue;
      }

      totalRowsFound++;
      if (totalRowsFound % 10000 === 0) {
        process.stdout.write(`Processed ${totalRowsFound} rows...\r`);
      }

      const t_stamp = cleanStr(row[tStampIdx]);
      const return_val = cleanVal(row[returnTempIdx]);
      const supply_val = supplyTempIdx !== -1 ? cleanVal(row[supplyTempIdx]) : null;

      if (!t_stamp) continue;
      const ts = new Date(t_stamp);
      if (isNaN(ts.getTime())) continue;

      // Add Return Temp
      if (return_val !== null) {
        const tagId = "cooling/return_temp";
        const meta = {
          tagId,
          deviceId: "cooling",
          unit: "C",
          area: "Utilities",
          source: "ignition"
        };

        telemetryBatch.push({
          ts,
          value: return_val,
          quality: "good",
          meta
        });

        historianBatch.push({
          ts,
          value: return_val,
          quality: "good",
          meta: {
            ...meta,
            source: "rollup",
            resolution: "1m",
            aggregate: "avg",
            count: 1,
            min: return_val,
            max: return_val,
            last: return_val
          }
        });
      }

      // Add Supply Temp
      if (supply_val !== null) {
        const tagId = "chiller/daikin_wf1u3_temp";
        const meta = {
          tagId,
          deviceId: "chiller",
          unit: "C",
          area: "Utilities",
          source: "ignition"
        };

        telemetryBatch.push({
          ts,
          value: supply_val,
          quality: "good",
          meta
        });

        historianBatch.push({
          ts,
          value: supply_val,
          quality: "good",
          meta: {
            ...meta,
            source: "rollup",
            resolution: "1m",
            aggregate: "avg",
            count: 1,
            min: supply_val,
            max: supply_val,
            last: supply_val
          }
        });
      }

      if (telemetryBatch.length >= BATCH_SIZE) {
        await telemetryCollection.insertMany(telemetryBatch, { ordered: false });
        telemetryBatch = [];
      }
      if (historianBatch.length >= BATCH_SIZE) {
        await historianCollection.insertMany(historianBatch, { ordered: false });
        historianBatch = [];
      }
    }
    rl.close();
  }

  if (telemetryBatch.length > 0) {
    await telemetryCollection.insertMany(telemetryBatch, { ordered: false });
  }
  if (historianBatch.length > 0) {
    await historianCollection.insertMany(historianBatch, { ordered: false });
  }

  console.log(`\nCSV parsing and raw import complete! Total rows scanned: ${totalRowsFound}`);

  // Populate historian_1h collection by aggregating 1m historian records
  console.log("Populating historian_1h database collection for cooling return and supply temps...");

  const hourlyRollupPipeline = [
    {
      $match: {
        "meta.tagId": { $in: ["cooling/return_temp", "chiller/daikin_wf1u3_temp"] }
      }
    },
    { $sort: { ts: 1 } },
    {
      $group: {
        _id: {
          tagId: "$meta.tagId",
          deviceId: "$meta.deviceId",
          unit: "$meta.unit",
          area: "$meta.area",
          bucket: {
            $dateTrunc: {
              date: "$ts",
              unit: "hour",
              timezone: "UTC"
            }
          }
        },
        avgValue: { $avg: "$value" },
        minValue: { $min: "$meta.min" },
        maxValue: { $max: "$meta.max" },
        lastValue: { $last: "$meta.last" },
        count: { $sum: "$meta.count" }
      }
    },
    {
      $project: {
        _id: 0,
        ts: "$_id.bucket",
        value: "$avgValue",
        meta: {
          tagId: "$_id.tagId",
          deviceId: "$_id.deviceId",
          unit: "$_id.unit",
          area: "$_id.area",
          source: { $literal: "rollup" },
          resolution: { $literal: "1h" },
          aggregate: { $literal: "avg" },
          count: "$count",
          min: "$minValue",
          max: "$maxValue",
          last: "$lastValue"
        }
      }
    }
  ];

  const h1Docs = await historianCollection.aggregate(hourlyRollupPipeline, { allowDiskUse: true }).toArray();
  console.log(`Found ${h1Docs.length} documents for historian_1h. Inserting...`);

  let writeBatch: any[] = [];
  let h1Inserted = 0;
  for (const doc of h1Docs) {
    writeBatch.push(doc);
    if (writeBatch.length >= BATCH_SIZE) {
      await hourlyCollection.insertMany(writeBatch, { ordered: false });
      h1Inserted += writeBatch.length;
      writeBatch = [];
    }
  }
  if (writeBatch.length > 0) {
    await hourlyCollection.insertMany(writeBatch, { ordered: false });
    h1Inserted += writeBatch.length;
  }

  console.log(`historian_1h populated successfully! Imported: ${h1Inserted} records.`);
  console.log("All imports and rollups completed!");
}

importCoolingCsv()
  .then(async () => {
    console.log("SUCCESS!");
    await closeMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("FATAL ERROR DURING IMPORT:", err);
    await closeMongo();
    process.exit(1);
  });
