const state = {
  dataset: null,
  filtered: [],
  visible: 24,
  viewer: null,
  viewerLoad: 0,
};

const elements = {
  grid: document.querySelector("#asset-grid"),
  template: document.querySelector("#asset-card-template"),
  search: document.querySelector("#search"),
  category: document.querySelector("#category-filter"),
  resultCount: document.querySelector("#result-count"),
  shownCount: document.querySelector("#shown-count"),
  loadMore: document.querySelector("#load-more"),
  viewerDialog: document.querySelector("#asset-viewer"),
  viewerStage: document.querySelector("#viewer-stage"),
  viewerCanvas: document.querySelector("#viewer-canvas"),
  viewerTitle: document.querySelector("#viewer-title"),
  viewerPoster: document.querySelector("#viewer-poster"),
  viewerStatus: document.querySelector("#viewer-status"),
  viewerStatusTitle: document.querySelector("#viewer-status-title"),
  viewerStatusDetail: document.querySelector("#viewer-status-detail"),
  viewerMeta: document.querySelector("#viewer-meta"),
  viewerDownload: document.querySelector("#viewer-download"),
  viewerClose: document.querySelector("#viewer-close"),
  viewerReset: document.querySelector("#viewer-reset"),
};

let viewerModulePromise;

const formatBytes = (bytes) => {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
};

const searchableText = (asset) =>
  [asset.id, asset.title, asset.category_path, ...(asset.tags || [])]
    .join(" ")
    .toLocaleLowerCase();

const formatDimensions = ({ width, depth, height }) =>
  `${width.toFixed(2)} × ${depth.toFixed(2)} × ${height.toFixed(2)} m`;

function setViewerStatus(title, detail, stateName = "loading") {
  elements.viewerDialog.dataset.state = stateName;
  elements.viewerStatus.hidden = false;
  elements.viewerStatusTitle.textContent = title;
  elements.viewerStatusDetail.textContent = detail;
}

function closeViewer() {
  if (elements.viewerDialog.open) elements.viewerDialog.close();
}

async function openViewer(asset) {
  const loadId = ++state.viewerLoad;
  elements.viewerTitle.textContent = asset.title;
  elements.viewerMeta.textContent = `${asset.id} · ${formatDimensions(
    asset.dimensions_m,
  )} · ${formatBytes(asset.file_size_bytes)}`;
  elements.viewerPoster.src = `./${asset.preview}`;
  elements.viewerPoster.alt = `${asset.title} preview while its 3D model loads`;
  elements.viewerPoster.hidden = false;
  elements.viewerDownload.href = asset.download_url;
  elements.viewerDownload.download = `${asset.slug}.usdz`;
  elements.viewerDownload.setAttribute("aria-label", `Download ${asset.title} as USDZ`);
  setViewerStatus("Loading 3D preview", `Downloading ${formatBytes(asset.file_size_bytes)}`);

  if (!elements.viewerDialog.open) elements.viewerDialog.showModal();
  document.body.classList.add("viewer-open");

  try {
    viewerModulePromise ||= import("./viewer.js");
    const { AssetViewer } = await viewerModulePromise;
    if (loadId !== state.viewerLoad || !elements.viewerDialog.open) return;

    state.viewer ||= new AssetViewer({
      canvas: elements.viewerCanvas,
      container: elements.viewerStage,
    });

    const loaded = await state.viewer.load(asset.download_url, (received, total) => {
      if (loadId !== state.viewerLoad) return;
      const progress = total
        ? `${Math.round((received / total) * 100)}%`
        : formatBytes(received);
      elements.viewerStatusDetail.textContent = `${progress} · ${formatBytes(
        asset.file_size_bytes,
      )}`;
    });

    if (!loaded || loadId !== state.viewerLoad || !elements.viewerDialog.open) return;
    elements.viewerPoster.hidden = true;
    elements.viewerStatus.hidden = true;
    elements.viewerDialog.dataset.state = "ready";
  } catch (error) {
    if (loadId !== state.viewerLoad) return;
    console.warn("Interactive USDZ preview unavailable:", error);
    setViewerStatus(
      "Preview unavailable",
      "This USDZ can still be downloaded and opened with Apple Quick Look.",
      "error",
    );
  }
}

