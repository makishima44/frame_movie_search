const KEYS = { query: "movieSearch.query", page: "movieSearch.page", favorites: "movieSearch.favorites", filters: "movieSearch.filters" };
const safeRead = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); }
  catch { return fallback; }
};
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled or full. */ } };

let movies = [];
let query = "";
let page = 1;
let totalResults = 0;
let filters = safeRead(KEYS.filters, { type: "", year: "", sort: "relevance" });
if (!filters || typeof filters !== "object") filters = { type: "", year: "", sort: "relevance" };
if (!["", "movie", "series"].includes(filters.type)) filters.type = "";
let favorites = safeRead(KEYS.favorites, []);
if (!Array.isArray(favorites)) favorites = [];

export const getMovies = () => movies;
export const setMovies = (value) => { movies = value; };
export const getQuery = () => query;
export const setQuery = (value) => { query = value; safeWrite(KEYS.query, value); };
export const getPage = () => page;
export const setPage = (value) => { page = value; safeWrite(KEYS.page, value); };
export const getTotalResults = () => totalResults;
export const setTotalResults = (value) => { totalResults = Number(value) || 0; };
export const getFilters = () => filters;
export const setFilters = (value) => { filters = { ...filters, ...value }; safeWrite(KEYS.filters, filters); };
export const getFavorites = () => favorites;
export const isFavorite = (id) => favorites.some((movie) => movie.imdbID === id);
export function toggleFavorite(movie) {
  favorites = isFavorite(movie.imdbID) ? favorites.filter((item) => item.imdbID !== movie.imdbID) : [...favorites, movie];
  safeWrite(KEYS.favorites, favorites);
  return favorites;
}
export function restoreSearch() {
  const savedQuery = safeRead(KEYS.query, null);
  const savedPage = safeRead(KEYS.page, null);
  // Migrate the plain-string keys used by the first version of the app.
  let legacyQuery = "";
  let legacyPage = 1;
  try {
    legacyQuery = localStorage.getItem("lastMovieQuery") || "";
    legacyPage = Number(localStorage.getItem("lastMoviePage")) || 1;
  } catch { /* The app remains usable when browser storage is unavailable. */ }
  return {
    query: typeof savedQuery === "string" ? savedQuery : legacyQuery,
    page: Number(savedPage) || legacyPage,
  };
}
