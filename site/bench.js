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
  dialog: document.querySelector("#bench-viewer"),
  stage: document.querySelector("#bench-viewer-stage"),
  canvas: document.querySelector("#bench-viewer-canvas"),
  poster: document.querySelector("#bench-viewer-poster"),
  reference: document.querySelector("#bench-viewer-reference"),
  status: document.querySelector("#bench-viewer-status"),
  statusTitle: document.querySelector("#bench-viewer-status-title"),
  statusDetail: document.querySelector("#bench-viewer-status-detail"),
  title: document.querySelector("#bench-viewer-title"),
  kicker: document.querySelector("#bench-viewer-kicker"),
  meta: document.querySelector("#bench-viewer-meta"),
  download: document.querySelector("#bench-viewer-download"),
  close: document.querySelector("#bench-viewer-close"),
  reset: document.querySelector("#bench-viewer-reset"),
  background: document.querySelector("#bench-viewer-background"),
};

const readBackgroundPreference = () => {
  try {
    return localStorage.getItem("genhome3d-viewer-background") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
};

const state = {
  viewer: null,
  viewerLoad: 0,
  background: readBackgroundPreference(),
};

let viewerModulePromise;

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


const setStatus = (title, detail, stateName = "loading") => {
  elements.dialog.dataset.state = stateName;
  elements.status.hidden = false;
  elements.statusTitle.textContent = title;
  elements.statusDetail.textContent = detail;
};

const updateBackgroundControl = () => {
  const dark = state.background === "dark";
  elements.dialog.dataset.background = state.background;
  elements.background.textContent = dark ? "Light background" : "Dark background";
  elements.background.setAttribute("aria-pressed", String(dark));
  state.viewer?.setBackground(state.background);
};

const openBuild = async (entry, bench) => {
  const loadId = ++state.viewerLoad;
  elements.title.textContent = `${bench.title} · ${entry.model}`;
  elements.kicker.textContent = `${entry.asset_id} · built ${formatDate(entry.built_on)}`;
  elements.meta.textContent = `${entry.model} · ${formatCount(
    entry.geometry.triangles,
  )} triangles · ${formatBytes(entry.file_size_bytes)}`;
  elements.poster.src = `./${entry.hero}`;
  elements.poster.alt = `${bench.title} built by ${entry.model}, shown while its 3D model loads`;
  elements.poster.hidden = false;
  elements.reference.src = `./${bench.reference}`;
  elements.reference.alt = `Generated reference image for ${bench.title}`;
  elements.download.href = `./${entry.usdz}`;
  elements.download.download = `${entry.asset_id.toLowerCase()}.usdz`;
  elements.download.setAttribute(
    "aria-label",
    `Download the USDZ ${entry.model} built for ${bench.title}`,
  );
  updateBackgroundControl();
  setStatus("Loading 3D build", `Downloading ${formatBytes(entry.file_size_bytes)}`);

  if (!elements.dialog.open) elements.dialog.showModal();
  document.body.classList.add("viewer-open");

  try {
    viewerModulePromise ||= import("./viewer.js");
    const { AssetViewer } = await viewerModulePromise;
    if (loadId !== state.viewerLoad || !elements.dialog.open) return;

    state.viewer ||= new AssetViewer({
      canvas: elements.canvas,
      container: elements.stage,
    });
    state.viewer.setBackground(state.background);

    const loaded = await state.viewer.load(`./${entry.usdz}`, (received, total) => {
      if (loadId !== state.viewerLoad) return;
      const progress = total
        ? `${Math.round((received / total) * 100)}%`
        : formatBytes(received);
      elements.statusDetail.textContent = `${progress} · ${formatBytes(
        entry.file_size_bytes,
      )}`;
    });

    if (!loaded || loadId !== state.viewerLoad || !elements.dialog.open) return;
    elements.poster.hidden = true;
    elements.status.hidden = true;
    elements.dialog.dataset.state = "ready";
  } catch (error) {
    if (loadId !== state.viewerLoad) return;
    console.warn("Interactive USDZ preview unavailable:", error);
    setStatus(
      "Preview unavailable",
      "This USDZ can still be downloaded and opened with Apple Quick Look.",
      "error",
    );
  }
};

const closeBuild = () => {
  if (elements.dialog.open) elements.dialog.close();
};

elements.close.addEventListener("click", closeBuild);
elements.reset.addEventListener("click", () => state.viewer?.reset());
elements.background.addEventListener("click", () => {
  state.background = state.background === "light" ? "dark" : "light";
  try {
    localStorage.setItem("genhome3d-viewer-background", state.background);
  } catch {
    // The preference is optional when storage is unavailable.
  }
  updateBackgroundControl();
});
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeBuild();
});
elements.dialog.addEventListener("close", () => {
  state.viewerLoad += 1;
  state.viewer?.cancel();
  elements.poster.hidden = false;
  elements.reference.removeAttribute("src");
  document.body.classList.remove("viewer-open");
});

const buildColumn = (entry, bench) => {
  const benchTitle = bench.title;
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

  const view = field("view");
  view.addEventListener("click", () => void openBuild(entry, bench));

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
  bench.entries.forEach((entry) => columns.append(buildColumn(entry, bench)));

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
