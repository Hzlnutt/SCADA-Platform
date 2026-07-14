import { getPostgresPool } from "../../database/postgres";

/**
 * Updates cumulative running hours for an equipment status tag in PostgreSQL.
 * If the equipment was previously ON (true), calculates elapsed time in hours
 * and adds it to the cumulative total. Then updates state and timestamp.
 */
export const updateRunningHours = async (tagId: string, newState: boolean, timestamp: Date) => {
  const pool = getPostgresPool();
  try {
    const res = await pool.query(
      "SELECT total_running_hours, last_state, last_changed_at FROM equipment_running_hours WHERE tag_id = $1",
      [tagId]
    );

    if (res.rows.length === 0) {
      // First time seeing this tag: record initial state
      await pool.query(
        "INSERT INTO equipment_running_hours (tag_id, total_running_hours, last_state, last_changed_at) VALUES ($1, 0.0, $2, $3)",
        [tagId, newState, timestamp]
      );
    } else {
      const row = res.rows[0];
      const lastState = row.last_state;
      const lastChangedAt = new Date(row.last_changed_at);
      let totalRunningHours = parseFloat(row.total_running_hours);

      if (lastState === true) {
        // Equipment was running: accumulate duration since last update
        const durationHours = (timestamp.getTime() - lastChangedAt.getTime()) / (1000 * 60 * 60);
        if (durationHours > 0) {
          totalRunningHours += durationHours;
        }
      }

      await pool.query(
        "UPDATE equipment_running_hours SET total_running_hours = $1, last_state = $2, last_changed_at = $3 WHERE tag_id = $4",
        [totalRunningHours, newState, timestamp, tagId]
      );
    }
  } catch (err: any) {
    console.error(`Failed to update running hours for ${tagId}:`, err.message);
  }
};
