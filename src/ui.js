const movieContainer = document.getElementById("movieContainer");
const paginationContainer = document.getElementById("paginationContainer");
const loadingContainer = document.getElementById("loadingContainer");
const resultsTitle = document.getElementById("resultsTitle");
const resultsEyebrow = document.getElementById("resultsEyebrow");
const resultsMeta = document.getElementById("resultsMeta");

// Общий помощник создаёт DOM-узлы без вставки пользовательских данных через innerHTML.
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Показывает индикатор загрузки и блокирует отправку формы до ответа. */
export function setLoading(active) {
  loadingContainer.hidden = !active;
  const button = document.getElementById("movieSearchButton");
  button.disabled = active;
  button.innerHTML = active ? "Searching…" : 'Search <span aria-hidden="true">↗</span>';
}

/** Очищает список карточек, пагинацию и счётчик результатов. */
export function clearResults() {
  movieContainer.replaceChildren();
  paginationContainer.replaceChildren();
  resultsMeta.textContent = "";
}

/** Показывает нейтральные карточки-заглушки, пока TMDB загружает результаты. */
export function renderLoadingSkeletons(count = 10) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const card = element("div", "skeleton-card");
    card.setAttribute("aria-hidden", "true");
    card.append(element("div", "skeleton-poster"));
    const info = element("div", "skeleton-info");
    info.append(element("span", "skeleton-line skeleton-title"), element("span", "skeleton-line skeleton-meta"));
    card.append(info);
    fragment.append(card);
  }
  movieContainer.append(fragment);
}
/** Обновляет заголовок секции и подпись над ним. */
export function setHeading(title, eyebrow = "SEARCH RESULTS") {
  resultsTitle.textContent = title;
  resultsEyebrow.textContent = eyebrow;
}
/** Показывает дополнительную информацию о количестве найденных названий. */
export function setMeta(value) {
  resultsMeta.textContent = value;
}

/** Показывает общий экран для пустого списка или ошибки загрузки. */
export function showEmpty(title, message, icon = "⌕", isError = false) {
  clearResults();
  const state = element("div", "empty-state");
  state.append(element("div", "empty-icon", icon), element("h3", isError ? "error-text" : "", title), element("p", "", message));
  movieContainer.append(state);
  return state;
}

/** Добавляет кнопку действия в уже показанное пустое состояние. */
export function addEmptyAction(label, onClick) {
  const state = movieContainer.querySelector(".empty-state");
  if (!state) return;
  const button = element("button", "page-button", label);
  button.type = "button";
  button.addEventListener("click", onClick);
  state.append(button);
}

/** Создаёт постер или заглушку, если изображения нет либо оно не загрузилось. */
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

/** Строит сетку карточек и назначает обработчики избранного и подробностей. */
export function renderMovies(movies, { isFavorite, onFavorite, onDetails }) {
  clearResults();
  if (!movies.length) return showEmpty("No titles found", "Try a different search or adjust your filters.");
  const fragment = document.createDocumentFragment();
  movies.forEach((movie) => {
    const card = element("article", "movie-card");
    const poster = element("div", "poster-wrap");
    poster.append(createPoster(movie));
    const favorite = element("button", `favorite-button${isFavorite(movie.id) ? " is-favorite" : ""}`, isFavorite(movie.id) ? "♥" : "♡");
    favorite.type = "button";
    favorite.setAttribute("aria-label", isFavorite(movie.id) ? `Remove ${movie.Title} from watchlist` : `Add ${movie.Title} to watchlist`);
    favorite.setAttribute("aria-pressed", String(isFavorite(movie.id)));
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
    detail.addEventListener("click", () => onDetails(movie));
    info.append(detail);
    card.append(poster, info);
    fragment.append(card);
  });
  movieContainer.append(fragment);
}

/** Рисует переключение страниц, если найдено больше одной страницы результатов. */
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

