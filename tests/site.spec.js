const { test, expect } = require("@playwright/test");

const baseURL = process.env.GENHOME3D_SITE_URL || "http://127.0.0.1:4173";

test("catalog loads, filters, and expands without browser errors", async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

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

  const firstDownload = page.locator(".asset-image").first();
  await expect(firstDownload).toHaveAttribute("href", /\.usdz$/);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("mobile layout preserves navigation and search", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("#search")).toBeVisible();
  await expect(page.locator(".asset-card").first()).toBeVisible();
  await page.screenshot({
    path: process.env.GENHOME3D_MOBILE_SCREENSHOT || "test-results/mobile.png",
    fullPage: true,
  });
});
