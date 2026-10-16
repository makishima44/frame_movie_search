import { fetchPersonDetails, fetchTmdbDetails, searchCatalog } from "./tmdb.js";
import {
  addEmptyAction,
  clearResults,
  renderDetails,
  renderLoadingSkeletons,
  renderPersonDetails,
  scrollToViewStart,
  setLoading,
  showEmpty,
} from "./ui.js";

/** Управляет страницами фильма и профиля актёра, включая кнопки истории браузера. */
export function createDetailsController({ getBackLabel, renderCurrentResults, onFavorite, isFavorite, nextRequest, isCurrentRequest }) {
  let currentDetails = null;
  let currentPerson = null;

  /** Ищет в каталоге TMDB запись для избранного из более старой версии приложения. */
  async function findSavedTitleInTmdb(savedTitle) {
    const savedYear = String(savedTitle.Year || "").match(/\d{4}/)?.[0] || "";
    const matches = await searchCatalog({
      title: savedTitle.Title,
      type: savedTitle.Type === "series" ? "series" : "movie",
      year: savedYear,
    });
    const exactTitle = (movie) => movie.Title.toLowerCase() === savedTitle.Title.toLowerCase();
    const matchedTitle = matches.results.find((movie) => exactTitle(movie) && (!savedYear || movie.Year === savedYear))
      || matches.results.find(exactTitle)
      || matches.results[0];
    if (!matchedTitle) throw new Error("This saved title could not be matched in the TMDB catalog.");
    return matchedTitle.id;
  }

  /** Загружает данные фильма или сериала и открывает экран подробностей. */
  async function showDetails(selection, { pushHistory = true } = {}) {
    const requestId = nextRequest();
    currentDetails = null;
    currentPerson = null;
    setLoading(true);
    clearResults();
    renderLoadingSkeletons(1);
    scrollToViewStart();
    try {
      const selectedTitle = typeof selection === "object" ? selection : null;
      let id = selectedTitle?.id || selection;
      if (!String(id).startsWith("tmdb:") && selectedTitle?.Title) id = await findSavedTitleInTmdb(selectedTitle);
      if (!isCurrentRequest(requestId)) return;

      currentDetails = await fetchTmdbDetails(id);
      if (!isCurrentRequest(requestId)) return;
      if (pushHistory) history.pushState({ ...(history.state || {}), view: "movie-details", movieId: id }, "", `#film=${encodeURIComponent(id)}`);
      renderDetails(currentDetails, {
        onBack: handleBack,
        backLabel: getBackLabel(),
        onFavorite,
        isFavorite,
        onActor: showPersonDetails,
        onDirector: (personId) => showPersonDetails(personId, { role: "director" }),
        onTitle: (title) => showDetails(title),
      });
    } catch (error) {
      if (isCurrentRequest(requestId)) {
        showEmpty("Could not load details", error.message, "!", true);
        addEmptyAction("← Back to results", handleBack);
      }
    } finally {
      if (isCurrentRequest(requestId)) setLoading(false);
    }
  }

  /** Открывает профиль участника актёрского состава вместе с его фильмографией. */
  async function showPersonDetails(id, { pushHistory = true, role = "actor" } = {}) {
    const requestId = nextRequest();
    currentPerson = null;
    currentDetails = null;
    setLoading(true);
    clearResults();
    renderLoadingSkeletons(1);
    scrollToViewStart();
    try {
      currentPerson = await fetchPersonDetails(id);
      if (!isCurrentRequest(requestId)) return;
      if (pushHistory) history.pushState(
        { ...(history.state || {}), view: "person-details", personId: id, personRole: role },
        "",
        `#person=${encodeURIComponent(id)}&role=${encodeURIComponent(role)}`,
      );
      renderPersonDetails(currentPerson, {
        onBack: handleBack,
        onTitle: (title) => showDetails(title),
        role,
      });
    } catch (error) {
      if (isCurrentRequest(requestId)) {
        showEmpty("Could not load person profile", error.message, "!", true);
        addEmptyAction("← Back", handleBack);
      }
    } finally {
      if (isCurrentRequest(requestId)) setLoading(false);
    }
  }

  /** Возвращает в историю браузера или к текущему списку. */
  function handleBack() {
    if ((currentDetails && history.state?.view === "movie-details")
      || (currentPerson && history.state?.view === "person-details")) {
      history.back();
      return;
    }
    reset();
    renderCurrentResults();
  }

  /** Обновляет экран при переходе «назад/вперёд», в том числе между фильмом и профилем. */
  function handlePopState() {
    const previousView = history.state?.view;
    if (previousView === "movie-details") showDetails(history.state.movieId, { pushHistory: false });
    else if (previousView === "person-details") showPersonDetails(history.state.personId, { pushHistory: false, role: history.state.personRole || "actor" });
    else {
      reset();
      renderCurrentResults();
    }
  }

  /** Очищает текущие подробности перед загрузкой другого каталога или поиска. */
  function reset() {
    currentDetails = null;
    currentPerson = null;
  }

  /** Проверяет, открыт ли сейчас конкретный фильм или сериал. */
  function isShowing(id) {
    return currentDetails?.id === id;
  }

  /** Перерисовывает подробности после изменения кнопки избранного. */
  function refreshCurrentDetails() {
    if (!currentDetails) return;
    renderDetails(currentDetails, {
      onBack: handleBack,
      backLabel: getBackLabel(),
      onFavorite,
      isFavorite,
      onActor: showPersonDetails,
      onDirector: (personId) => showPersonDetails(personId, { role: "director" }),
      onTitle: (title) => showDetails(title),
    });
  }

  /** Подключает кнопки истории браузера и Escape. */
  function initialize() {
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && (currentDetails || currentPerson)) handleBack();
    });
  }

  /** Восстанавливает подробную страницу из hash-ссылки после открытия или перезагрузки. */
  function restoreFromLocation() {
    const route = new URLSearchParams(window.location.hash.slice(1));
    const movieId = route.get("film");
    const personId = route.get("person");
    if (!movieId && !personId) return false;

    const role = route.get("role") === "director" || history.state?.personRole === "director"
      ? "director"
      : "actor";
    const routeState = movieId
      ? { view: "movie-details", movieId }
      : { view: "person-details", personId, personRole: role };
    const expectedView = routeState.view;

    // При прямом открытии hash-ссылки добавляем каталог под ней, чтобы кнопка «назад» осталась внутри приложения.
    if (history.state?.view !== expectedView) {
      const detailUrl = window.location.href;
      const baseUrl = `${window.location.pathname}${window.location.search}`;
      history.replaceState({ view: "catalog" }, "", baseUrl);
      history.pushState(routeState, "", detailUrl);
    } else {
      history.replaceState({ ...history.state, ...routeState }, "", window.location.href);
    }

    if (movieId) showDetails(movieId, { pushHistory: false });
    else showPersonDetails(personId, { pushHistory: false, role });
    return true;
  }

  return { initialize, restoreFromLocation, showDetails, reset, isShowing, refreshCurrentDetails };
}