/** Собирает экран подробностей: постер, описание, факты и кнопку избранного. */
export function renderDetails(movie, { onBack, backLabel = "← Back to results", onFavorite, isFavorite, onActor, onDirector, onTitle }) {
  clearResults();
  setHeading(movie.Type === "series" ? "About this show" : "About this movie", "DETAILS");
  const detail = element("article", "detail-view");
  const poster = createPoster(movie, "detail-poster");
  const copy = element("div", "detail-copy");
  const back = element("button", "back-button", backLabel);
  back.type = "button";
  back.addEventListener("click", onBack);
  copy.append(back, element("h2", "detail-title", movie.Title));
  const subtitle = [movie.Year, movie.Status, movie.Runtime].filter((item) => item && item !== "N/A").join(" · ");
  copy.append(element("p", "detail-subtitle", subtitle));
  if (movie.Rating && movie.Rating !== "N/A") copy.append(element("div", "detail-rating", `★  ${movie.Rating} / 10 · TMDB`));
  copy.append(element("p", "detail-plot", movie.Plot && movie.Plot !== "N/A" ? movie.Plot : "No overview available yet."));
  const facts = element("div", "detail-facts");
  [
    ["Genre", movie.Genre],
    ...(movie.Type === "series" ? [["Created by", movie.Director]] : []),
    ...(!movie.Cast?.length ? [["Cast", movie.Actors]] : []),
    ["Country", movie.Country],
    ["Language", movie.Language],
    ["Awards", movie.Awards],
  ].forEach(([label, value]) => {
    if (!value || value === "N/A") return;
    const fact = element("div", "detail-fact");
    fact.append(element("span", "", label), element("strong", "", value));
    facts.append(fact);
  });
  if (movie.Type !== "series" || movie.Directors?.length) {
    const fact = element("div", "detail-fact");
    fact.append(element("span", "", movie.Type === "series" ? "Directed by" : "Director"));
    const people = element("div", "detail-people");
    if (movie.Directors?.length) {
      movie.Directors.forEach((director) => {
        const link = element("button", "person-name-link", director.name);
        link.type = "button";
        link.setAttribute("aria-label", `View director profile: ${director.name}`);
        link.title = "Open director profile";
        link.addEventListener("click", () => onDirector(director.id));
        people.append(link);
      });
    } else {
      people.append(element("strong", "", movie.Director || "N/A"));
    }
    fact.append(people);
    facts.append(fact);
  }
  copy.append(facts);
  if (movie.Cast?.length) {
    const castSection = element("section", "cast-section");
    castSection.append(element("h3", "cast-heading", "Cast"));
    const castGrid = element("div", "cast-grid");
    movie.Cast.forEach((person) => {
      const castCard = element("button", "cast-card");
      castCard.type = "button";
      castCard.addEventListener("click", () => onActor(person.id));
      const portrait = person.profile ? element("img", "cast-portrait") : element("span", "cast-portrait cast-portrait-placeholder", person.name.charAt(0));
      if (person.profile) {
        portrait.src = person.profile;
        portrait.alt = person.name;
        portrait.loading = "lazy";
      }
      const personInfo = element("span", "cast-person-info");
      personInfo.append(element("strong", "cast-person-name", person.name), element("span", "cast-character", person.character || "Cast member"));
      castCard.append(portrait, personInfo);
      castGrid.append(castCard);
    });
    castSection.append(castGrid);
    copy.append(castSection);
  }
  const favorite = element("button", "detail-favorite-button", `${isFavorite(movie.id) ? "♥ Saved to watchlist" : "♡ Add to watchlist"}`);
  favorite.type = "button";
  favorite.addEventListener("click", () => onFavorite(movie));
  copy.append(favorite);
  detail.append(poster, copy);

  // Видео и рекомендации занимают всю ширину страницы под основными сведениями.
  if (movie.Videos?.length || movie.Recommendations?.length) {
    const extras = element("div", "detail-extras");
    if (movie.Videos?.length) extras.append(createVideosSection(movie.Videos));
    if (movie.Recommendations?.length) extras.append(createRecommendationsSection(movie.Recommendations, onTitle));
    detail.append(extras);
  }
  movieContainer.append(detail);
}

