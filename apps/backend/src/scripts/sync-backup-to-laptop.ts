import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// File penanda apakah backup sukses sudah tercapai hari ini
const LAST_SYNC_FILE = path.resolve(__dirname, "../../../../.last_sync_success.txt");

// ==============================================================================
// KONFIGURASI DATABASE
// ==============================================================================
// 1. Database Server Sumber (SCADA Production)
const SERVER_CONFIG = {
  host: process.env.REMOTE_PG_HOST || process.env.SERVER_PG_HOST || process.env.POSTGRES_HOST || "utility.widatra.com",
  port: parseInt(process.env.REMOTE_PG_PORT || process.env.SERVER_PG_PORT || process.env.POSTGRES_PORT || "5432", 10),
  database: process.env.REMOTE_PG_DB || process.env.SERVER_PG_DB || process.env.POSTGRES_DB || "scada_test",
  user: process.env.REMOTE_PG_USER || process.env.SERVER_PG_USER || process.env.POSTGRES_USER || "test_user",
  password: process.env.REMOTE_PG_PASS || process.env.SERVER_PG_PASS || process.env.POSTGRES_PASSWORD || "Pandaan1",
  connectionTimeoutMillis: 10000,
};

// 2. Database Laptop Tujuan (Local Backup)
const LOCAL_CONFIG = {
  host: process.env.LOCAL_PG_HOST || "localhost",
  port: parseInt(process.env.LOCAL_PG_PORT || "5432", 10),
  database: process.env.LOCAL_PG_DB || "scada_backup",
  user: process.env.LOCAL_PG_USER || "postgres",
  password: process.env.LOCAL_PG_PASS || "postgres",
  connectionTimeoutMillis: 10000,
};

const BATCH_SIZE = 500;

