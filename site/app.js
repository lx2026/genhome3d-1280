const state = {
  dataset: null,
  filtered: [],
  visible: 24,
};

const elements = {
  grid: document.querySelector("#asset-grid"),
  template: document.querySelector("#asset-card-template"),
  search: document.querySelector("#search"),
  category: document.querySelector("#category-filter"),
  resultCount: document.querySelector("#result-count"),
  shownCount: document.querySelector("#shown-count"),
  loadMore: document.querySelector("#load-more"),
};

const formatBytes = (bytes) => {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
};

const searchableText = (asset) =>
  [asset.id, asset.title, asset.category_path, ...(asset.tags || [])]
    .join(" ")
    .toLocaleLowerCase();

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
    const link = card.querySelector(".asset-image");
    const image = card.querySelector("img");
    link.href = asset.download_url;
    link.setAttribute("download", `${asset.slug}.usdz`);
    link.setAttribute("aria-label", `Download ${asset.title} as USDZ`);
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

initialize();
