const { test, expect } = require("@playwright/test");

const baseURL = process.env.GENHOME3D_SITE_URL || "http://127.0.0.1:4173";

test("catalog loads, filters, and expands without browser errors", async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const viewerRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/vendor/") || url.endsWith("/viewer.js")) viewerRequests.push(url);
  });

  await page.goto(baseURL, { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("Built for rooms");
  await expect(page.locator("#result-count")).toHaveText("1,280");
  await expect(page.locator(".asset-card")).toHaveCount(24);

  const firstImage = page.locator(".asset-card img").first();
  await firstImage.scrollIntoViewIfNeeded();
  await expect(firstImage).toBeVisible();
  await expect
    .poll(() => firstImage.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);

  await page.locator("#search").fill("MXB-0014");
  await expect(page.locator("#result-count")).toHaveText("1");
  await expect(page.locator(".asset-card h3")).toHaveText(
    "White Marble Brass-Foot Mixing Bowl",
  );

  await page.locator("#search").fill("");
  await page.locator("#category-filter").selectOption("lighting/pendants");
  await expect(page.locator("#result-count")).toHaveText("20");
  await expect(page.locator(".asset-card")).toHaveCount(20);

  await page.locator("#category-filter").selectOption("all");
  await page.locator("#load-more").click();
  await expect(page.locator(".asset-card")).toHaveCount(48);

  const firstDownload = page.locator(".asset-download").first();
  await expect(firstDownload).toHaveAttribute("href", /\.usdz$/);
  expect(viewerRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("representative assets open as lazy-loaded interactive USDZ previews", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(baseURL, { waitUntil: "networkidle" });
  const dialog = page.locator("#asset-viewer");
  const examples = [
    ["ARM-0001", "Scandinavian Oak Open-Arm Armchair"],
    ["PND-0010", "Satin-Brass Thin-Disc Pendant"],
    ["MXB-0014", "White Marble Brass-Foot Mixing Bowl"],
  ];

  for (const [id, title] of examples) {
    await page.locator("#search").fill(id);
    await page.locator(".asset-view").click();

    await expect(dialog).toBeVisible();
    await expect(page.locator("#viewer-title")).toHaveText(title);
    await expect(page.locator("#viewer-download")).toHaveAttribute("href", /\.usdz$/);
    await expect(dialog).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator("#viewer-status")).toBeHidden();

    const canvas = page.locator("#viewer-canvas");
    await expect(canvas).toBeVisible();
    const canvasSize = await canvas.evaluate((element) => ({
      width: element.width,
      height: element.height,
    }));
    expect(canvasSize.width).toBeGreaterThan(300);
    expect(canvasSize.height).toBeGreaterThan(200);

    await page.locator("#viewer-reset").click();
    await page.locator("#viewer-close").click();
    await expect(dialog).toBeHidden();
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("mobile layout preserves navigation and search", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.locator(".asset-card").first()).toBeVisible();
  await expect(page.locator(".asset-view").first()).toBeVisible();
  await page.locator("#search").fill("PND-0010");
  await page.locator(".asset-view").click();
  await expect(page.locator("#asset-viewer")).toBeVisible();
  await expect(page.locator("#viewer-meta")).toBeVisible();
  await expect(page.locator("#viewer-download")).toBeVisible();
  await page.locator("#viewer-close").click();
  await page.screenshot({
    path: process.env.GENHOME3D_MOBILE_SCREENSHOT || "test-results/mobile.png",
    fullPage: true,
  });
});
