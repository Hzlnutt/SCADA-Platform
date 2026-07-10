import { getElectricityAnalytics } from "../apps/backend/src/modules/analytics/electricity.analytics";
import { connectMongo } from "../apps/backend/src/database/mongo";
import { getPostgresPool } from "../apps/backend/src/database/postgres";

const run = async () => {
  try {
    await connectMongo();
    const res = await getElectricityAnalytics("Cubicle_PLN_PM8000", undefined, undefined, 1112, 1600, 2026);
    console.log("Analytics summary:", JSON.stringify(res.summary, null, 2));
    console.log("Hourly chart values:", res.charts.hourly);
    const nonZeroDaily = res.charts.daily.filter((d: any) => d.value > 0);
    console.log("Non-zero daily values count:", nonZeroDaily.length);
    if (nonZeroDaily.length > 0) {
      console.log("Sample non-zero daily:", nonZeroDaily.slice(0, 5));
    }
  } catch (err) {
    console.error("Error running analytics:", err);
  }
};

run();
