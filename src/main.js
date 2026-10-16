import { fetchMovieDetails } from "./api.js";
import { discoverCatalog, searchCatalog } from "./tmdb.js";
import * as state from "./state.js";
import { initializeTheme } from "./theme.js";
import { addEmptyAction, clearResults, renderMovies, renderPagination, renderDetails, setHeading, setLoading, setMeta, showEmpty } from "./ui.js";

const form = document.getElementById("movieSearchForm");
const searchInput = document.getElementById("movieSearchInput");
const yearInput = document.getElementById("yearFilter");
const sortSelect = document.getElementById("sortSelect");
const favoriteCount = document.getElementById("favoriteCount");
const navLinks = [...document.querySelectorAll("[data-view]")];
const typeTabs = [...document.querySelectorAll("[data-type]")];
let activeView = "search";
let requestNumber = 0;
let currentDetails = null;
let catalogMode = true;
let catalogType = "";

function sorted(movies) {
  const { sort } = state.getFilters();
  const copy = [...movies];
  if (sort === "newest") return copy.sort((a, b) => parseInt(b.Year, 10) - parseInt(a.Year, 10));
  if (sort === "oldest") return copy.sort((a, b) => parseInt(a.Year, 10) - parseInt(b.Year, 10));
  if (sort === "title") return copy.sort((a, b) => a.Title.localeCompare(b.Title));
  return copy;
}

function refreshFavoriteCount() {
  favoriteCount.textContent = String(state.getFavorites().length);
}

function renderSearchResults() {
  catalogMode = false;
  const movies = sorted(state.getMovies());
  setHeading(`Results for “${state.getQuery()}”`);
  setMeta(`${state.getTotalResults().toLocaleString("en-US")} results`);
  renderMovies(movies, { isFavorite: state.isFavorite, onFavorite: handleFavorite, onDetails: showDetails });
  renderPagination({ page: state.getPage(), totalResults: state.getTotalResults(), pageSize: 20, onPage: (page) => loadMovies(state.getQuery(), page) });
}

function renderCatalogResults() {
  catalogMode = true;
  const typeName = catalogType === "series" ? "TV Shows" : catalogType === "movie" ? "Movies" : "Trending today";
  setHeading(typeName, "NOW SHOWING");
  setMeta(`${state.getTotalResults().toLocaleString("en-US")} TMDB results`);
  renderMovies(sorted(state.getMovies()), { isFavorite: state.isFavorite, onFavorite: handleFavorite, onDetails: showDetails });
  renderPagination({ page: state.getPage(), totalResults: state.getTotalResults(), pageSize: 20, onPage: (page) => loadCatalog(catalogType, page) });
}

async function loadCatalog(type = "", page = 1) {
  const currentRequest = ++requestNumber;
  currentDetails = null;
  catalogType = type;
  catalogMode = true;
  state.setQuery("");
  setLoading(true);
  clearResults();
  try {
    const data = await discoverCatalog({ type, page, year: state.getFilters().year, sort: state.getFilters().sort });
    if (currentRequest !== requestNumber) return;
    state.setMovies(data.results);
    state.setPage(data.page);
    state.setTotalResults(data.totalResults);
    currentDetails = null;
    activeView = "search";
    syncNavigation();
    renderCatalogResults();
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    state.setMovies([]);
    setHeading(type === "series" ? "TV Shows" : type === "movie" ? "Movies" : "Trending today", "TMDB CATALOG");
    showEmpty("Could not load the catalog", error.message, "!", true);
  } finally {
    if (currentRequest === requestNumber) setLoading(false);
  }
}

function renderCurrentResults() {
  if (activeView === "favorites") renderFavorites();
  else if (catalogMode) renderCatalogResults();
  else renderSearchResults();
}

async function loadMovies(title, page = 1) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    loadCatalog(state.getFilters().type, 1);
    return;
  }
  const currentRequest = ++requestNumber;
  const filters = state.getFilters();
  currentDetails = null;
  catalogMode = false;
  setLoading(true);
  clearResults();
  try {
    const data = await searchCatalog({ title: normalizedTitle, page, type: filters.type, year: filters.year });
    if (currentRequest !== requestNumber) return;
    state.setMovies(data.results);
    state.setQuery(normalizedTitle);
    state.setPage(page);
    state.setTotalResults(data.totalResults);
    activeView = "search";
    syncNavigation();
    renderSearchResults();
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    state.setQuery(normalizedTitle);
    state.setMovies([]);
    setHeading("Search failed", "SEARCH RESULTS");
    showEmpty("Check your search", error.message, "⌕", true);
  } finally {
    if (currentRequest === requestNumber) setLoading(false);
  }
}

