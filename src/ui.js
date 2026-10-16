const movieContainer = document.getElementById("movieContainer");
const paginationContainer = document.getElementById("paginationContainer");
const loadingContainer = document.getElementById("loadingContainer");
const resultsTitle = document.getElementById("resultsTitle");
const resultsEyebrow = document.getElementById("resultsEyebrow");
const resultsMeta = document.getElementById("resultsMeta");

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function setLoading(active) {
  loadingContainer.hidden = !active;
  const button = document.getElementById("movieSearchButton");
  button.disabled = active;
  button.innerHTML = active ? "Searching…" : 'Search <span aria-hidden="true">↗</span>';
}

export function clearResults() {
  movieContainer.replaceChildren();
  paginationContainer.replaceChildren();
  resultsMeta.textContent = "";
}
export function setHeading(title, eyebrow = "SEARCH RESULTS") {
  resultsTitle.textContent = title;
  resultsEyebrow.textContent = eyebrow;
}
export function setMeta(value) {
  resultsMeta.textContent = value;
}

export function showEmpty(title, message, icon = "⌕", isError = false) {
  clearResults();
  const state = element("div", "empty-state");
  state.append(element("div", "empty-icon", icon), element("h3", isError ? "error-text" : "", title), element("p", "", message));
  movieContainer.append(state);
  return state;
}

export function addEmptyAction(label, onClick) {
  const state = movieContainer.querySelector(".empty-state");
  if (!state) return;
  const button = element("button", "page-button", label);
  button.type = "button";
  button.addEventListener("click", onClick);
  state.append(button);
}

function createPoster(movie, className = "movie-poster") {
  if (movie.Poster && movie.Poster !== "N/A") {
    const image = element("img", className);
    image.src = movie.Poster;
    image.alt = `Poster: ${movie.Title}`;
    image.loading = "lazy";
    image.onerror = () => image.replaceWith(element("div", "poster-placeholder", movie.Title?.charAt(0) || "F"));
    return image;
  }
  return element("div", "poster-placeholder", movie.Title?.charAt(0) || "F");
}

export function renderMovies(movies, { isFavorite, onFavorite, onDetails }) {
  clearResults();
  if (!movies.length) return showEmpty("No titles found", "Try a different search or adjust your filters.");
  const fragment = document.createDocumentFragment();
  movies.forEach((movie) => {
    const card = element("article", "movie-card");
    const poster = element("div", "poster-wrap");
    poster.append(createPoster(movie));
    const favorite = element("button", `favorite-button${isFavorite(movie.imdbID) ? " is-favorite" : ""}`, isFavorite(movie.imdbID) ? "♥" : "♡");
    favorite.type = "button";
    favorite.setAttribute("aria-label", isFavorite(movie.imdbID) ? `Remove ${movie.Title} from watchlist` : `Add ${movie.Title} to watchlist`);
    favorite.setAttribute("aria-pressed", String(isFavorite(movie.imdbID)));
    favorite.addEventListener("click", () => onFavorite(movie));
    poster.append(favorite);
    const info = element("div", "card-info");
    info.append(element("h3", "card-title", movie.Title));
    const meta = element("div", "card-meta");
    const mediaLabels = { movie: "Movie", series: "TV Show", tv: "TV Show" };
    meta.append(element("span", "", movie.Year || "Year unknown"), element("span", "", "·"), element("span", "media-type", mediaLabels[movie.Type] || "Movie"));
    if (movie.Rating) meta.append(element("span", "", `★ ${movie.Rating}`));
    info.append(meta);
    const detail = element("button", "details-button", "View details →");
    detail.type = "button";
    detail.addEventListener("click", () => onDetails(movie.imdbID));
    info.append(detail);
    card.append(poster, info);
    fragment.append(card);
  });
  movieContainer.append(fragment);
}

export function renderPagination({ page, totalResults, pageSize = 10, onPage }) {
  paginationContainer.replaceChildren();
  const totalPages = Math.ceil(totalResults / pageSize);
  if (totalPages < 2) return;
  const previous = element("button", "page-button", "← Previous");
  previous.type = "button";
  previous.disabled = page <= 1;
  previous.addEventListener("click", () => onPage(page - 1));
  const next = element("button", "page-button", "Next →");
  next.type = "button";
  next.disabled = page >= totalPages;
  next.addEventListener("click", () => onPage(page + 1));
  paginationContainer.append(previous, element("span", "page-indicator", `Page ${page} of ${totalPages}`), next);
}

export function renderDetails(movie, { onBack, backLabel = "← Back to results", onFavorite, isFavorite }) {
  clearResults();
  setHeading(movie.Type === "series" ? "About this show" : "About this movie", "DETAILS");
  const detail = element("article", "detail-view");
  const poster = createPoster(movie, "detail-poster");
  const copy = element("div", "detail-copy");
  const back = element("button", "back-button", backLabel);
  back.type = "button";
  back.addEventListener("click", onBack);
  copy.append(back, element("h2", "detail-title", movie.Title));
  const subtitle = [movie.Year, movie.Rated, movie.Runtime].filter((item) => item && item !== "N/A").join(" · ");
  copy.append(element("p", "detail-subtitle", subtitle));
  const ratingSource = movie.imdbID?.startsWith("tmdb:") ? "TMDB" : "IMDb";
  if (movie.imdbRating && movie.imdbRating !== "N/A") copy.append(element("div", "detail-rating", `★  ${movie.imdbRating} / 10 ${ratingSource}`));
  copy.append(element("p", "detail-plot", movie.Plot && movie.Plot !== "N/A" ? movie.Plot : "No overview available yet."));
  const facts = element("div", "detail-facts");
  [
    ["Genre", movie.Genre],
    [movie.imdbID?.startsWith("tmdb:tv:") ? "Created by" : "Director", movie.Director],
    ["Cast", movie.Actors],
    ["Country", movie.Country],
    ["Language", movie.Language],
    ["Awards", movie.Awards],
  ].forEach(([label, value]) => {
    if (!value || value === "N/A") return;
    const fact = element("div", "detail-fact");
    fact.append(element("span", "", label), element("strong", "", value));
    facts.append(fact);
  });
  copy.append(facts);
  const favorite = element("button", "detail-favorite-button", `${isFavorite(movie.imdbID) ? "♥ Saved to watchlist" : "♡ Add to watchlist"}`);
  favorite.type = "button";
  favorite.addEventListener("click", () => onFavorite(movie));
  copy.append(favorite);
  detail.append(poster, copy);
  movieContainer.append(detail);
}
