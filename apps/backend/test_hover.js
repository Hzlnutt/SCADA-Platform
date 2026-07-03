const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture all console messages
  page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.text());
  });

  console.log('Navigating to login page...');
  await page.goto('http://localhost:5173');
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Logging in...');
  await page.type('input[type="email"]', 'timothy@gmail.com');
  await page.type('input[type="password"]', 'admin12345');
  await page.click('button[type="submit"]');

  console.log('Waiting for dashboard navigation...');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  console.log('Navigating to listrik page...');
  await page.goto('http://localhost:5173/listrik', { waitUntil: 'networkidle0' });

  // Find the chart container
  const chartSelector = 'svg[aria-label="Telemetry trend"]';
  await page.waitForSelector(chartSelector);
  
  const element = await page.$(chartSelector);
  const box = await element.boundingBox();
  console.log('Chart bounding box:', box);

  const hoverX = box.x + box.width / 2;
  const hoverY = box.y + box.height / 2;
  console.log(`Hovering at coordinate: X=${hoverX}, Y=${hoverY}`);

  await page.mouse.move(hoverX, hoverY);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Hovering at 25% of chart width...');
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Hovering at 75% of chart width...');
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await new Promise(resolve => setTimeout(resolve, 1000));

  await browser.close();
}

run().catch(console.error);
