const ASSET_PARAM = "asset";

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
  dataset: null,
  filtered: [],
  visible: 24,
  viewer: null,
  viewerLoad: 0,
  currentAsset: null,
  viewerBackground: readBackgroundPreference(),
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
  viewerReference: document.querySelector("#viewer-reference"),
  viewerStatus: document.querySelector("#viewer-status"),
  viewerStatusTitle: document.querySelector("#viewer-status-title"),
  viewerStatusDetail: document.querySelector("#viewer-status-detail"),
  viewerMeta: document.querySelector("#viewer-meta"),
  viewerDownload: document.querySelector("#viewer-download"),
  viewerClose: document.querySelector("#viewer-close"),
  viewerReset: document.querySelector("#viewer-reset"),
  viewerBackground: document.querySelector("#viewer-background"),
  viewerCopyLink: document.querySelector("#viewer-copy-link"),
  viewerKicker: document.querySelector("#viewer-kicker"),
  featuredOpen: document.querySelector("#featured-open"),
  featuredReference: document.querySelector("#featured-reference"),
  featuredPreview: document.querySelector("#featured-preview"),
  featuredId: document.querySelector("#featured-id"),
  featuredTitle: document.querySelector("#featured-title"),
};

let viewerModulePromise;
let copyLabelReset;

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

const assetIdFromLocation = () =>
  new URL(window.location.href).searchParams.get(ASSET_PARAM)?.toUpperCase() || null;

const findAsset = (assetId) =>
  state.dataset?.assets.find((asset) => asset.id === assetId) || null;

const urlForAsset = (asset) => {
  const url = new URL(window.location.href);
  url.searchParams.set(ASSET_PARAM, asset.id);
  url.hash = "";
  return url;
};

function setViewerStatus(title, detail, stateName = "loading") {
  elements.viewerDialog.dataset.state = stateName;
  elements.viewerStatus.hidden = false;
  elements.viewerStatusTitle.textContent = title;
  elements.viewerStatusDetail.textContent = detail;
}

function updateBackgroundControl() {
  const dark = state.viewerBackground === "dark";
  elements.viewerDialog.dataset.background = state.viewerBackground;
  elements.viewerBackground.textContent = dark ? "Light background" : "Dark background";
  elements.viewerBackground.setAttribute("aria-pressed", String(dark));
  state.viewer?.setBackground(state.viewerBackground);
}

function hideViewer() {
  if (elements.viewerDialog.open) elements.viewerDialog.close();
}

