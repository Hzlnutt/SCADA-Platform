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

    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-12-31T23:59:59Z");

    const res = await client.query(`
      SELECT DISTINCT ON (date_trunc('hour', t_stamp)) 
        t_stamp AS ts, 
        electricity_kwh::float AS value
      FROM electricity_telemetry
      WHERE id_device = $1 AND t_stamp >= $2 AND t_stamp <= $3
      ORDER BY date_trunc('hour', t_stamp), t_stamp DESC
    `, ["Cubicle_PLN_PM8000", from, to]);
    
    console.log("Query results count for 2026:", res.rows.length);
    console.log("Rows selected:", res.rows);

  } catch (err) {
    console.error("Error querying:", err);
  } finally {
    await client.end();
  }
};

run();
