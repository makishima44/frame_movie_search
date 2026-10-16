import { TMDB_API_KEY } from "./config.js";

const API_ROOT = "https://api.themoviedb.org/3";
const IMAGE_ROOT = "https://image.tmdb.org/t/p/w500";

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isReleased(item) {
  const releaseDate = item.release_date || item.first_air_date;
  return !releaseDate || releaseDate <= today();
}

async function request(path, params = {}) {
  if (!TMDB_API_KEY) {
    throw new Error("Add a TMDB API key to src/config.js to use the catalog and search.");
  }

  const url = new URL(`${API_ROOT}${path}`);
  url.search = new URLSearchParams({ api_key: TMDB_API_KEY, ...params });
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Could not connect to TMDB. Check your internet connection and try again.");
  }

  if (response.status === 401) throw new Error("TMDB rejected the API key. Check src/config.js.");
  if (!response.ok) throw new Error(`TMDB returned an error (${response.status}). Try again later.`);
  return response.json();
}

function normalizeItem(item, type) {
  const mediaType = item.media_type || type;
  const isSeries = mediaType === "tv";
  const poster = item.poster_path ? `${IMAGE_ROOT}${item.poster_path}` : "N/A";
  return {
    imdbID: `tmdb:${mediaType}:${item.id}`,
    Title: item.title || item.name,
    Year: (item.release_date || item.first_air_date || "").slice(0, 4) || "N/A",
    Poster: poster,
    Type: isSeries ? "series" : "movie",
    Rating: item.vote_average ? item.vote_average.toFixed(1) : "",
  };
}

/** Popular mixed/movie/TV catalogue for the no-query discovery view. */
export async function discoverCatalog({ type = "", page = 1, year = "", sort = "relevance" }) {
  if (!type) {
    const data = await request("/trending/all/day", { language: "en-US", page: String(page) });
    return { results: data.results.filter(isReleased).map((item) => normalizeItem(item, item.media_type)), totalResults: data.total_results, page: data.page };
  }

  const mediaType = type === "series" ? "tv" : "movie";
  const sortBy = sort === "newest" ? (mediaType === "tv" ? "first_air_date" : "primary_release_date") + ".desc"
    : sort === "oldest" ? (mediaType === "tv" ? "first_air_date" : "primary_release_date") + ".asc"
      : sort === "title" ? (mediaType === "tv" ? "name" : "title") + ".asc" : "popularity.desc";
  const params = { language: "en-US", page: String(page), sort_by: sortBy, include_adult: "false" };
  params[mediaType === "tv" ? "first_air_date.lte" : "primary_release_date.lte"] = today();
  if (year) params[mediaType === "tv" ? "first_air_date_year" : "primary_release_year"] = year;
  const data = await request(`/discover/${mediaType}`, params);
  return { results: data.results.filter(isReleased).map((item) => normalizeItem(item, mediaType)), totalResults: data.total_results, page: data.page };
}

/** Search TMDB in English, matching the language used in the catalog and details. */
export async function searchCatalog({ title, type = "", page = 1, year = "" }) {
  const path = type === "movie" ? "/search/movie" : type === "series" ? "/search/tv" : "/search/multi";
  const params = { language: "en-US", page: String(page), query: title, include_adult: "false" };
  if (year && type === "movie") params.year = year;
  if (year && type === "series") params.first_air_date_year = year;
  const data = await request(path, params);
  let results = data.results.filter((item) => item.media_type !== "person" && isReleased(item));
  if (year && !type) {
    results = results.filter((item) => (item.release_date || item.first_air_date || "").startsWith(year));
  }
  return {
    results: results.map((item) => normalizeItem(item, type === "series" ? "tv" : "movie")),
    totalResults: data.total_results,
    page: data.page,
  };
}

/** Get details and normalize them to the fields shared by the existing detail UI. */
export async function fetchTmdbDetails(key) {
  const [, mediaType, id] = key.split(":");
  if (!mediaType || !id) throw new Error("Invalid TMDB ID.");
  const isSeries = mediaType === "tv";
  const data = await request(`/${mediaType}/${id}`, { language: "en-US", append_to_response: "credits" });
  const directors = (data.credits?.crew || []).filter((person) => person.job === "Director").map((person) => person.name);
  const people = isSeries ? data.created_by || [] : directors;
  return {
    imdbID: key,
    Type: isSeries ? "series" : "movie",
    Title: data.title || data.name,
    Year: (data.release_date || data.first_air_date || "").slice(0, 4) || "N/A",
    Rated: data.status || "N/A",
    Runtime: isSeries ? `${(data.episode_run_time || [])[0] || "—"} min/episode` : data.runtime ? `${data.runtime} min` : "N/A",
    Genre: (data.genres || []).map((genre) => genre.name).join(", ") || "N/A",
    Director: people.map((person) => person.name).join(", ") || "N/A",
    Actors: (data.credits?.cast || []).slice(0, 6).map((person) => person.name).join(", ") || "N/A",
    Country: (data.production_countries || []).map((country) => country.name).join(", ") || (data.origin_country || []).join(", ") || "N/A",
    Language: data.original_language || "N/A",
    Awards: "N/A",
    imdbRating: data.vote_average ? data.vote_average.toFixed(1) : "N/A",
    Plot: data.overview || "N/A",
    Poster: data.poster_path ? `${IMAGE_ROOT}${data.poster_path}` : "N/A",
  };
}
