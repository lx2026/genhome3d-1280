"use strict";
const CHECK_LABELS = { technical: "build", package_audit: "package", bounds: "measurements", placement: "placement" };
const SEVERITY_LABELS = { blocking: "Blocking", major: "Major", minor: "Minor" };
const $ = (selector) => document.querySelector(selector);
const elements = {
  list: $("#benches"), benchTemplate: $("#bench-template"), tileTemplate: $("#bench-tile-template"), detailTemplate: $("#bench-detail-template"),
  search: $("#bench-search"), room: $("#bench-room"), category: $("#bench-category"), pageSize: $("#bench-page-size"), comparisonsOnly: $("#bench-comparisons-only"), count: $("#bench-count"),
  models: $("#bench-models"), allModels: $("#bench-all-models"), activeModel: $("#bench-active-model"), clear: $("#bench-clear"),
  previous: $("#bench-prev"), next: $("#bench-next"), previousTop: $("#bench-prev-top"), nextTop: $("#bench-next-top"), page: $("#bench-page"), pageTop: $("#bench-page-top"), pageTotal: $("#bench-page-total"),
  dialog: $("#bench-viewer"), stage: $("#bench-viewer-stage"), canvas: $("#bench-viewer-canvas"), poster: $("#bench-viewer-poster"), reference: $("#bench-viewer-reference"), status: $("#bench-viewer-status"), statusTitle: $("#bench-viewer-status-title"), statusDetail: $("#bench-viewer-status-detail"), title: $("#bench-viewer-title"), kicker: $("#bench-viewer-kicker"), meta: $("#bench-viewer-meta"), download: $("#bench-viewer-download"), close: $("#bench-viewer-close"), reset: $("#bench-viewer-reset"), background: $("#bench-viewer-background"),
};
const readBackgroundPreference = () => { try { return localStorage.getItem("genhome3d-viewer-background") === "dark" ? "dark" : "light"; } catch { return "light"; } };
const state = { benches: [], models: [], model: "gpt-6-astra", page: 1, pageCount: 1, pageSize: 12, viewer: null, viewerLoad: 0, background: readBackgroundPreference(), ready: false };
const slug = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const modelID = (entry) => slug(entry.model);
const assetURL = (path) => /^(https?:)?\/\//i.test(path || "") ? path : `./${String(path || "").replace(/^\.\//, "")}`;
const buildURL = (entry) => assetURL(entry.download_url || entry.usdz);
const niceLabel = (value) => String(value || "").split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const getRoom = (bench) => bench.category_path.split("/")[0];
const defaultModel = () => state.models.some((model) => model.id === "gpt-6-astra") ? "gpt-6-astra" : "all";
const selectedModel = () => state.models.find((model) => model.id === state.model);
const hasSelectedModel = (bench) => state.model === "all" || bench.entries.some((entry) => modelID(entry) === state.model);
const orderedEntries = (bench) => [...bench.entries].sort((a, b) => {
  const score = (entry) => modelID(entry) === state.model ? -1 : state.models.findIndex((model) => model.id === modelID(entry));
  return score(a) - score(b);
});
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

