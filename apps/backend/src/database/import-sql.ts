import fs from "fs";
import readline from "readline";
import path from "path";
import { connectMongo } from "./mongo";
import { ELECTRICITY_RAW_COLLECTION, ELECTRICITY_1M_COLLECTION, ELECTRICITY_1H_COLLECTION } from "./collections";
import { ensureMongoCollections } from "./setup";

const importDataDir = path.join(
  "C:",
  "Users",
  "Acer Nitro 5",
  "Documents",
  "PKL PT Widatra Bhakti",
  "company-scada-platform",
  "import-data"
);

interface SqlRow {
  ndx: number;
  current_a: number | null;
  current_b: number | null;
  current_c: number | null;
  frequency: number | null;
  power_factor: number | null;
  voltage_ab: number | null;
  voltage_bc: number | null;
  voltage_ca: number | null;
  t_stamp: string;
  active_energy: number | null;
  apparent_energy: number | null;
  amp_unbalance: number | null;
  reactive_energy: number | null;
  pm_id: string;
  volt_ll_avg: number | null;
  reactive_power: number | null;
  apparent_power: number | null;
  active_power: number | null;
}

function parseSqlInsertValues(line: string): string[][] {
  if (!line.includes("VALUES")) return [];
  const idx = line.indexOf("VALUES");
  const valuesPart = line.substring(idx + 6);
  const rows: string[][] = [];
  
  let inString = false;
  let inRow = false;
  let currentVal = "";
  let currentRow: string[] = [];

  for (let i = 0; i < valuesPart.length; i++) {
    const char = valuesPart[i];
    if (char === "'" && valuesPart[i - 1] !== "\\") {
      inString = !inString;
      currentVal += char;
      continue;
    }
    if (inString) {
      currentVal += char;
      continue;
    }

    if (char === "(") {
      inRow = true;
      currentRow = [];
      currentVal = "";
      continue;
    }
    if (char === ")") {
      inRow = false;
      currentRow.push(currentVal.trim());
      rows.push(currentRow);
      currentVal = "";
      continue;
    }
    if (char === "," && inRow) {
      currentRow.push(currentVal.trim());
      currentVal = "";
      continue;
    }
    if (inRow) {
      currentVal += char;
    }
  }
  return rows;
}

