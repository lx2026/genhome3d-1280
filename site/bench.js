const CHECK_LABELS = {
  technical: "the build",
  package_audit: "the package",
  bounds: "the measurements",
  placement: "floor placement",
};

const SEVERITY_LABELS = {
  blocking: "Blocking",
  major: "Major",
  minor: "Minor",
};

const PAGE_SIZE = 12;

const elements = {
  list: document.querySelector("#benches"),
  benchTemplate: document.querySelector("#bench-template"),
  tileTemplate: document.querySelector("#bench-tile-template"),
  detailTemplate: document.querySelector("#bench-detail-template"),
  search: document.querySelector("#bench-search"),
  category: document.querySelector("#bench-category"),
  onlyIssues: document.querySelector("#bench-only-issues"),
  count: document.querySelector("#bench-count"),
  showMore: document.querySelector("#bench-show-more"),
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
  benches: [],
  visible: PAGE_SIZE,
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

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const checkState = (value) => {
  if (value === "pass") return "pass";
  if (value === "pending" || value === undefined || value === null) return "pending";
  return "fail";
};

/** One plain sentence for the four automatic checks, naming only what did not pass. */
const checkSentence = (validation) => {
  const results = Object.entries(CHECK_LABELS).map(([key, label]) => [
    label,
    checkState(validation ? validation[key] : undefined),
  ]);
  const failed = results.filter(([, value]) => value === "fail").map(([label]) => label);
  const skipped = results.filter(([, value]) => value === "pending").map(([label]) => label);
  if (failed.length) return `Automatic checks: ${failed.join(" and ")} did not pass.`;
  if (skipped.length === results.length) return "Automatic checks: none were run.";
  if (skipped.length) {
    return `Automatic checks: passed, except ${skipped.join(" and ")}, which were not run.`;
  }
  return "Automatic checks: all four passed.";
};

const issueCounts = (entry) => {
  const findings = entry.findings || [];
  return {
    total: findings.length,
    fixed: findings.filter((finding) => finding.fixed).length,
    open: findings.filter((finding) => !finding.fixed).length,
  };
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
  elements.reference.alt = `The picture both models were given for ${bench.title}`;
  elements.download.href = `./${entry.usdz}`;
  elements.download.download = `${entry.asset_id.toLowerCase()}.usdz`;
  elements.download.setAttribute(
    "aria-label",
    `Download the USDZ ${entry.model} built for ${bench.title}`,
  );
  updateBackgroundControl();
  setStatus("Getting the 3D file", `Downloading ${formatBytes(entry.file_size_bytes)}`);

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
      "The 3D preview will not open here",
      "You can still download the file and open it with Apple Quick Look.",
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

const buildFlags = (entry) => {
  const flags = document.createElement("span");
  flags.className = "tile-flags";
  const add = (text, kind) => {
    const chip = document.createElement("span");
    chip.className = `chip chip-${kind}`;
    chip.textContent = text;
    flags.append(chip);
  };
  if (!entry.reviewed) {
    add("Not checked", "quiet");
    return flags;
  }
  const counts = issueCounts(entry);
  if (!counts.total) {
    add("Nothing wrong found", "clean");
    return flags;
  }
  if (counts.open) add(plural(counts.open, "problem", "problems"), "issue");
  if (counts.fixed) add(`${counts.fixed} fixed`, "fixed");
  return flags;
};

const buildTile = (entry, bench) => {
  const fragment = elements.tileTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);
  const tile = fragment.querySelector(".tile-build");

  const hero = field("hero");
  hero.src = `./${entry.hero}`;
  hero.alt = `${bench.title} as ${entry.model} built it`;

  field("model").textContent = entry.model;
  field("numbers").textContent = `${formatCount(entry.geometry.triangles)} triangles · ${
    formatBytes(entry.file_size_bytes)
  }`;
  field("flags").replaceWith(buildFlags(entry));

  tile.setAttribute("aria-label", `Open the ${entry.model} build of ${bench.title} in 3D`);
  tile.addEventListener("click", () => void openBuild(entry, bench));
  return fragment;
};

const buildDetail = (entry, bench) => {
  const fragment = elements.detailTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);

  field("model").textContent = entry.model;

  const inspection = field("inspection");
  inspection.src = `./${entry.inspection}`;
  inspection.alt = `${bench.title} as ${entry.model} built it, seen from behind`;

  field("triangles").textContent = formatCount(entry.geometry.triangles);
  field("objects").textContent = formatCount(entry.geometry.objects);
  field("materials").textContent = formatCount(entry.geometry.material_slots);
  field("size").textContent = formatBytes(entry.file_size_bytes);

  field("checks").textContent = checkSentence(entry.validation);
  field("method").textContent = `${entry.method} Harness: ${entry.harness}, ${formatDate(
    entry.built_on,
  )}.`;

  const sealed = entry.recorded_attribution || {};
  if (sealed.model) {
    field("sealed").textContent = `The file itself records: ${sealed.model}.`;
  } else if (sealed.author) {
    field("sealed").textContent = `The file itself records: ${sealed.author}, with no model version.`;
  } else {
    field("sealed").textContent = "The file itself records nothing about who built it.";
  }

  const issues = field("issues");
  const findings = entry.findings || [];
  if (findings.length) {
    findings.forEach((finding) => {
      const item = document.createElement("li");
      item.className = `issue issue-${finding.severity}`;
      const label = document.createElement("strong");
      label.textContent = SEVERITY_LABELS[finding.severity] || finding.severity;
      const text = document.createElement("span");
      text.textContent = finding.defect;
      item.append(label, text);
      if (finding.fixed) {
        const mark = document.createElement("em");
        mark.textContent = "Fixed";
        item.append(mark);
      }
      issues.append(item);
    });
  } else {
    issues.remove();
  }

  const download = field("download");
  download.href = `./${entry.usdz}`;
  download.setAttribute(
    "aria-label",
    `Download the USDZ ${entry.model} built for ${bench.title}`,
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
  field("dimensions").textContent = formatDimensions(bench.dimensions_m);

  const reference = field("reference");
  reference.src = `./${bench.reference}`;
  reference.alt = `The picture both models were given for ${bench.title}`;
  field("brief").textContent = bench.reference_asset_id;

  const tiles = field("tiles");
  bench.entries.forEach((entry) => tiles.append(buildTile(entry, bench)));

  const details = field("details");
  bench.entries.forEach((entry) => details.append(buildDetail(entry, bench)));

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

const matches = (bench) => {
  const term = elements.search.value.trim().toLowerCase();
  const room = elements.category.value;
  if (room && !bench.category_path.startsWith(room)) return false;
  if (elements.onlyIssues.checked) {
    const open = bench.entries.some((entry) => issueCounts(entry).open > 0);
    if (!open) return false;
  }
  if (!term) return true;
  const haystack = [
    bench.title,
    bench.category_label,
    bench.reference_asset_id,
    ...bench.entries.map((entry) => `${entry.model} ${entry.asset_id}`),
  ]
    .join(" ")
    .toLowerCase();
  return term.split(/\s+/).every((word) => haystack.includes(word));
};

const render = () => {
  const found = state.benches.filter(matches);
  const shown = found.slice(0, state.visible);
  elements.list.replaceChildren();
  if (!found.length) {
    const empty = document.createElement("p");
    empty.className = "bench-loading";
    empty.textContent = "Nothing matches that. Try a different word.";
    elements.list.append(empty);
  } else {
    shown.forEach((bench) => elements.list.append(buildBench(bench)));
  }
  elements.count.textContent = found.length
    ? `Showing ${shown.length} of ${plural(found.length, "bench", "benches")}`
    : "";
  elements.showMore.hidden = shown.length >= found.length;
  elements.showMore.textContent = `Show ${Math.min(
    PAGE_SIZE,
    found.length - shown.length,
  )} more`;
};

const resetPaging = () => {
  state.visible = PAGE_SIZE;
  render();
};

elements.search.addEventListener("input", resetPaging);
elements.category.addEventListener("change", resetPaging);
elements.onlyIssues.addEventListener("change", resetPaging);
elements.showMore.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  render();
});