async function showDetails(id) {
  const requestId = ++requestNumber;
  currentDetails = null;
  setLoading(true);
  clearResults();
  try {
    currentDetails = await fetchMovieDetails(id);
    if (requestId !== requestNumber) return;
    history.pushState({ ...(history.state || {}), view: "movie-details", movieId: id }, "", `#film=${encodeURIComponent(id)}`);
    renderDetails(currentDetails, {
      onBack: handleBackToResults,
      backLabel: activeView === "favorites" ? "← Back to watchlist" : catalogMode ? "← Back to catalog" : "← Back to results",
      onFavorite: handleFavorite,
      isFavorite: state.isFavorite,
    });
  } catch (error) {
    if (requestId === requestNumber) {
      showEmpty("Could not load details", error.message, "!", true);
      addEmptyAction("← Back to results", renderCurrentResults);
    }
  } finally {
    if (requestId === requestNumber) setLoading(false);
  }
}

function handleFavorite(movie) {
  state.toggleFavorite(movie);
  refreshFavoriteCount();
  if (currentDetails?.imdbID === movie.imdbID) renderDetails(currentDetails, {
    onBack: handleBackToResults,
    backLabel: activeView === "favorites" ? "← Back to watchlist" : catalogMode ? "← Back to catalog" : "← Back to results",
    onFavorite: handleFavorite,
    isFavorite: state.isFavorite,
  });
  else renderCurrentResults();
}

function handleBackToResults() {
  if (currentDetails && history.state?.view === "movie-details") history.back();
  else {
    currentDetails = null;
    renderCurrentResults();
  }
}

window.addEventListener("popstate", () => {
  if (!currentDetails) return;
  currentDetails = null;
  renderCurrentResults();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && currentDetails) handleBackToResults();
});

function renderFavorites() {
  currentDetails = null;
  setHeading("Watchlist", "YOUR COLLECTION");
  const favorites = state.getFavorites();
  setMeta(`${favorites.length} ${favorites.length === 1 ? "title" : "titles"}`);
  if (!favorites.length) {
    showEmpty("Your watchlist is empty", "Tap the heart on any title to save it here.", "♡");
    return;
  }
  renderMovies(favorites, { isFavorite: state.isFavorite, onFavorite: handleFavorite, onDetails: showDetails });
}

function syncNavigation() {
  navLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.view === activeView));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  activeView = "search";
  loadMovies(searchInput.value, 1);
});

typeTabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    typeTabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    state.setFilters({ type: tab.dataset.type });
    if (searchInput.value.trim()) loadMovies(searchInput.value, 1);
    else loadCatalog(tab.dataset.type, 1);
  }),
);

yearInput.addEventListener("change", () => {
  const year = yearInput.value.trim();
  if (year && (Number(year) < 1888 || Number(year) > Number(yearInput.max))) {
    yearInput.setCustomValidity(`Enter a year between 1888 and ${yearInput.max}`);
    yearInput.reportValidity();
    return;
  }
  yearInput.setCustomValidity("");
  state.setFilters({ year });
  if (activeView === "favorites") renderFavorites();
  else if (searchInput.value.trim()) loadMovies(searchInput.value, 1);
  else loadCatalog(catalogType, 1);
});

sortSelect.addEventListener("change", () => {
  state.setFilters({ sort: sortSelect.value });
  if (activeView === "favorites") renderFavorites();
  else if (searchInput.value.trim()) loadMovies(searchInput.value, 1);
  else loadCatalog(catalogType, 1);
});

navLinks.forEach((link) =>
  link.addEventListener("click", () => {
    activeView = link.dataset.view;
    syncNavigation();
    if (activeView === "favorites") renderFavorites();
    else if (searchInput.value.trim()) loadMovies(searchInput.value, 1);
    else loadCatalog(catalogType, 1);
  }),
);

// Restore preferences, but always start with an empty search field.
function initialize() {
  initializeTheme();
  refreshFavoriteCount();
  const filters = state.getFilters();
  const currentYear = new Date().getFullYear();
  yearInput.max = String(currentYear);
  if (filters.year && Number(filters.year) > currentYear) state.setFilters({ year: "" });
  yearInput.value = state.getFilters().year || "";
  sortSelect.value = filters.sort || "relevance";
  typeTabs.forEach((tab) => {
    const selected = tab.dataset.type === filters.type;
    tab.classList.toggle("is-selected", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
  searchInput.value = "";
  catalogType = filters.type || "";
  loadCatalog(catalogType);
}

initialize();
