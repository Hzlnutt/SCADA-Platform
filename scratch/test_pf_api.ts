const run = async () => {
  try {
    const res = await fetch("http://10.3.164.3:8088/system/webdev/Utility_Dashboard/electric_pln");
    console.log("Response status:", res.status);
    const text = await res.text();
    console.log("Response text:", text);
  } catch (err: any) {
    console.error("Error fetching API:", err.message);
  }
};

run();
