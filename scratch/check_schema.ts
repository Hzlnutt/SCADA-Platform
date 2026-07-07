import { Client } from "pg";

const run = async () => {
  const client = new Client({
    host: "10.3.141.21",
    port: 5432,
    user: "test_user",
    password: "Pandaan1",
    database: "scada_test"
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL successfully!");

    const res = await client.query(`
      SELECT id_device, count(*), min(t_stamp), max(t_stamp)
      FROM electricity_telemetry
      GROUP BY id_device;
    `);
    console.log("Unique devices and counts:");
    console.log(res.rows);

  } catch (err) {
    console.error("Error querying:", err);
  } finally {
    await client.end();
  }
};

run();