function populateShowcase(assets) {
  const preferred = ["ARM-0001", "PND-0010", "MXB-0014"];
  const showcase = preferred
    .map((id) => assets.find((asset) => asset.id === id))
    .filter(Boolean);
  if (showcase.length < 3) showcase.push(...assets.slice(0, 3 - showcase.length));

  document.querySelectorAll("[data-showcase]").forEach((tile, index) => {
    const asset = showcase[index];
    if (!asset) return;
    tile.querySelector(".tile-image").style.backgroundImage = `url('./${asset.preview}')`;
    tile.querySelector("strong").textContent = asset.title;
    tile.querySelector("small").textContent = asset.id;
  });
}

function populateFilters(dataset) {
  dataset.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.path;
    option.textContent = `${category.label} · ${category.count}`;
    elements.category.append(option);
  });
}

function renderCards() {
  elements.grid.replaceChildren();
  const fragment = document.createDocumentFragment();
  const visibleAssets = state.filtered.slice(0, state.visible);

  visibleAssets.forEach((asset, index) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    const image = card.querySelector("img");
    const download = card.querySelector(".asset-download");
    const view = card.querySelector(".asset-view");
    download.href = asset.download_url;
    download.download = `${asset.slug}.usdz`;
    download.setAttribute("aria-label", `Download ${asset.title} as USDZ`);
    view.setAttribute("aria-label", `View ${asset.title} in interactive 3D`);
    view.addEventListener("click", () => openViewer(asset));
    image.src = `./${asset.preview}`;
    image.alt = `${asset.title} 3D asset preview`;
    if (index < 8) image.loading = "eager";
    card.querySelector(".asset-category").textContent = asset.category_label;
    card.querySelector("h3").textContent = asset.title;
    card.querySelector(".asset-id").textContent = asset.id;
    card.querySelector(".asset-size").textContent = formatBytes(asset.file_size_bytes);
    fragment.append(card);
  });

  if (state.filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No objects match that search. Try a material, category, or asset ID.";
    fragment.append(empty);
  }

  elements.grid.append(fragment);
  elements.resultCount.textContent = state.filtered.length.toLocaleString();
  elements.shownCount.textContent = `Showing ${Math.min(
    visibleAssets.length,
    state.filtered.length,
  ).toLocaleString()} of ${state.filtered.length.toLocaleString()} objects`;
  elements.loadMore.hidden = visibleAssets.length >= state.filtered.length;
}

function applyFilters() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const category = elements.category.value;
  state.filtered = state.dataset.assets.filter((asset) => {
    const matchesQuery = !query || searchableText(asset).includes(query);
    const matchesCategory = category === "all" || asset.category_path === category;
    return matchesQuery && matchesCategory;
  });
  state.visible = 24;
  renderCards();
}

async function initialize() {
  try {
    const response = await fetch("./catalog.json");
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    state.dataset = await response.json();
    state.dataset.assets.sort((a, b) => {
      const sequenceA = Number(a.id.split("-").at(-1));
      const sequenceB = Number(b.id.split("-").at(-1));
      return sequenceA - sequenceB || a.category_path.localeCompare(b.category_path);
    });
    state.filtered = state.dataset.assets;

    document.querySelector('[data-stat="assets"]').textContent =
      state.dataset.asset_count.toLocaleString();
    document.querySelector('[data-stat="categories"]').textContent =
      state.dataset.category_count.toLocaleString();
    populateFilters(state.dataset);
    populateShowcase(state.dataset.assets);
    renderCards();
  } catch (error) {
    console.error(error);
    elements.grid.innerHTML =
      '<p class="empty-state">The catalog could not be loaded. Please visit the GitHub repository for direct access.</p>';
    elements.loadMore.hidden = true;
  }
}

elements.search.addEventListener("input", applyFilters);
elements.category.addEventListener("change", applyFilters);
elements.loadMore.addEventListener("click", () => {
  state.visible += 24;
  renderCards();
});
elements.viewerClose.addEventListener("click", closeViewer);
elements.viewerReset.addEventListener("click", () => state.viewer?.reset());
elements.viewerDialog.addEventListener("click", (event) => {
  if (event.target === elements.viewerDialog) closeViewer();
});
elements.viewerDialog.addEventListener("close", () => {
  state.viewerLoad += 1;
  state.viewer?.cancel();
  elements.viewerPoster.hidden = false;
  document.body.classList.remove("viewer-open");
});

initialize();
