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
  await expect(page.locator("h1")).toContainText("From reference image to 3D object");
  await expect(page.locator("body")).not.toContainText("validated");
  await expect(page.locator("#result-count")).toHaveText("1,280");
  await expect(page.locator(".asset-card")).toHaveCount(24);

  const firstReference = page.locator(".asset-reference").first();
  const firstPreview = page.locator(".asset-preview").first();
  await firstReference.scrollIntoViewIfNeeded();
  await expect(firstReference).toBeVisible();
  await expect(firstPreview).toBeVisible();
  await expect(firstReference).toHaveAttribute("src", /references\/.+\.jpg$/);
  await expect(firstPreview).toHaveAttribute("src", /previews\/.+\.jpg$/);
  await expect
    .poll(() => firstReference.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect
    .poll(() => firstPreview.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  const firstView = page.locator(".asset-view").first();
  await expect(firstView).toBeVisible();
  await expect(firstView).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

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
    await expect(page).toHaveURL(new RegExp(`[?&]asset=${id}`));
    await expect(page.locator("#viewer-reference")).toHaveAttribute(
      "src",
      new RegExp(`/references/.+\\.jpg$`),
    );
    await expect
      .poll(() =>
        page.locator("#viewer-reference").evaluate((image) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
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
    await page.locator("#viewer-background").click();
    await expect(dialog).toHaveAttribute("data-background", "dark");
    await page.locator("#viewer-background").click();
    await expect(dialog).toHaveAttribute("data-background", "light");
    await page.locator("#viewer-close").click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]asset=/);
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("direct object URLs open the requested side-by-side comparison", async ({ page }) => {
  test.setTimeout(45_000);
  const objectURL = new URL(baseURL);
  objectURL.searchParams.set("asset", "DRS-0002");

  await page.goto(objectURL.toString(), { waitUntil: "networkidle" });
  await expect(page.locator("#asset-viewer")).toBeVisible();
  await expect(page.locator("#viewer-title")).toHaveText(
    "French Provincial Painted-Ash Serpentine Dresser",
  );
  await expect(page.locator("#viewer-reference")).toHaveAttribute(
    "src",
    /references\/cabinets-storage\/dressers\/drs-0002-.+\.jpg$/,
  );
  await expect(page.locator("#viewer-reference")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("#viewer-reference").evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator("#viewer-canvas")).toBeVisible();

  await page.locator("#viewer-close").click();
  await expect(page.locator("#asset-viewer")).toBeHidden();
  await expect(page).not.toHaveURL(/[?&]asset=/);
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

test("benchmark coverage, categories and pages follow the selected run", async ({ page }) => {
  await page.goto(`${baseURL}/bench.html`);
  await expect(page.locator("body")).toHaveAttribute("data-benchmark-state", "ready");
  await expect(page.locator('[data-stat="benches"]')).toHaveText("1,319");
  await expect(page.locator('[data-stat="builds"]')).toHaveText("2,854");
  await expect(page.locator("#benches")).toHaveAttribute("data-result-count", "1280");
  await expect(page.locator(".bench")).toHaveCount(12);
  await page.locator("#bench-category").selectOption("seating/armchairs");
  await expect(page.locator("#benches")).toHaveAttribute("data-result-count", "20");
  await page.locator("#bench-next").click();
  await expect(page.locator(".bench")).toHaveCount(8);
  await page.locator("#bench-page-size").selectOption("24");
  await expect(page.locator(".bench")).toHaveCount(20);
  await page.locator("#bench-clear").click();
  await page.locator('#bench-models [data-model="claude-opus-5"]').click();
  await expect(page.locator("#benches")).toHaveAttribute("data-result-count", "241");
  await page.locator('#bench-models [data-model="claude-fable-5"]').click();
  await expect(page.locator("#benches")).toHaveAttribute("data-result-count", "14");
  await page.locator("#bench-clear").click();
  await page.locator("#bench-comparisons-only").check();
  await expect(page.locator("#benches")).toHaveAttribute("data-result-count", "216");
  await page.locator("#bench-all-models").click();
  await expect(page.locator("#benches")).toHaveAttribute("data-result-count", "255");
});

test("search preserves distinct references and shows rear views and historical notes", async ({ page }) => {
  await page.goto(`${baseURL}/bench.html?model=all&q=CHR-0002`);
  await expect(page.locator("#bench-windsor-comb-back-armchair")).toBeVisible();
  await page.locator("#bench-search").fill("ARM-3003");
  await expect(page.locator("#bench-windsor-comb-back-armchair-arm-0003")).toBeVisible();
  await expect(page.locator(".bench")).toHaveCount(1);
  await page.locator("#bench-search").fill("CHS-3018");
  await expect(page.locator('.tile-build[data-asset-id="CHS-3018"]')).toBeVisible();
  await page.locator(".bench-more summary").click();
  await expect.poll(() => page.locator('.detail-shot img').first().evaluate(im => im.naturalWidth)).toBeGreaterThan(0);
  await page.locator("#bench-search").fill("no-matching-reference-zzzz");
  await expect(page.locator(".bench")).toHaveCount(0);
  await expect(page.locator(".bench-loading")).toContainText("No matching objects");
  await page.goto(`${baseURL}/bench.html#bench-stainless-single-whistle-dome-kettle`);
  const kettle = page.locator("#bench-stainless-single-whistle-dome-kettle");
  await expect(kettle).toBeVisible();
  await kettle.locator(".bench-more summary").click();
  await expect(kettle.locator(".historical-audit").filter({hasText:"Historical AI audit notes"}).first()).toContainText("not a human review");
});

test("benchmark filter links survive reload and mobile remains usable", async ({ page }) => {
  await page.goto(`${baseURL}/bench.html?model=gpt-6-astra&category=bathroom%2Faccessories`);
  await expect(page.locator("#bench-category")).toHaveValue("bathroom/accessories");
  await expect(page.locator("#bench-room")).toHaveValue("");
  await expect(page.locator("#benches")).toHaveAttribute("data-result-count", "20");
  await page.reload();
  await expect(page.locator("#bench-category")).toHaveValue("bathroom/accessories");
  await expect(page.locator("#bench-room")).toHaveValue("");
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 390 && document.documentElement.clientWidth === 390)).toBe(true);
  await page.locator("#bench-search").fill("BAC-3018");
  await expect(page.locator('.tile-build[data-asset-id="BAC-3018"]')).toBeVisible();
});

test("benchmark builds retain interactive previews and downloads", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`${baseURL}/bench.html?model=gpt-6-astra&q=COF-3002`);
  await page.locator('.tile-build[data-asset-id="COF-3002"]').click();
  const dialog=page.locator("#bench-viewer");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#bench-viewer-title")).toContainText("GPT-6 Astra");
  await expect(page.locator("#bench-viewer-download")).toHaveAttribute("href",/\.usdz$/);
  await expect.poll(() => dialog.getAttribute("data-state"), {timeout:60000}).toBe("ready");
  await expect(page.locator("#bench-viewer-poster")).toBeHidden();
  await page.locator("#bench-viewer-background").click();
  await page.locator("#bench-viewer-reset").click();
  await page.locator("#bench-viewer-close").click();
  await expect(dialog).toBeHidden();
});

test("the landing page routes to the reorganized benchmark", async ({ page }) => {
  await page.goto(baseURL);
  await expect(page.locator('[data-stat="benches"]')).toHaveText("1,319");
  await expect(page.locator('[data-stat="bench-models"]')).toHaveText("4");
  await page.locator(".bench-band-card a.button").click();
  await expect(page.locator("#benches")).toHaveAttribute("data-result-count", "1280");
});