function cleanVal(val: string): number | null {
  const clean = val.replace(/'/g, "").trim();
  if (clean === "NULL" || clean === "null" || clean === "") return null;
  const num = Number(clean);
  return isNaN(num) ? null : num;
}

function cleanStr(val: string): string {
  return val.replace(/'/g, "").trim();
}

async function importSql() {
  console.log("Connecting to MongoDB...");
  await ensureMongoCollections();
  const db = await connectMongo();
  const telemetryCollection = db.collection(ELECTRICITY_RAW_COLLECTION);
  const historianCollection = db.collection(ELECTRICITY_1M_COLLECTION);
  const hourlyCollection = db.collection(ELECTRICITY_1H_COLLECTION);

  // Check if we already have records in the dedicated collection
  const existingCount = await telemetryCollection.countDocuments({});

  console.log(`Found ${existingCount} existing records in electricity_raw.`);

  if (existingCount > 0) {
    console.log("Raw SQL data is already imported. Skipping raw SQL insert step.");
  } else {
    console.log(`Checking SQL files in import data folder: ${importDataDir}...`);
    if (!fs.existsSync(importDataDir)) {
      throw new Error(`Import directory not found at ${importDataDir}`);
    }

    const sqlFiles = fs.readdirSync(importDataDir)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // Sort so 2025-02, 2025-03, ... are loaded in order

    console.log(`Found ${sqlFiles.length} SQL files to import: ${sqlFiles.join(", ")}`);
    
    let totalRowsFound = 0;
    let importedRows = 0;
    let batch: any[] = [];
    const BATCH_SIZE = 5000;

    for (const sqlFile of sqlFiles) {
      const sqlFilePath = path.join(importDataDir, sqlFile);
      console.log(`\n==================================================`);
      console.log(`Parsing and importing SQL File: ${sqlFile}`);
      console.log(`==================================================`);

      const fileStream = fs.createReadStream(sqlFilePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let lineCount = 0;

      for await (const line of rl) {
        lineCount++;
        if (lineCount % 2000 === 0) {
          process.stdout.write(`Processed ${lineCount} lines...\r`);
        }

        if (!line.toLowerCase().includes("insert into")) {
          continue;
        }

        const rawRows = parseSqlInsertValues(line);
        for (const row of rawRows) {
          if (row.length < 19) continue;
          
          totalRowsFound++;
          const t_stamp = cleanStr(row[9]);
          const pm_id = cleanStr(row[14]);

          // Filter: ONLY import data from the Incoming PLN meter (PM8000)
          if (pm_id !== "Cubicle_PLN_PM8000") {
            continue;
          }

          if (!t_stamp.endsWith(":00")) {
            continue;
          }

          const parsedRow: SqlRow = {
            ndx: Number(row[0]),
            current_a: cleanVal(row[1]),
            current_b: cleanVal(row[2]),
            current_c: cleanVal(row[3]),
            frequency: cleanVal(row[4]),
            power_factor: cleanVal(row[5]),
            voltage_ab: cleanVal(row[6]),
            voltage_bc: cleanVal(row[7]),
            voltage_ca: cleanVal(row[8]),
            t_stamp,
            active_energy: cleanVal(row[10]),
            apparent_energy: cleanVal(row[11]),
            amp_unbalance: cleanVal(row[12]),
            reactive_energy: cleanVal(row[13]),
            pm_id,
            volt_ll_avg: cleanVal(row[15]),
            reactive_power: cleanVal(row[16]),
            apparent_power: cleanVal(row[17]),
            active_power: cleanVal(row[18])
          };

          const dateParts = t_stamp.split(" ");
          const [yr, mo, dy] = dateParts[0].split("-").map(Number);
          const [hr, min, sec] = dateParts[1].split(":").map(Number);
          const ts = new Date(yr, mo - 1, dy, hr, min, sec);

          // Incoming PLN PM8000 stores active power in Watts, divide by 1000 to scale to kW
          const powerScale = 1000; 

          const metrics = [
            { key: "active_power", val: parsedRow.active_power !== null ? parsedRow.active_power / powerScale : null, unit: "kW" },
            { key: "active_energy", val: parsedRow.active_energy, unit: "kWh" },
            { key: "power_factor", val: parsedRow.power_factor, unit: "" },
            { key: "voltage_avg", val: parsedRow.volt_ll_avg, unit: "V" },
            { key: "current_a", val: parsedRow.current_a !== null ? parsedRow.current_a / 1000 : null, unit: "A" }, 
            { key: "current_b", val: parsedRow.current_b !== null ? parsedRow.current_b / 1000 : null, unit: "A" },
            { key: "current_c", val: parsedRow.current_c !== null ? parsedRow.current_c / 1000 : null, unit: "A" },
            { key: "frequency", val: parsedRow.frequency, unit: "Hz" },
            { key: "voltage_ab", val: parsedRow.voltage_ab, unit: "V" },
            { key: "voltage_bc", val: parsedRow.voltage_bc, unit: "V" },
            { key: "voltage_ca", val: parsedRow.voltage_ca, unit: "V" },
            { key: "apparent_power", val: parsedRow.apparent_power !== null ? parsedRow.apparent_power / powerScale : null, unit: "kVA" },
            { key: "reactive_power", val: parsedRow.reactive_power !== null ? parsedRow.reactive_power / powerScale : null, unit: "kVAR" }
          ];

          for (const metric of metrics) {
            if (metric.val === null) continue;

            const tagId = `electricity/${pm_id}/${metric.key}`;
            
            batch.push({
              ts,
              value: metric.val,
              quality: "good",
              meta: {
                tagId,
                deviceId: pm_id,
                unit: metric.unit,
                area: "Utilities",
                source: "ignition"
              }
            });

            if (batch.length >= BATCH_SIZE) {
              await telemetryCollection.insertMany(batch, { ordered: false });
              importedRows += batch.length;
              batch = [];
            }
          }
        }
      }
      rl.close();
      console.log(`\nFinished parsing file: ${sqlFile}`);
    }

    if (batch.length > 0) {
      await telemetryCollection.insertMany(batch, { ordered: false });
      importedRows += batch.length;
      batch = [];
    }

    console.log(`\nSQL parsing and raw import complete!`);
    console.log(`- Total SQL records scanned: ${totalRowsFound}`);
    console.log(`- Telemetry raw records imported: ${importedRows}`);
  }

  // Populate historian_1m collection directly from telemetry_raw using insertMany batches
  console.log("Populating historian_1m database collection...");
  
  const copyPipeline = [
    {
      $match: {
        "meta.tagId": { $regex: /^electricity\// },
        ts: { $gte: new Date("2025-02-01T00:00:00Z"), $lte: new Date("2025-08-31T23:59:59Z") }
      }
    },
    {
      $project: {
        _id: 0,
        ts: 1,
        value: 1,
        meta: {
          tagId: "$meta.tagId",
          deviceId: "$meta.deviceId",
          unit: "$meta.unit",
          area: "$meta.area",
          source: { $literal: "rollup" },
          resolution: { $literal: "1m" },
          aggregate: { $literal: "avg" },
          count: { $literal: 1 },
          min: "$value",
          max: "$value",
          last: "$value"
        }
      }
    }
  ];

  console.log("Running aggregation to format historian_1m records...");
  const m1Docs = await telemetryCollection.aggregate(copyPipeline, { allowDiskUse: true }).toArray();
  console.log(`Found ${m1Docs.length} documents for historian_1m. Inserting...`);
  
  let writeBatch: any[] = [];
  let m1Inserted = 0;
  for (const doc of m1Docs) {
    writeBatch.push(doc);
    if (writeBatch.length >= 5000) {
      try {
        await historianCollection.insertMany(writeBatch, { ordered: false });
        m1Inserted += writeBatch.length;
      } catch (e) {}
      writeBatch = [];
    }
  }
  if (writeBatch.length > 0) {
    try {
      await historianCollection.insertMany(writeBatch, { ordered: false });
      m1Inserted += writeBatch.length;
    } catch (e) {}
  }
  console.log(`historian_1m populated successfully! Imported: ${m1Inserted} records.`);

  // Populate historian_1h collection by aggregating 1m historian records
  console.log("Populating historian_1h database collection...");

  const hourlyRollupPipeline = [
    {
      $match: {
        "meta.tagId": { $regex: /^electricity\// },
        ts: { $gte: new Date("2025-02-01T00:00:00Z"), $lte: new Date("2025-08-31T23:59:59Z") }
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

  console.log("Running hourly aggregation query...");
  const h1Docs = await historianCollection.aggregate(hourlyRollupPipeline, { allowDiskUse: true }).toArray();
  console.log(`Found ${h1Docs.length} documents for historian_1h. Inserting...`);
  
  writeBatch = [];
  let h1Inserted = 0;
  for (const doc of h1Docs) {
    writeBatch.push(doc);
    if (writeBatch.length >= 5000) {
      try {
        await hourlyCollection.insertMany(writeBatch, { ordered: false });
        h1Inserted += writeBatch.length;
      } catch (e) {}
      writeBatch = [];
    }
  }
  if (writeBatch.length > 0) {
    try {
      await hourlyCollection.insertMany(writeBatch, { ordered: false });
      h1Inserted += writeBatch.length;
    } catch (e) {}
  }
  console.log(`historian_1h populated successfully! Imported: ${h1Inserted} records.`);
  console.log("All imports and rollups completed!");
}

importSql()
  .then(() => {
    console.log("SUCCESS!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL ERROR DURING IMPORT:", err);
    process.exit(1);
  });