const fillCategories = (benches) => {
  const rooms = [...new Set(benches.map((bench) => bench.category_path.split("/")[0]))];
  rooms.sort();
  rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room;
    option.textContent = room.charAt(0).toUpperCase() + room.slice(1).replace(/-/g, " ");
    elements.category.append(option);
  });
};

const renderSummary = (document_) => {
  const benches = document_.benches || [];
  const builds = benches.reduce((total, bench) => total + bench.entries.length, 0);
  const models = new Set(
    benches.flatMap((bench) => bench.entries.map((entry) => entry.model)),
  );
  const set = (key, value) => {
    const node = document.querySelector(`[data-stat="${key}"]`);
    if (node) node.textContent = value;
  };
  set("benches", formatCount(benches.length));
  set("builds", formatCount(builds));
  set("models", formatCount(models.size));
  elements.search.placeholder = `Search ${benches.length} benches`;
};

/** Write the audit note from the findings themselves so the numbers cannot go stale. */
const renderAuditNote = (document_, benches) => {
  const note = document.querySelector('[data-field="audit-note"]');
  if (!note) return;
  const audit = document_.audit;
  const findings = benches.flatMap((bench) =>
    bench.entries.flatMap((entry) => entry.findings || []),
  );
  if (!audit || !findings.length) {
    note.remove();
    return;
  }
  const fixed = findings.filter((finding) => finding.fixed).length;
  const models = [
    ...new Set(
      benches.flatMap((bench) =>
        bench.entries.filter((entry) => entry.reviewed).map((entry) => entry.model),
      ),
    ),
  ];
  const affected = benches.filter((bench) =>
    bench.entries.some((entry) => (entry.findings || []).length),
  ).length;

  note.replaceChildren();
  const label = document.createElement("strong");
  label.textContent = "The problems are listed.";
  const text = document.createElement("span");
  text.textContent =
    ` The ${models.join(" and ")} builds were compared against their pictures afterwards,` +
    ` which turned up ${plural(findings.length, "problem", "problems")} in ${affected} of them.` +
    ` ${fixed} were fixed and ${findings.length - fixed} are still there, listed under each build.` +
    " A model did that checking, not a person. ";
  const link = document.createElement("a");
  link.href = audit.report_url;
  link.textContent = "Read the full report";
  note.append(label, text, link, document.createTextNode("."));
};

const openFromHash = () => {
  const id = decodeURIComponent(location.hash.replace(/^#bench-/, ""));
  if (!id || !location.hash.startsWith("#bench-")) return;
  const target = state.benches.find((bench) => bench.id === id);
  if (!target) return;
  // A link to one bench beats whatever the filters were set to.
  if (!matches(target)) {
    elements.search.value = "";
    elements.category.value = "";
    elements.onlyIssues.checked = false;
  }
  const index = state.benches.filter(matches).findIndex((bench) => bench.id === id);
  if (index >= state.visible) state.visible = index + 1;
  render();
  document.querySelector(`#bench-${CSS.escape(id)}`)?.scrollIntoView();
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
    const benches = document_.benches || [];
    renderSummary(document_);
    if (!benches.length) {
      showMessage("No benches published yet.");
      return;
    }
    state.benches = benches;
    renderAuditNote(document_, benches);
    fillCategories(benches);
    render();
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
  } catch (error) {
    console.error(error);
    showMessage("The bench data could not be loaded.");
  }
};

init();