function requestCloseViewer() {
  if (history.state?.assetRoute) {
    history.back();
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete(ASSET_PARAM);
  history.replaceState({ ...(history.state || {}), assetRoute: false }, "", url);
  hideViewer();
}

function navigateToAsset(asset) {
  history.pushState(
    { ...(history.state || {}), assetRoute: true },
    "",
    urlForAsset(asset),
  );
  void openViewer(asset);
}

async function openViewer(asset) {
  const loadId = ++state.viewerLoad;
  state.currentAsset = asset;
  elements.viewerTitle.textContent = asset.title;
  elements.viewerKicker.textContent = `${asset.id} · ${asset.category_label}`;
  elements.viewerMeta.textContent = `${asset.id} · ${formatDimensions(
    asset.dimensions_m,
  )} · ${formatBytes(asset.file_size_bytes)}`;
  elements.viewerPoster.src = `./${asset.preview}`;
  elements.viewerPoster.alt = `${asset.title} preview while its 3D model loads`;
  elements.viewerPoster.hidden = false;
  elements.viewerReference.src = `./${asset.reference}`;
  elements.viewerReference.alt = `Original AI reference used to construct ${asset.title}`;
  elements.viewerDownload.href = asset.download_url;
  elements.viewerDownload.download = `${asset.slug}.usdz`;
  elements.viewerDownload.setAttribute("aria-label", `Download ${asset.title} as USDZ`);
  elements.viewerCopyLink.textContent = "Copy object link";
  updateBackgroundControl();
  setViewerStatus("Loading 3D result", `Downloading ${formatBytes(asset.file_size_bytes)}`);

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
    state.viewer.setBackground(state.viewerBackground);

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

function populateFeatured(assets) {
  const asset = assets.find((item) => item.id === "DRS-0002") || assets[0];
  if (!asset) return;

  elements.featuredReference.src = `./${asset.reference}`;
  elements.featuredReference.alt = `${asset.title} reference image`;
  elements.featuredPreview.src = `./${asset.preview}`;
  elements.featuredPreview.alt = `${asset.title} generated 3D result`;
  elements.featuredId.textContent = `${asset.id} · ${asset.category_label}`;
  elements.featuredTitle.textContent = asset.title;
  elements.featuredOpen.setAttribute(
    "aria-label",
    `Open the interactive comparison for ${asset.title}`,
  );
  elements.featuredOpen.addEventListener("click", () => navigateToAsset(asset));
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
    const reference = card.querySelector(".asset-reference");
    const preview = card.querySelector(".asset-preview");
    const download = card.querySelector(".asset-download");
    const view = card.querySelector(".asset-view");
    download.href = asset.download_url;
    download.download = `${asset.slug}.usdz`;
    download.setAttribute("aria-label", `Download ${asset.title} as USDZ`);
    view.setAttribute(
      "aria-label",
      `Compare the original AI reference and interactive 3D result for ${asset.title}`,
    );
    view.addEventListener("click", () => navigateToAsset(asset));
    reference.src = `./${asset.reference}`;
    reference.alt = `${asset.title} reference image`;
    preview.src = `./${asset.preview}`;
    preview.alt = `${asset.title} generated 3D preview`;
    if (index < 6) {
      reference.loading = "eager";
      preview.loading = "eager";
    }
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

async function copyObjectLink() {
  if (!state.currentAsset) return;
  const objectUrl = urlForAsset(state.currentAsset).toString();

  try {
    await navigator.clipboard.writeText(objectUrl);
    elements.viewerCopyLink.textContent = "Link copied";
  } catch {
    elements.viewerCopyLink.textContent = "Copy failed";
  }

  window.clearTimeout(copyLabelReset);
  copyLabelReset = window.setTimeout(() => {
    elements.viewerCopyLink.textContent = "Copy object link";
  }, 1600);
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
    populateFeatured(state.dataset.assets);
    renderCards();
    updateBackgroundControl();

    const requestedAsset = findAsset(assetIdFromLocation());
    if (requestedAsset) {
      history.replaceState(
        { ...(history.state || {}), assetRoute: false },
        "",
        window.location.href,
      );
      void openViewer(requestedAsset);
    }
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
elements.viewerClose.addEventListener("click", requestCloseViewer);
elements.viewerReset.addEventListener("click", () => state.viewer?.reset());
elements.viewerBackground.addEventListener("click", () => {
  state.viewerBackground = state.viewerBackground === "light" ? "dark" : "light";
  try {
    localStorage.setItem("genhome3d-viewer-background", state.viewerBackground);
  } catch {
    // The preference is optional when storage is unavailable.
  }
  updateBackgroundControl();
});
elements.viewerCopyLink.addEventListener("click", copyObjectLink);
elements.viewerDialog.addEventListener("click", (event) => {
  if (event.target === elements.viewerDialog) requestCloseViewer();
});
elements.viewerDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  requestCloseViewer();
});
elements.viewerDialog.addEventListener("close", () => {
  state.viewerLoad += 1;
  state.viewer?.cancel();
  state.currentAsset = null;
  elements.viewerPoster.hidden = false;
  elements.viewerReference.removeAttribute("src");
  document.body.classList.remove("viewer-open");
});

window.addEventListener("popstate", () => {
  const requestedAsset = findAsset(assetIdFromLocation());
  if (requestedAsset) {
    void openViewer(requestedAsset);
  } else {
    hideViewer();
  }
});

initialize();
