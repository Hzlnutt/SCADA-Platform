async function runTest() {
  const apis = [
    "electric_ew21",
    "electric_ew22",
    "electric_ew23"
  ];

  for (const api of apis) {
    const url = `http://localhost:3001/system/webdev/Utility_Dashboard/${api}`;
    console.log(`\n----------------------------------------\nTesting: ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Error: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const keys = Object.keys(data);
      console.log(`Total Keys returned: ${keys.length}`);
      console.log("Sample keys:", keys.slice(0, 5));
      
      // Let's verify a specific key from each list
      if (api === "electric_ew21") {
        console.log("Active_Power_Total_pm133 in data:", "Active_Power_Total_pm133" in data);
        console.log("Sample data for pm133:", {
          Active_Power_Total_pm133: data.Active_Power_Total_pm133,
          VoltAB_pm133: data.VoltAB_pm133,
          Status_pm133: data.Status_pm133,
          ActiveEnergy_pm133: data.ActiveEnergy_pm133
        });
      } else if (api === "electric_ew22") {
        console.log("Active_Power_Total_pm206 in data:", "Active_Power_Total_pm206" in data);
        console.log("Sample data for pm206:", {
          Active_Power_Total_pm206: data.Active_Power_Total_pm206,
          VoltAB_pm206: data.VoltAB_pm206,
          Status_pm206: data.Status_pm206,
          ActiveEnergy_pm206: data.ActiveEnergy_pm206
        });
      } else if (api === "electric_ew23") {
        console.log("Active_Power_Total_pm411 in data:", "Active_Power_Total_pm411" in data);
        console.log("Sample data for pm411:", {
          Active_Power_Total_pm411: data.Active_Power_Total_pm411,
          VoltAB_pm411: data.VoltAB_pm411,
          Status_pm411: data.Status_pm411,
          ActiveEnergy_pm411: data.ActiveEnergy_pm411
        });
      }
    } catch (err: any) {
      console.error("Test request failed:", err.message);
    }
  }
}

runTest();
