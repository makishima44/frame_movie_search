import * as state from "./state.js";
import { discoverCatalog, fetchGenres, searchCatalog } from "./tmdb.js";
import {
  clearResults,
  renderMovies,
  renderPagination,
  renderLoadingSkeletons,
  setHeading,
  setLoading,
  setMeta,
  showEmpty,
} from "./ui.js";

/** Управляет каталогом, поиском, фильтрами и списком избранного. */
export function createCatalogController({ onDetails, onFavorite, resetDetails, nextRequest, isCurrentRequest }) {
  const form = document.getElementById("movieSearchForm");
  const searchInput = document.getElementById("movieSearchInput");
  const yearInput = document.getElementById("yearFilter");
  const sortSelect = document.getElementById("sortSelect");
  const genreSelect = document.getElementById("genreFilter");
  const ratingSelect = document.getElementById("ratingFilter");
  const languageSelect = document.getElementById("languageFilter");
  const runtimeSelect = document.getElementById("runtimeFilter");
  const advancedFilterHint = document.getElementById("advancedFilterHint");
  const clearFiltersButton = document.getElementById("clearAdvancedFilters");
  const clearAllButton = document.getElementById("clearAllButton");
  const favoriteCount = document.getElementById("favoriteCount");
  const navLinks = [...document.querySelectorAll("[data-view]")];
  const typeTabs = [...document.querySelectorAll("[data-type]")];

  let activeView = "search";
  let catalogMode = true;
  let catalogType = "";
  let genreRequestNumber = 0;
  let hasLoadedResults = false;

  /** Сортирует загруженную страницу по выбранному правилу. */
  function sortTitles(titles) {
    const { sort } = state.getFilters();
    const copy = [...titles];
    if (sort === "newest") return copy.sort((a, b) => parseInt(b.Year, 10) - parseInt(a.Year, 10));
    if (sort === "oldest") return copy.sort((a, b) => parseInt(a.Year, 10) - parseInt(b.Year, 10));
    if (sort === "title") return copy.sort((a, b) => a.Title.localeCompare(b.Title));
    return copy;
  }

  /** Синхронизирует число избранных названий с пунктом меню. */
  function refreshFavoriteCount() {
    favoriteCount.textContent = String(state.getFavorites().length);
  }

  /** Обновляет список, заголовок и страницы результатов текстового поиска. */
  function renderSearchResults() {
    catalogMode = false;
    const titles = sortTitles(state.getMovies());
    const filters = state.getFilters();
    const hasClientSideFilters = Boolean(filters.genre || filters.rating || filters.language);
    setHeading(`Results for “${state.getQuery()}”`);
    setMeta(hasClientSideFilters
      ? `${titles.length} matches on this page · ${state.getTotalResults().toLocaleString("en-US")} total search results`
      : `${state.getTotalResults().toLocaleString("en-US")} results`);
    renderMovies(titles, { isFavorite: state.isFavorite, onFavorite, onDetails });
    renderPagination({
      page: state.getPage(),
      totalResults: state.getTotalResults(),
      pageSize: 20,
      onPage: (page) => loadMovies(state.getQuery(), page),
    });
  }

  /** Обновляет список, заголовок и страницы каталога. */
  function renderCatalogResults() {
    catalogMode = true;
    const typeName = catalogType === "series" ? "TV Shows" : catalogType === "movie" ? "Movies" : "Trending today";
    setHeading(typeName, "NOW SHOWING");
    setMeta(`${state.getTotalResults().toLocaleString("en-US")} TMDB results`);
    renderMovies(sortTitles(state.getMovies()), { isFavorite: state.isFavorite, onFavorite, onDetails });
    renderPagination({
      page: state.getPage(),
      totalResults: state.getTotalResults(),
      pageSize: 20,
      onPage: (page) => loadCatalog(catalogType, page),
    });
  }

  /** Загружает каталог. Запросы с устаревшими ответами игнорируются. */
  async function loadCatalog(type = "", page = 1) {
    resetDetails();
    const requestId = nextRequest();
    catalogType = type;
    catalogMode = true;
    state.setQuery("");
    setLoading(true);
    clearResults();
    renderLoadingSkeletons();
    try {
      const data = await discoverCatalog({ ...state.getFilters(), type, page });
      if (!isCurrentRequest(requestId)) return;
      state.setMovies(data.results);
      state.setPage(data.page);
      state.setTotalResults(data.totalResults);
      hasLoadedResults = true;
      activeView = "search";
      syncNavigation();
      renderCatalogResults();
    } catch (error) {
      if (!isCurrentRequest(requestId)) return;
      state.setMovies([]);
      hasLoadedResults = true;
      setHeading(type === "series" ? "TV Shows" : type === "movie" ? "Movies" : "Trending today", "TMDB CATALOG");
      showEmpty("Could not load the catalog", error.message, "!", true);
    } finally {
      if (isCurrentRequest(requestId)) setLoading(false);
    }
  }

  /** Перерисовывает текущую вкладку после закрытия карточки или изменения избранного. */
  function renderCurrentResults() {
    if (activeView === "favorites") renderFavorites();
    else if (!hasLoadedResults) loadCatalog(catalogType, 1);
    else if (catalogMode) renderCatalogResults();
    else renderSearchResults();
  }

  /** Ищет название; пустой запрос возвращает пользователя в каталог. */
  async function loadMovies(title, page = 1) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      loadCatalog(state.getFilters().type, 1);
      return;
    }

    resetDetails();
    const requestId = nextRequest();
    const filters = state.getFilters();
    catalogMode = false;
    setLoading(true);
    clearResults();
    renderLoadingSkeletons();
    try {
      const data = await searchCatalog({ title: normalizedTitle, page, ...filters });
      if (!isCurrentRequest(requestId)) return;
      state.setMovies(data.results);
      state.setQuery(normalizedTitle);
      state.setPage(page);
      state.setTotalResults(data.totalResults);
      hasLoadedResults = true;
      activeView = "search";
      syncNavigation();
      renderSearchResults();
    } catch (error) {
      if (!isCurrentRequest(requestId)) return;
      state.setQuery(normalizedTitle);
      state.setMovies([]);
      hasLoadedResults = true;
      setHeading("Search failed", "SEARCH RESULTS");
      showEmpty("Check your search", error.message, "⌕", true);
    } finally {
      if (isCurrentRequest(requestId)) setLoading(false);
    }
  }

  /** Отображает избранное или пустое состояние, если список пока пуст. */
  function renderFavorites() {
    resetDetails();
    setHeading("Watchlist", "YOUR COLLECTION");
    const favorites = sortTitles(state.getFavorites());
    setMeta(`${favorites.length} ${favorites.length === 1 ? "title" : "titles"}`);
    if (!favorites.length) {
      showEmpty("Your watchlist is empty", "Tap the heart on any title to save it here.", "♡");
      return;
    }
    renderMovies(favorites, { isFavorite: state.isFavorite, onFavorite, onDetails });
  }

  /** Отмечает выбранную вкладку меню. */
  function syncNavigation() {
    navLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.view === activeView));
  }

  /** Подгружает жанры для выбранного типа контента и восстанавливает подходящий фильтр. */
  async function loadGenreOptions(type = "") {
    const requestId = ++genreRequestNumber;
    const mediaType = type === "series" ? "series" : "movie";
    genreSelect.disabled = true;
    genreSelect.replaceChildren(new Option("Loading genres…", ""));
    try {
      const genres = await fetchGenres(mediaType);
      if (requestId !== genreRequestNumber) return;
      const selectedGenre = state.getFilters().genre;
      genreSelect.replaceChildren(new Option("All genres", ""));
      genres.forEach((genre) => genreSelect.add(new Option(genre.name, String(genre.id))));
      if (selectedGenre && !genres.some((genre) => String(genre.id) === selectedGenre)) {
        state.setFilters({ genre: "" });
        genreSelect.value = "";
      } else genreSelect.value = selectedGenre || "";
      genreSelect.disabled = false;
    } catch {
      if (requestId === genreRequestNumber) genreSelect.replaceChildren(new Option("Genres unavailable", ""));
    }
  }

  /** Жанровый каталог TMDB требует тип данных, поэтому фильтры из Trending открывают фильмы. */
  function ensureCatalogTypeForFilters() {
    const filters = state.getFilters();
    const hasAdvancedFilter = filters.year || filters.genre || filters.rating || filters.language || filters.runtime;
    if (searchInput.value.trim() || catalogType || !hasAdvancedFilter) return;
    catalogType = "movie";
    state.setFilters({ type: catalogType });
    typeTabs.forEach((tab) => {
      const selected = tab.dataset.type === catalogType;
      tab.classList.toggle("is-selected", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });
    loadGenreOptions(catalogType);
  }

  /** Повторно загружает или перерисовывает текущий экран с новыми фильтрами. */
  function refreshFilteredView() {
    ensureCatalogTypeForFilters();
    if (activeView === "favorites") renderFavorites();
    else if (searchInput.value.trim()) loadMovies(searchInput.value, 1);
    else loadCatalog(catalogType, 1);
  }

  /** Отключает фильтр длительности во время поиска по названию: API не возвращает её в выдаче. */
  function syncRuntimeFilterAvailability() {
    const hasTitleQuery = Boolean(searchInput.value.trim());
    runtimeSelect.disabled = hasTitleQuery;
    if (hasTitleQuery && state.getFilters().runtime) {
      state.setFilters({ runtime: "" });
      runtimeSelect.value = "";
    }
    advancedFilterHint.textContent = hasTitleQuery
      ? "Title search filters genre, rating and language on the current results page. Runtime is available in the catalog."
      : "In Trending, advanced catalog filters switch to Movies. Title searches apply genre, rating and language to the current results.";
  }

  function bindEvents() {
    searchInput.addEventListener("input", syncRuntimeFilterAvailability);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      activeView = "search";
      syncRuntimeFilterAvailability();
      loadMovies(searchInput.value, 1);
    });

    typeTabs.forEach((tab) => tab.addEventListener("click", () => {
      typeTabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      const previousType = state.getFilters().type;
      state.setFilters({ type: tab.dataset.type, ...(previousType !== tab.dataset.type ? { genre: "" } : {}) });
      if (previousType !== tab.dataset.type) genreSelect.value = "";
      loadGenreOptions(tab.dataset.type);
      if (searchInput.value.trim()) loadMovies(searchInput.value, 1);
      else loadCatalog(tab.dataset.type, 1);
    }));

    yearInput.addEventListener("change", () => {
      const year = yearInput.value.trim();
      if (year && (Number(year) < 1888 || Number(year) > Number(yearInput.max))) {
        yearInput.setCustomValidity(`Enter a year between 1888 and ${yearInput.max}`);
        yearInput.reportValidity();
        return;
      }
      yearInput.setCustomValidity("");
      state.setFilters({ year });
      refreshFilteredView();
    });

    genreSelect.addEventListener("change", () => {
      state.setFilters({ genre: genreSelect.value });
      refreshFilteredView();
    });
    ratingSelect.addEventListener("change", () => {
      state.setFilters({ rating: ratingSelect.value });
      refreshFilteredView();
    });
    languageSelect.addEventListener("change", () => {
      state.setFilters({ language: languageSelect.value });
      refreshFilteredView();
    });
    runtimeSelect.addEventListener("change", () => {
      state.setFilters({ runtime: runtimeSelect.value });
      refreshFilteredView();
    });

    clearFiltersButton.addEventListener("click", () => {
      state.setFilters({ year: "", genre: "", rating: "", language: "", runtime: "" });
      yearInput.value = "";
      genreSelect.value = "";
      ratingSelect.value = "";
      languageSelect.value = "";
      runtimeSelect.value = "";
      refreshFilteredView();
    });

    // Полный сброс отдельно очищает запрос и все фильтры, затем показывает Trending.
    clearAllButton.addEventListener("click", () => {
      searchInput.value = "";
      yearInput.value = "";
      yearInput.setCustomValidity("");
      genreSelect.value = "";
      ratingSelect.value = "";
      languageSelect.value = "";
      runtimeSelect.value = "";
      sortSelect.value = "relevance";

      state.setFilters({
        type: "",
        year: "",
        sort: "relevance",
        genre: "",
        rating: "",
        language: "",
        runtime: "",
      });
      catalogType = "";
      activeView = "search";
      typeTabs.forEach((tab) => {
        const selected = tab.dataset.type === "";
        tab.classList.toggle("is-selected", selected);
        tab.setAttribute("aria-pressed", String(selected));
      });
      syncNavigation();
      syncRuntimeFilterAvailability();
      loadGenreOptions("");
      loadCatalog("", 1);
    });

    sortSelect.addEventListener("change", () => {
      state.setFilters({ sort: sortSelect.value });
      refreshFilteredView();
    });

    navLinks.forEach((link) => link.addEventListener("click", () => {
      activeView = link.dataset.view;
      syncNavigation();
      if (activeView === "favorites") renderFavorites();
      else if (searchInput.value.trim()) loadMovies(searchInput.value, 1);
      else loadCatalog(catalogType, 1);
    }));
  }

  /** Восстанавливает фильтры и запускает стартовую загрузку каталога. */
  function initialize({ loadInitialCatalog = true } = {}) {
    const filters = state.getFilters();
    const currentYear = new Date().getFullYear();
    yearInput.max = String(currentYear);
    if (filters.year && Number(filters.year) > currentYear) state.setFilters({ year: "" });
    yearInput.value = state.getFilters().year || "";
    sortSelect.value = filters.sort || "relevance";
    ratingSelect.value = filters.rating || "";
    languageSelect.value = filters.language || "";
    runtimeSelect.value = filters.runtime || "";
    typeTabs.forEach((tab) => {
      const selected = tab.dataset.type === filters.type;
      tab.classList.toggle("is-selected", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });
    searchInput.value = "";
    catalogType = filters.type || "";
    syncRuntimeFilterAvailability();
    bindEvents();
    loadGenreOptions(catalogType);
    if (loadInitialCatalog) loadCatalog(catalogType);
    refreshFavoriteCount();
  }

  return {
    initialize,
    renderCurrentResults,
    refreshFavoriteCount,
    getBackLabel() {
      if (activeView === "favorites") return "← Back to watchlist";
      return catalogMode ? "← Back to catalog" : "← Back to results";
    },
  };
}