/** One plain sentence for the four automatic checks, naming only what did not pass. */
const checkSentence = (validation) => {
  const results = Object.entries(CHECK_LABELS).map(([key, label]) => [
    label,
    checkState(validation ? validation[key] : undefined),
  ]);
  const failed = results.filter(([, value]) => value === "fail").map(([label]) => label);
  const skipped = results.filter(([, value]) => value === "pending").map(([label]) => label);
  if (failed.length) return `Automatic checks: ${failed.join(" and ")} did not pass.`;
  if (skipped.length === results.length) return "No automatic check results are published for this build.";
  if (skipped.length) {
    return `Automatic checks: passed, except ${skipped.join(" and ")}, which have no published result.`;
  }
  return "Automatic checks: all four passed.";
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
    entry.geometry?.triangles,
  )} triangles · ${formatBytes(entry.file_size_bytes)}`;
  elements.poster.src = assetURL(entry.hero);
  elements.poster.alt = `${bench.title} built by ${entry.model}, shown while its 3D model loads`;
  elements.poster.hidden = false;
  elements.reference.src = assetURL(bench.reference);
  elements.reference.alt = `Shared reference image for ${bench.title}`;
  elements.download.href = buildURL(entry);
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

    const loaded = await state.viewer.load(buildURL(entry), (received, total) => {
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

const buildTile = (entry, bench) => {
  const fragment = elements.tileTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);
  const tile = fragment.querySelector(".tile-build");
  tile.dataset.assetId = entry.asset_id;
  tile.dataset.model = modelID(entry);
  tile.classList.toggle("is-selected", modelID(entry) === state.model);
  field("hero").src = assetURL(entry.hero);
  field("hero").alt = `${bench.title} — ${entry.model} render`;
  field("model").textContent = entry.model;
  field("numbers").textContent = `${formatCount(entry.geometry?.triangles)} triangles · ${formatBytes(entry.file_size_bytes)}`;
  tile.setAttribute("aria-label", `Open ${entry.model}: ${bench.title} in 3D`);
  tile.addEventListener("click", () => void openBuild(entry, bench));
  return fragment;
};
const buildDetail = (entry, bench) => {
  const fragment = elements.detailTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);
  field("model").textContent = entry.model;
  if (entry.inspection) {
    field("inspection").src = assetURL(entry.inspection);
    field("inspection").alt = `${bench.title} — ${entry.model}, rear inspection`;
    field("inspection-link").href = assetURL(entry.inspection);
    field("inspection-link").setAttribute("aria-label", `Open full-size rear view of ${entry.asset_id}`);
  } else {
    fragment.querySelector(".detail-shot").remove();
  }
  field("triangles").textContent = formatCount(entry.geometry?.triangles);
  field("objects").textContent = formatCount(entry.geometry?.objects);
  field("materials").textContent = formatCount(entry.geometry?.material_slots);
  field("size").textContent = formatBytes(entry.file_size_bytes);
  field("checks").textContent = checkSentence(entry.validation);
  field("method").textContent = [entry.method, entry.harness ? `Harness: ${entry.harness}.` : "", entry.built_on ? `Built ${formatDate(entry.built_on)}.` : ""].filter(Boolean).join(" ");
  const sealed = entry.recorded_attribution || {};
  field("sealed").textContent = sealed.model ? `Embedded model attribution: ${sealed.model}.` : sealed.author ? `Embedded author: ${sealed.author}; no model version recorded.` : "No embedded model attribution is published.";
  // Preserve historical Opus findings as explicitly attributed notes. No review
  // verdicts, zero-finding badges, or review counts are shown for any model.
  const findings = /opus/i.test(entry.model) ? entry.findings || [] : [];
  if (findings.length) {
    findings.forEach((finding) => {
      const item = document.createElement("li");
      item.className = "issue";
      const label = document.createElement("strong");
      label.textContent = SEVERITY_LABELS[finding.severity] || finding.severity || "Finding";
      const text = document.createElement("span");
      text.textContent = finding.defect;
      item.append(label, text);
      if (finding.fixed) { const mark = document.createElement("em"); mark.textContent = "Recorded as fixed"; item.append(mark); }
      field("issues").append(item);
    });
  } else field("audit").remove();
  field("download").href = buildURL(entry);
  field("download").download = `${entry.asset_id.toLowerCase()}.usdz`;
  field("download").setAttribute("aria-label", `Download ${entry.model} USDZ for ${bench.title}`);
  field("asset-id").textContent = entry.asset_id;
  return fragment;
};
const buildBench = (bench) => {
  const fragment = elements.benchTemplate.content.cloneNode(true);
  const field = (name) => fragment.querySelector(`[data-field="${name}"]`);
  const article = fragment.querySelector(".bench");
  const entries = orderedEntries(bench);
  article.id = `bench-${bench.id}`;
  article.dataset.benchId = bench.id;
  article.dataset.manyModels = String(entries.length > 2);
  field("category").textContent = bench.category_label || bench.category_path.split("/").map(niceLabel).join(" / ");
  field("title-link").textContent = bench.title;
  field("title-link").href = `#bench-${encodeURIComponent(bench.id)}`;
  field("title-link").setAttribute("aria-label", `Link to ${bench.title}`);
  field("dimensions").textContent = formatDimensions(bench.dimensions_m);
  field("availability").textContent = `${entries.length} model ${entries.length === 1 ? "build" : "builds"} available`;
  field("reference").src = assetURL(bench.reference);
  field("reference").alt = `Shared reference image for ${bench.title}`;
  field("brief").textContent = bench.reference_asset_id;
  field("tiles").style.setProperty("--tile-count", entries.length + 1);
  entries.forEach((entry) => field("tiles").append(buildTile(entry, bench)));
  const details = field("details");
  const disclosure = fragment.querySelector(".bench-more");
  disclosure.addEventListener("toggle", () => {
    if (!disclosure.open || disclosure.dataset.loaded) return;
    entries.forEach((entry) => details.append(buildDetail(entry, bench)));
    disclosure.dataset.loaded = "true";
  });
  return fragment;
};
const matches = (bench) => {
  if (!hasSelectedModel(bench)) return false;
  if (elements.room.value && getRoom(bench) !== elements.room.value) return false;
  if (elements.category.value && bench.category_path !== elements.category.value) return false;
  if (elements.comparisonsOnly.checked && !bench.entries.some((entry) => modelID(entry).startsWith("claude-"))) return false;
  const term = elements.search.value.trim().toLowerCase();
  if (!term) return true;
  const haystack = [bench.title, bench.id, bench.category_label, bench.category_path, bench.reference_asset_id, ...bench.entries.map((entry) => `${entry.model} ${entry.asset_id}`)].join(" ").toLowerCase();
  return term.split(/\s+/).every((word) => haystack.includes(word));
};
const fillSelect = (select, items, first) => {
  const old = select.value;
  select.replaceChildren(new Option(first, ""));
  items.forEach(([value, label]) => select.append(new Option(label, value)));
  select.value = items.some(([value]) => value === old) ? old : "";
};
const fillCategories = () => {
  const available = state.benches.filter(hasSelectedModel);
  const rooms = [...new Set(available.map(getRoom))].sort();
  fillSelect(elements.room, rooms.map((room) => [room, niceLabel(room)]), "All rooms");
  const paths = [...new Set(available.filter((bench) => !elements.room.value || getRoom(bench) === elements.room.value).map((bench) => bench.category_path))].sort();
  fillSelect(elements.category, paths.map((path) => [path, elements.room.value ? niceLabel(path.split("/").slice(1).join("-")) : path.split("/").map(niceLabel).join(" / ")]), `All categories (${paths.length})`);
};
const updateURL = (mode = "replace", keepHash = false) => {
  if (mode === "none") return;
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("model", state.model);
  if (elements.search.value.trim()) url.searchParams.set("q", elements.search.value.trim());
  if (elements.room.value) url.searchParams.set("room", elements.room.value);
  if (elements.category.value) url.searchParams.set("category", elements.category.value);
  if (elements.comparisonsOnly.checked) url.searchParams.set("compare", "1");
  if (state.page > 1) url.searchParams.set("page", state.page);
  if (state.pageSize !== 12) url.searchParams.set("size", state.pageSize);
  if (!keepHash) url.hash = "";
  if (url.href !== location.href) history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
};
const render = (mode = "replace", keepHash = false) => {
  const found = state.benches.filter(matches);
  state.pageCount = Math.max(1, Math.ceil(found.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), state.pageCount);
  const offset = (state.page - 1) * state.pageSize;
  const shown = found.slice(offset, offset + state.pageSize);
  elements.list.replaceChildren();
  if (!found.length) {
    const empty = document.createElement("div"); empty.className = "bench-loading";
    const title = document.createElement("h3"); title.textContent = "No matching objects";
    const text = document.createElement("p"); text.textContent = "Try another name or ID, broaden the category, or reset the filters.";
    empty.append(title, text); elements.list.append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    shown.forEach((bench) => fragment.append(buildBench(bench)));
    elements.list.append(fragment);
  }
  elements.count.textContent = found.length ? `${formatCount(offset + 1)}–${formatCount(offset + shown.length)} of ${formatCount(found.length)} objects · available builds shown together` : "0 matching objects";
  elements.list.dataset.resultCount = found.length;
  elements.list.dataset.page = state.page;
  elements.list.dataset.model = state.model;
  elements.previous.disabled = elements.previousTop.disabled = state.page === 1;
  elements.next.disabled = elements.nextTop.disabled = state.page === state.pageCount;
  elements.page.replaceChildren(...Array.from({ length: state.pageCount }, (_, index) => new Option(String(index + 1), String(index + 1))));
  elements.page.value = String(state.page);
  elements.pageTop.textContent = `${state.page} / ${state.pageCount}`;
  elements.pageTotal.textContent = `of ${state.pageCount}`;
  elements.activeModel.textContent = state.model === "all" ? "All published runs" : `${selectedModel()?.name || state.model} selected`;
  elements.models.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.model === state.model)));
  elements.allModels.setAttribute("aria-pressed", String(state.model === "all"));
  updateURL(mode, keepHash);
};
const restoreURL = () => {
  const params = new URL(location.href).searchParams;
  const requested = params.get("model") || defaultModel();
  state.model = requested === "all" ? "all" : state.models.find((model) => model.id === slug(requested))?.id || defaultModel();
  state.page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);
  state.pageSize = params.get("size") === "24" ? 24 : 12;
  elements.pageSize.value = String(state.pageSize);
  elements.search.value = params.get("q") || "";
  elements.comparisonsOnly.checked = params.get("compare") === "1";
  elements.room.value = ""; elements.category.value = "";
  fillCategories();
  const requestedRoom = params.get("room") || "";
  elements.room.value = requestedRoom;
  if (elements.room.selectedIndex < 0) elements.room.value = "";
  fillCategories();
  elements.category.value = params.get("category") || "";
  if (elements.category.selectedIndex < 0) elements.category.value = "";
};
const openFromHash = () => {
  if (!location.hash.startsWith("#bench-")) return;
  let id;
  try { id = decodeURIComponent(location.hash.slice(7)); } catch { return; }
  const target = state.benches.find((bench) => bench.id === id);
  if (!target) return;
  if (!matches(target)) {
    if (!hasSelectedModel(target)) state.model = "all";
    elements.search.value = ""; elements.room.value = ""; elements.category.value = ""; elements.comparisonsOnly.checked = false; fillCategories();
  }
  const index = state.benches.filter(matches).findIndex((bench) => bench.id === id);
  state.page = Math.floor(index / state.pageSize) + 1;
  render("replace", true);
  requestAnimationFrame(() => document.getElementById(`bench-${id}`)?.scrollIntoView({ block: "start" }));
};
const resetPaging = () => { state.page = 1; render("push"); };
const setModel = (id) => { state.model = id; fillCategories(); state.page = 1; render("push"); };
let searchTimer;
elements.search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(resetPaging, 160); });
$("#bench-filter-form").addEventListener("submit", (event) => { event.preventDefault(); clearTimeout(searchTimer); resetPaging(); });
elements.room.addEventListener("change", () => { elements.category.value = ""; fillCategories(); resetPaging(); });
elements.category.addEventListener("change", resetPaging);
elements.comparisonsOnly.addEventListener("change", resetPaging);
elements.pageSize.addEventListener("change", () => { state.pageSize = Number(elements.pageSize.value); resetPaging(); });
elements.allModels.addEventListener("click", () => setModel("all"));
elements.clear.addEventListener("click", () => {
  clearTimeout(searchTimer); state.model = defaultModel(); state.pageSize = 12; elements.pageSize.value = "12"; elements.search.value = ""; elements.room.value = ""; elements.category.value = ""; elements.comparisonsOnly.checked = false; fillCategories(); resetPaging();
});
const changePage = (page) => { state.page = page; render("push"); $("#bench-browser").scrollIntoView({ block: "start" }); };
[elements.previous, elements.previousTop].forEach((button) => button.addEventListener("click", () => changePage(state.page - 1)));
[elements.next, elements.nextTop].forEach((button) => button.addEventListener("click", () => changePage(state.page + 1)));
elements.page.addEventListener("change", () => changePage(Number(elements.page.value)));
const renderCoverage = () => {
  const models = new Map();
  state.benches.forEach((bench) => bench.entries.forEach((entry) => {
    const id = modelID(entry);
    if (!models.has(id)) models.set(id, { id, name: entry.model, builds: 0, comparisons: new Set(), categories: new Set() });
    const model = models.get(id); model.builds += 1; model.comparisons.add(bench.id); model.categories.add(bench.category_path);
  }));
  const order = ["gpt-6-astra", "gpt-5-6-sol", "claude-opus-5", "claude-fable-5"];
  state.models = [...models.values()].sort((a, b) => (order.indexOf(a.id) < 0 ? 99 : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? 99 : order.indexOf(b.id)) || a.name.localeCompare(b.name));
  const setStat = (key, value) => document.querySelectorAll(`[data-stat="${key}"]`).forEach((node) => { node.textContent = formatCount(value); });
  setStat("benches", state.benches.length);
  setStat("builds", state.models.reduce((total, model) => total + model.builds, 0));
  const astra = models.get("gpt-6-astra");
  if (astra) { setStat("astra-builds", astra.builds); setStat("astra-categories", astra.categories.size); }
  elements.models.replaceChildren();
  state.models.forEach((model) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "model-option"; button.dataset.model = model.id; button.setAttribute("aria-pressed", "false");
    const name = document.createElement("span"); name.className = "model-option-name"; name.textContent = model.name;
    const count = document.createElement("span"); count.className = "model-option-count"; count.textContent = formatCount(model.comparisons.size);
    const note = document.createElement("span"); note.className = "model-option-note"; note.textContent = `objects · ${model.categories.size} ${model.categories.size === 1 ? "category" : "categories"}`;
    button.append(name, count, note); button.addEventListener("click", () => setModel(model.id)); elements.models.append(button);
  });
};
const renderRunContext = (data) => {
  const run = data.run_context?.["gpt-6-astra"];
  if (!run) return;
  const duration = (minutes) => { const rounded = Math.round(minutes); return `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, "0")}m`; };
  if (Number.isFinite(run.timing?.initial_production_minutes)) $('[data-run="first-pass"]').textContent = duration(run.timing.initial_production_minutes);
  if (Number.isFinite(run.timing?.wall_hours_through_final_verification)) $('[data-run="elapsed"]').textContent = duration(run.timing.wall_hours_through_final_verification * 60);
  if (Number.isFinite(run.gpu?.initial_mean_percent)) $('[data-run="gpu"]').textContent = `${run.gpu.initial_mean_percent.toFixed(1)}%`;
  [[run.report_markdown, "Astra run report ↗"], [run.report, "Run data (JSON) ↗"], [run.timeline, "GPU timeline ↗"]].forEach(([path, label]) => {
    if (!path) return;
    const link = document.createElement("a"); link.href = assetURL(path); link.textContent = label; $("#bench-run-links").append(link);
  });
};
const init = async () => {
  try {
    const response = await fetch("./benchmarks.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`benchmarks.json ${response.status}`);
    const data = await response.json();
    state.benches = (data.benches || []).filter((bench) => Array.isArray(bench.entries) && bench.entries.length);
    if (!state.benches.length) throw new Error("No published comparisons are available.");
    renderCoverage(); renderRunContext(data); restoreURL(); state.ready = true; render("replace", true); openFromHash();
    document.body.dataset.benchmarkState = "ready";
    window.addEventListener("popstate", () => { clearTimeout(searchTimer); restoreURL(); render("none", true); openFromHash(); });
    window.addEventListener("hashchange", openFromHash);
  } catch (error) {
    console.error("Benchmark data could not be loaded:", error);
    elements.count.textContent = "Benchmark data unavailable";
    elements.list.replaceChildren();
    const message = document.createElement("p"); message.className = "bench-loading"; message.textContent = "The benchmark data could not be loaded. Reload the page to try again."; elements.list.append(message);
    document.body.dataset.benchmarkState = "error";
  }
};
init();
