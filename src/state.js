// Сохраняем только пользовательские данные, которые нужны между запусками приложения.
const STORAGE_KEYS = {
  favorites: "movieSearch.favorites",
  filters: "movieSearch.filters",
};

const DEFAULT_FILTERS = {
  type: "",
  year: "",
  sort: "relevance",
  genre: "",
  rating: "",
  language: "",
  runtime: "",
};

/** Безопасно читает JSON из localStorage и возвращает запасное значение при ошибке. */
function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Безопасно сохраняет JSON; приложение остаётся рабочим, если хранилище недоступно. */
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Например, браузер запретил localStorage или в нём закончилось место.
  }
}

/** Приводит сохранённое избранное к модели TMDB, сохраняя записи ранней версии. */
function normalizeFavorite(movie) {
  if (!movie || typeof movie !== "object") return null;

  // Старые карточки имели другой идентификатор и поле рейтинга. Детали такой записи
  // будут найдены по названию через TMDB при открытии, ключ старого API больше не нужен.
  const id = movie.id || movie.imdbID;
  if (!id || !movie.Title) return null;

  const normalized = {
    ...movie,
    id,
    Rating: String(id).startsWith("tmdb:") ? movie.Rating || movie.RatingValue || movie.imdbRating || "" : "",
  };
  delete normalized.imdbID;
  delete normalized.imdbRating;
  delete normalized.RatingValue;
  delete normalized.Rated;
  delete normalized.Awards;
  return normalized;
}

// Результаты живут только в памяти: при запуске приложение всегда начинает с каталога.
let movies = [];
let query = "";
let page = 1;
let totalResults = 0;

let storedFilters = readStorage(STORAGE_KEYS.filters, {});
if (!storedFilters || typeof storedFilters !== "object" || Array.isArray(storedFilters)) storedFilters = {};
let filters = { ...DEFAULT_FILTERS, ...storedFilters };
if (!["", "movie", "series"].includes(filters.type)) filters.type = "";

const storedFavorites = readStorage(STORAGE_KEYS.favorites, []);
let favorites = Array.isArray(storedFavorites) ? storedFavorites.map(normalizeFavorite).filter(Boolean) : [];
writeStorage(STORAGE_KEYS.favorites, favorites);

// Доступ к данным текущей выдачи и пользовательским фильтрам.
export const getMovies = () => movies;
export const setMovies = (value) => { movies = value; };
export const getQuery = () => query;
export const setQuery = (value) => { query = value; };
export const getPage = () => page;
export const setPage = (value) => { page = value; };
export const getTotalResults = () => totalResults;
export const setTotalResults = (value) => { totalResults = Number(value) || 0; };
export const getFilters = () => filters;
export const setFilters = (value) => {
  filters = { ...filters, ...value };
  writeStorage(STORAGE_KEYS.filters, filters);
};

// Избранное хранится в localStorage, чтобы переживать перезапуск страницы.
export const getFavorites = () => favorites;
export const isFavorite = (id) => favorites.some((movie) => movie.id === id);

/** Добавляет название в избранное или удаляет его и сохраняет обновлённый список. */
export function toggleFavorite(movie) {
  favorites = isFavorite(movie.id)
    ? favorites.filter((item) => item.id !== movie.id)
    : [...favorites, movie];
  writeStorage(STORAGE_KEYS.favorites, favorites);
  return favorites;
}
