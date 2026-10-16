import { API_KEY } from "./config.js";
import { fetchTmdbDetails } from "./tmdb.js";

const API_URL = "https://www.omdbapi.com/";

/** Requests OMDb and converts its application-level errors into useful errors. */
async function request(params) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({ apikey: API_KEY, ...params });
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Could not connect to OMDb. Check your internet connection and try again.");
  }
  if (!response.ok) throw new Error(`OMDb returned an error (${response.status}). Try again later.`);
  const data = await response.json();
  if (data.Response === "False") throw new Error(data.Error || "No title found.");
  return data;
}

/** Fetch old saved OMDb favorites; all current browsing uses TMDB for localization consistency. */
export function fetchMovieDetails(id) {
  if (id.startsWith("tmdb:")) return fetchTmdbDetails(id);
  return request({ i: id, plot: "full" });
}