async function runSync() {
  const isForce = process.argv.includes("--force");
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentHour = now.getHours();

  // Jika hari ini sudah sukses backup dan sekarang bukan jam 2 pagi, tidak perlu backup ulang
  if (!isForce && fs.existsSync(LAST_SYNC_FILE)) {
    try {
      const lastDate = fs.readFileSync(LAST_SYNC_FILE, "utf-8").trim();
      if (lastDate === todayStr && currentHour !== 2) {
        console.log(`ℹ️ [INFO] Backup hari ini (${todayStr}) sudah berhasil dilakukan. Menunggu jadwal jam 02:00 berikutnya.`);
        return;
      }
    } catch {}
  }

  console.log("==================================================================");
  console.log("🔄 SCADA DATABASE BACKUP & INCREMENTAL SYNC KE LAPTOP PRIBADI");
  console.log("==================================================================");
  console.log(`[SUMBER] Server: ${SERVER_CONFIG.host}:${SERVER_CONFIG.port} | DB: ${SERVER_CONFIG.database}`);
  console.log(`[TUJUAN] Laptop: ${LOCAL_CONFIG.host}:${LOCAL_CONFIG.port} | DB: ${LOCAL_CONFIG.database}`);
  console.log("------------------------------------------------------------------");

  const serverClient = new Client(SERVER_CONFIG);
  const localClient = new Client(LOCAL_CONFIG);

  try {
    // 1. Hubungkan ke Database Server
    console.log("📡 Menghubungkan ke database server...");
    await serverClient.connect();
    console.log("✅ Berhasil terhubung ke server SCADA!");

    // 2. Hubungkan ke Database Laptop
    console.log("💻 Menghubungkan ke database laptop lokal...");
    try {
      await localClient.connect();
      console.log("✅ Berhasil terhubung ke database laptop!");
    } catch (err: any) {
      if (err.message.includes(`database "${LOCAL_CONFIG.database}" does not exist`)) {
        console.log(`⚠️  Database "${LOCAL_CONFIG.database}" belum ada di laptop. Sedang membuat otomatis...`);
        const adminClient = new Client({ ...LOCAL_CONFIG, database: "postgres" });
        await adminClient.connect();
        await adminClient.query(`CREATE DATABASE "${LOCAL_CONFIG.database}"`);
        await adminClient.end();
        console.log(`✅ Database "${LOCAL_CONFIG.database}" berhasil dibuat di laptop!`);
        await localClient.connect();
      } else {
        throw err;
      }
    }

    // 3. Replikasi seluruh sequences dari server terlebih dahulu (mencegah error relation seq does not exist)
    console.log("🔢 Menyiapkan sequences di database laptop...");
    try {
      const seqRes = await serverClient.query(`
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
      `);
      for (const row of seqRes.rows) {
        await localClient.query(`CREATE SEQUENCE IF NOT EXISTS "${row.sequence_name}"`).catch(() => {});
      }
      console.log(`✅ ${seqRes.rows.length} sequences berhasil disiapkan.`);
    } catch (e: any) {
      console.warn("Peringatan saat menyiapkan sequence:", e.message);
    }

    // 4. Dapatkan daftar semua tabel dari server (public schema)
    const tablesRes = await serverClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);
    const tables = tablesRes.rows.map((r: any) => r.table_name);
    console.log(`\n📋 Ditemukan ${tables.length} tabel di database server.\n`);

    let totalSyncedRows = 0;

    for (const table of tables) {
      process.stdout.write(`⏳ Memproses tabel: [${table}] ... `);

      // Cek apakah tabel sudah ada di database laptop
      const checkTableRes = await localClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `, [table]);
      const tableExists = checkTableRes.rows[0].exists;

      // Jika belum ada di laptop, replikasi skema tabel dari server
      if (!tableExists) {
        const ddlRes = await serverClient.query(`
          SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [table]);

        // Buat sequence terkait jika ada di default value
        for (const col of ddlRes.rows) {
          if (col.column_default && col.column_default.includes("nextval")) {
            const match = col.column_default.match(/nextval\('([^']+)'/);
            if (match) {
              const seqName = match[1].split(".").pop()?.replace(/"/g, "") || "";
              if (seqName) {
                await localClient.query(`CREATE SEQUENCE IF NOT EXISTS "${seqName}"`).catch(() => {});
              }
            }
          }
        }

        const colsDef = ddlRes.rows.map((col: any) => {
          let type = col.data_type;
          if (type === "character varying") {
            type = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : "VARCHAR";
          } else if (type === "numeric") {
            if (col.numeric_precision && col.numeric_scale) {
              type = `NUMERIC(${col.numeric_precision},${col.numeric_scale})`;
            } else {
              type = "NUMERIC";
            }
          } else if (type === "timestamp without time zone") {
            type = "TIMESTAMP WITHOUT TIME ZONE";
          } else if (type === "timestamp with time zone") {
            type = "TIMESTAMP WITH TIME ZONE";
          } else if (type === "USER-DEFINED") {
            type = "TEXT";
          }
          const nullable = col.is_nullable === "NO" ? "NOT NULL" : "";
          const def = col.column_default ? `DEFAULT ${col.column_default}` : "";
          return `"${col.column_name}" ${type} ${nullable} ${def}`.trim();
        }).join(", ");

        await localClient.query(`CREATE TABLE IF NOT EXISTS "${table}" (${colsDef});`);

        // Replikasi primary key / unique constraints jika ada
        try {
          const pkRes = await serverClient.query(`
            SELECT c.conname, pg_get_constraintdef(c.oid) as condef
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            JOIN pg_class cl ON cl.oid = c.conrelid
            WHERE n.nspname = 'public' AND cl.relname = $1 AND c.contype IN ('p', 'u')
          `, [table]);
          for (const pk of pkRes.rows) {
            await localClient.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${pk.conname}" ${pk.condef}`).catch(() => {});
          }
        } catch {}
        
        // Salin index jika ada
        try {
          const indexRes = await serverClient.query(`
            SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1
          `, [table]);
          for (const idx of indexRes.rows) {
            await localClient.query(idx.indexdef).catch(() => {});
          }
        } catch {}
      }

      // Periksa kolom tabel (apakah memiliki id atau t_stamp)
      const colCheckRes = await localClient.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      const colNames = colCheckRes.rows.map((c: any) => c.column_name);
      const hasTstamp = colNames.includes("t_stamp");
      const hasId = colNames.includes("id");

      // Cek data terakhir yang ada di database laptop
      let maxVal: any = null;
      let orderCol = "";
      if (hasTstamp) {
        orderCol = "t_stamp";
        const maxRes = await localClient.query(`SELECT MAX("t_stamp") as max_val FROM "${table}"`);
        maxVal = maxRes.rows[0]?.max_val;
      } else if (hasId) {
        orderCol = "id";
        const maxRes = await localClient.query(`SELECT MAX("id") as max_val FROM "${table}"`);
        maxVal = maxRes.rows[0]?.max_val;
      }

      // Buat Query untuk mengambil data dari server
      let query = `SELECT * FROM "${table}"`;
      const queryParams: any[] = [];
      let isFirstTime = false;

      if (maxVal === null || maxVal === undefined) {
        // PERTAMA KALI: Masukkan semua data
        isFirstTime = true;
        if (orderCol) {
          query += ` ORDER BY "${orderCol}" ASC`;
        }
      } else {
        // SETERUSNYA: Hanya ambil data yang baru / belum ada
        query += ` WHERE "${orderCol}" > $1 ORDER BY "${orderCol}" ASC`;
        queryParams.push(maxVal);
      }

      const serverRowsRes = await serverClient.query(query, queryParams);
      const rows = serverRowsRes.rows;

      if (rows.length === 0) {
        console.log(`Sudah uptodate (0 baris baru).`);
        continue;
      }

      // Masukkan baris baru ke database laptop (secara batch)
      const quotedCols = colNames.map(c => `"${c}"`).join(", ");
      
      // Deteksi conflict target berdasarkan primary key atau unique constraint yang valid
      let onConflictClause = "";
      try {
        const constraintRes = await localClient.query(`
          SELECT pg_get_constraintdef(c.oid) as condef
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          JOIN pg_class cl ON cl.oid = c.conrelid
          WHERE n.nspname = 'public' AND cl.relname = $1 AND c.contype IN ('p', 'u')
          ORDER BY c.contype ASC
          LIMIT 1
        `, [table]);
        if (constraintRes.rows.length > 0) {
          const condef = constraintRes.rows[0].condef;
          const match = condef.match(/\(([^)]+)\)/);
          if (match) {
            onConflictClause = `ON CONFLICT (${match[1]}) DO NOTHING`;
          }
        }
      } catch {}

      let insertedCount = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const valuesArr: any[] = [];
        const valuePlaceholders: string[] = [];

        let paramIdx = 1;
        for (const row of batch) {
          const rowPlaceholders: string[] = [];
          for (const col of colNames) {
            valuesArr.push(row[col] !== undefined ? row[col] : null);
            rowPlaceholders.push(`$${paramIdx++}`);
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
        }

        const insertQuery = `
          INSERT INTO "${table}" (${quotedCols})
          VALUES ${valuePlaceholders.join(", ")}
          ${onConflictClause}
        `;

        try {
          await localClient.query(insertQuery, valuesArr);
          insertedCount += batch.length;
        } catch (err: any) {
          // Fallback baris demi baris jika ada batch error
          for (const row of batch) {
            const rowVals = colNames.map(c => row[c] !== undefined ? row[c] : null);
            const rowHolders = colNames.map((_, idx) => `$${idx + 1}`).join(", ");
            await localClient.query(
              `INSERT INTO "${table}" (${quotedCols}) VALUES (${rowHolders}) ${onConflictClause}`,
              rowVals
            ).catch(() => {});
            insertedCount++;
          }
        }
      }

      if (hasId) {
        await localClient.query(`
          SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX("id") FROM "${table}"), 1), true)
        `).catch(() => {});
      }

      const statusTag = isFirstTime ? "🎉 INITIAL FULL SYNC" : "⚡ INCREMENTAL SYNC";
      console.log(`${statusTag}: +${insertedCount} baris baru dimasukkan.`);
      totalSyncedRows += insertedCount;
    }

    console.log("------------------------------------------------------------------");
    console.log(`✨ SINKRONISASI SELESAI SUKSES! Total data disinkronkan: ${totalSyncedRows} baris.`);
    console.log("==================================================================");

    try {
      fs.writeFileSync(LAST_SYNC_FILE, todayStr, "utf-8");
      console.log(`💾 Tanggal backup sukses hari ini (${todayStr}) telah dicatat.`);
    } catch {}

  } catch (error: any) {
    console.error("\n❌ Terjadi kesalahan saat sinkronisasi:", error.message);
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      console.log("\n💡 TIPS KONEKSI:");
      console.log("1. Pastikan laptop Anda bisa mengakses IP/Domain server.");
      console.log("2. Jika port 5432 di server diproteksi firewall, buka SSH tunnel terlebih dahulu:");
      console.log("   ssh -L 5433:localhost:5432 sysadmin@utilitysvr");
      console.log("   Lalu jalankan script dengan: REMOTE_PG_HOST=localhost REMOTE_PG_PORT=5433 pnpm run sync:backup");
    }
  } finally {
    await serverClient.end().catch(() => {});
    await localClient.end().catch(() => {});
  }
}

runSync();
