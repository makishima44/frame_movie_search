import { TMDB_API_KEY } from "./config.js";

const API_ROOT = "https://api.themoviedb.org/3";
const IMAGE_ROOT = "https://image.tmdb.org/t/p/w500";
const genreCache = new Map();

/** Возвращает текущую дату в формате YYYY-MM-DD для ограничения релизов. */
function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Отсекает фильмы и сериалы, дата выхода которых ещё не наступила. */
function isReleased(item) {
  const releaseDate = item.release_date || item.first_air_date;
  return !releaseDate || releaseDate <= today();
}

/** Общий запрос к TMDB с обработкой сетевых ошибок и ошибок API-ключа. */
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

/** Приводит объект TMDB к общему формату, который ожидают компоненты интерфейса. */
function normalizeItem(item, type) {
  const mediaType = item.media_type || type;
  const isSeries = mediaType === "tv";
  const poster = item.poster_path ? `${IMAGE_ROOT}${item.poster_path}` : "N/A";
  return {
    id: `tmdb:${mediaType}:${item.id}`,
    Title: item.title || item.name,
    Year: (item.release_date || item.first_air_date || "").slice(0, 4) || "N/A",
    Poster: poster,
    Type: isSeries ? "series" : "movie",
    Rating: item.vote_average ? item.vote_average.toFixed(1) : "",
    VoteAverage: Number(item.vote_average) || 0,
    GenreIds: item.genre_ids || [],
    OriginalLanguage: item.original_language || "",
  };
}

/** Загружает и кэширует справочник жанров для фильтров меню. */
export async function fetchGenres(type) {
  const mediaType = type === "series" ? "tv" : "movie";
  if (genreCache.has(mediaType)) return genreCache.get(mediaType);
  const data = await request(`/genre/${mediaType}/list`, { language: "en-US" });
  genreCache.set(mediaType, data.genres || []);
  return genreCache.get(mediaType);
}

/** Загружает ленту каталога и применяет фильтры типа, года и сортировки. */
export async function discoverCatalog({ type = "", page = 1, year = "", sort = "relevance", genre = "", rating = "", language = "", runtime = "" }) {
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
  if (genre) params.with_genres = genre;
  if (rating) params["vote_average.gte"] = rating;
  if (language) params.with_original_language = language;
  if (runtime) params["with_runtime.gte"] = runtime;
  const data = await request(`/discover/${mediaType}`, params);
  return { results: data.results.filter(isReleased).map((item) => normalizeItem(item, mediaType)), totalResults: data.total_results, page: data.page };
}

/** Ищет названия на английском, как и каталог с экраном подробностей. */
export async function searchCatalog({ title, type = "", page = 1, year = "", genre = "", rating = "", language = "" }) {
  const path = type === "movie" ? "/search/movie" : type === "series" ? "/search/tv" : "/search/multi";
  const params = { language: "en-US", page: String(page), query: title, include_adult: "false" };
  if (year && type === "movie") params.year = year;
  if (year && type === "series") params.first_air_date_year = year;
  const data = await request(path, params);
  let results = data.results.filter((item) => item.media_type !== "person" && isReleased(item));
  if (year && !type) {
    results = results.filter((item) => (item.release_date || item.first_air_date || "").startsWith(year));
  }
  if (genre) results = results.filter((item) => (type || item.media_type === "movie") && (item.genre_ids || []).includes(Number(genre)));
  if (rating) results = results.filter((item) => Number(item.vote_average) >= Number(rating));
  if (language) results = results.filter((item) => item.original_language === language);
  return {
    results: results.map((item) => normalizeItem(item, type === "series" ? "tv" : "movie")),
    totalResults: data.total_results,
    page: data.page,
  };
}

/** Загружает подробности TMDB и приводит их к полям экрана карточки. */
export async function fetchTmdbDetails(key) {
  const [, mediaType, id] = key.split(":");
  if (!mediaType || !id) throw new Error("Invalid TMDB ID.");
  const isSeries = mediaType === "tv";
  // Одним запросом загружаем данные страницы, видео и два источника рекомендаций.
  const data = await request(`/${mediaType}/${id}`, {
    language: "en-US",
    append_to_response: "credits,videos,recommendations,similar",
  });
  const directors = (data.credits?.crew || []).filter((person) => person.job === "Director").map((person) => person.name);
  const people = isSeries ? data.created_by || [] : directors;
  const recommendations = data.recommendations?.results?.length
    ? data.recommendations.results
    : data.similar?.results || [];

  return {
    id: key,
    Type: isSeries ? "series" : "movie",
    Title: data.title || data.name,
    Year: (data.release_date || data.first_air_date || "").slice(0, 4) || "N/A",
    Status: data.status || "N/A",
    Runtime: isSeries ? `${(data.episode_run_time || [])[0] || "—"} min/episode` : data.runtime ? `${data.runtime} min` : "N/A",
    Genre: (data.genres || []).map((genre) => genre.name).join(", ") || "N/A",
    Director: people.map((person) => person.name).join(", ") || "N/A",
    Cast: (data.credits?.cast || []).slice(0, 12).map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character,
      profile: person.profile_path ? `${IMAGE_ROOT}${person.profile_path}` : "",
    })),
    Country: (data.production_countries || []).map((country) => country.name).join(", ") || (data.origin_country || []).join(", ") || "N/A",
    Language: data.original_language || "N/A",
    Rating: data.vote_average ? data.vote_average.toFixed(1) : "N/A",
    Plot: data.overview || "N/A",
    Poster: data.poster_path ? `${IMAGE_ROOT}${data.poster_path}` : "N/A",
    Videos: (data.videos?.results || [])
      .filter((video) => video.site === "YouTube" && video.key && ["Trailer", "Teaser", "Featurette", "Clip"].includes(video.type))
      .sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer") || Number(b.official) - Number(a.official))
      .slice(0, 5)
      .map((video) => ({ id: video.id, key: video.key, name: video.name, type: video.type })),
    Recommendations: recommendations
      .filter((item) => item.id !== data.id && isReleased(item))
      .slice(0, 10)
      .map((item) => normalizeItem(item, mediaType)),
  };
}

/** Загружает биографию человека и объединённую фильмографию из TMDB. */
export async function fetchPersonDetails(id) {
  const [person, credits] = await Promise.all([
    request(`/person/${id}`, { language: "en-US" }),
    request(`/person/${id}/combined_credits`, { language: "en-US" }),
  ]);
  const knownFor = (credits.cast || [])
    .filter(isReleased)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 12)
    .map((item) => ({ ...normalizeItem(item, item.media_type), Popularity: item.popularity || 0 }));
  return {
    id: person.id,
    name: person.name,
    biography: person.biography || "No biography available yet.",
    department: person.known_for_department || "Performer",
    birthday: person.birthday || "",
    placeOfBirth: person.place_of_birth || "",
    profile: person.profile_path ? `${IMAGE_ROOT}${person.profile_path}` : "",
    knownFor,
  };
}