/** Встраивает главный трейлер и оставляет ссылки на другие доступные видео. */
function createVideosSection(videos) {
  const section = element("section", "detail-media-section videos-section");
  section.append(element("h3", "detail-section-heading", "Trailers & videos"));
  const primary = videos[0];
  const frame = element("iframe", "trailer-frame");
  frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(primary.key)}`;
  frame.title = primary.name || `${primary.type} for this title`;
  frame.loading = "lazy";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  section.append(frame);

  if (videos.length > 1) {
    const links = element("div", "video-links");
    videos.slice(1).forEach((video) => {
      const link = element("a", "video-link", `${video.type}: ${video.name}`);
      link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.key)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      links.append(link);
    });
    section.append(links);
  }
  return section;
}

/** Создаёт компактную ленту рекомендаций, ведущую на страницы выбранных названий. */
function createRecommendationsSection(titles, onTitle) {
  const section = element("section", "detail-media-section recommendations-section");
  section.append(element("h3", "detail-section-heading", "You may also like"));
  const grid = element("div", "recommendation-grid");
  titles.forEach((title) => {
    const card = element("button", "recommendation-card");
    card.type = "button";
    card.addEventListener("click", () => onTitle(title));
    card.append(createPoster(title, "recommendation-poster"));
    const info = element("span", "recommendation-info");
    const typeLabel = title.Type === "series" ? "TV Show" : "Movie";
    info.append(element("strong", "", title.Title), element("span", "", `${title.Year} · ${typeLabel}`));
    card.append(info);
    grid.append(card);
  });
  section.append(grid);
  return section;
}

/** Показывает биографию человека и фильмографию в выбранной роли. */
export function renderPersonDetails(person, { onBack, onTitle, role = "actor" }) {
  clearResults();
  const titles = (role === "director" ? person.directedWork : person.knownFor) || [];
  setHeading(role === "director" ? "Director profile" : "Actor profile", "PEOPLE");
  setMeta(`${titles.length} ${titles.length === 1 ? "title" : "titles"}`);
  const profile = element("article", "person-view");
  const back = element("button", "back-button person-back-button", "← Back to title");
  back.type = "button";
  back.addEventListener("click", onBack);
  const header = element("div", "person-profile-header");
  if (person.profile) {
    const image = element("img", "person-profile-image");
    image.src = person.profile;
    image.alt = person.name;
    image.loading = "lazy";
    header.append(image);
  } else header.append(element("div", "person-profile-image person-profile-placeholder", person.name.charAt(0)));

  const intro = element("div", "person-profile-intro");
  intro.append(element("p", "person-department", role === "director" ? "Director" : person.department), element("h2", "person-name", person.name));
  const facts = [person.birthday, person.placeOfBirth].filter(Boolean);
  if (facts.length) intro.append(element("p", "person-facts", facts.join(" · ")));
  intro.append(element("p", "person-biography", person.biography));
  header.append(intro);
  profile.append(back, header, element("h3", "filmography-heading", role === "director" ? "Directed films & shows" : "Known for"));

  if (!titles.length) {
    const message = role === "director" ? "TMDB has no directing credits for this person yet." : "No filmography is available yet.";
    profile.append(element("p", "person-filmography-empty", message));
  } else {
    const filmography = element("div", "person-filmography");
    titles.forEach((title) => {
      const item = element("button", "person-title-card");
      item.type = "button";
      item.addEventListener("click", () => onTitle(title));
      item.append(createPoster(title, "person-title-poster"));
      const titleInfo = element("span", "person-title-info");
      titleInfo.append(element("strong", "", title.Title), element("span", "", `${title.Year} · ${title.Type === "series" ? "TV Show" : "Movie"}`));
      item.append(titleInfo);
      filmography.append(item);
    });
    profile.append(filmography);
  }
  movieContainer.append(profile);
}
