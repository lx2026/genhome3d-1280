const CHECK_LABELS = {
  technical: "Technical build",
  package_audit: "Package audit",
  bounds: "Bounds",
  placement: "Floor placement",
  visual_review: "Visual review",
};

const elements = {
  list: document.querySelector("#benches"),
  benchTemplate: document.querySelector("#bench-template"),
  columnTemplate: document.querySelector("#bench-column-template"),
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
};

const formatCount = (value) =>
  Number.isFinite(value) ? value.toLocaleString("en-US") : "—";

const formatDimensions = (dimensions) => {
  if (!dimensions) return "—";
  const { width, depth, height } = dimensions;
  return `${width} × ${depth} × ${height} m`;
};

const formatDate = (value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

const checkState = (value) => {
  if (value === "pass") return "pass";
  if (value === "pending" || value === undefined || value === null) return "pending";
  return "fail";
};

const checkText = (value) => {
  if (value === "pass") return "pass";
  if (value === "pending" || value === undefined || value === null) return "not reviewed";
  return String(value);
};

const buildColumn = (entry, benchTitle) => {
  const fragment = elements.columnTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);

  field("model").textContent = entry.model;
  field("harness").textContent = entry.harness;
  field("built-on").textContent = formatDate(entry.built_on);

  const hero = field("hero");
  hero.src = `./${entry.hero}`;
  hero.alt = `${benchTitle} built by ${entry.model}, three-quarter view`;

  const inspection = field("inspection");
  inspection.src = `./${entry.inspection}`;
  inspection.alt = `${benchTitle} built by ${entry.model}, reverse view`;

  field("triangles").textContent = formatCount(entry.geometry.triangles);
  field("objects").textContent = formatCount(entry.geometry.objects);
  field("materials").textContent = formatCount(entry.geometry.material_slots);
  field("size").textContent = formatBytes(entry.file_size_bytes);

  const checks = field("checks");
  Object.entries(CHECK_LABELS).forEach(([key, label]) => {
    const value = entry.validation ? entry.validation[key] : undefined;
    const item = document.createElement("li");
    item.className = `bench-check bench-check-${checkState(value)}`;
    const name = document.createElement("span");
    name.textContent = label;
    const state = document.createElement("strong");
    state.textContent = checkText(value);
    item.append(name, state);
    checks.append(item);
  });

  const sealed = entry.recorded_attribution || {};
  if (sealed.model) {
    field("sealed").textContent = `Provenance sealed: ${sealed.model}`;
  } else if (sealed.author) {
    field("sealed").textContent = `Provenance sealed: ${sealed.author}, no model version`;
  } else {
    field("sealed").textContent = "Provenance not sealed";
  }

  field("method").textContent = entry.method;
  field("review").textContent = entry.review_note;

  const download = field("download");
  download.href = `./${entry.usdz}`;
  download.setAttribute(
    "aria-label",
    `Download the USDZ ${entry.model} built for ${benchTitle}`
  );
  field("asset-id").textContent = entry.asset_id;

  return fragment;
};

const buildBench = (bench) => {
  const fragment = elements.benchTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);

  const article = fragment.querySelector(".bench");
  article.id = `bench-${bench.id}`;

  field("category").textContent = bench.category_label;
  field("title").textContent = bench.title;
  field("summary").textContent = bench.summary;
  field("target-id").textContent = bench.reference_asset_id;
  field("dimensions").textContent = formatDimensions(bench.dimensions_m);
  field("entry-count").textContent = `${bench.entries.length} models`;

  const reference = field("reference");
  reference.src = `./${bench.reference}`;
  reference.alt = `Generated reference image for ${bench.title}`;
  field("brief").textContent = bench.brief;

  const columns = field("columns");
  bench.entries.forEach((entry) => columns.append(buildColumn(entry, bench.title)));

  const observations = field("observations");
  if (bench.observations && bench.observations.length) {
    bench.observations.forEach((observation) => {
      const item = document.createElement("li");
      item.textContent = observation;
      observations.append(item);
    });
  } else {
    field("observations-section").remove();
  }

  return fragment;
};

const renderSummary = (document_) => {
  const benches = document_.benches || [];
  const builds = benches.reduce((total, bench) => total + bench.entries.length, 0);
  const set = (key, value) => {
    const node = document.querySelector(`[data-stat="${key}"]`);
    if (node) node.textContent = value;
  };
  set("benches", formatCount(benches.length));
  set("builds", formatCount(builds));
};

const showMessage = (message) => {
  elements.list.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.className = "bench-loading";
  paragraph.textContent = message;
  elements.list.append(paragraph);
};

const init = async () => {
  try {
    const response = await fetch("./benchmarks.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`benchmarks.json ${response.status}`);
    const document_ = await response.json();
    renderSummary(document_);
    const benches = document_.benches || [];
    if (!benches.length) {
      showMessage("No benches published yet.");
      return;
    }
    elements.list.replaceChildren();
    benches.forEach((bench) => elements.list.append(buildBench(bench)));
  } catch (error) {
    console.error(error);
    showMessage("The bench data could not be loaded.");
  }
};

init();
