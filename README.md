# Frame — Movie Search

A small app built with plain HTML, CSS, and JavaScript. No bundler or third-party libraries are required.

## Data sources

- TMDB provides the trending feed, movie and TV catalogs, title search, posters, and details. Requests use the `en-US` locale.
- Favorites saved by earlier versions are matched to TMDB by title when opened.

## Project structure

- `src/main.js` is the small entry point that connects the app controllers and theme.
- `src/catalog-controller.js` handles catalog loading, title search, filters, navigation, and favorites.
- `src/details-controller.js` handles movie and actor detail views plus browser history.
- `src/tmdb.js` contains TMDB requests and converts API responses to the app's data model.
- `src/state.js` keeps current results in memory and persists filters and favorites.
- `src/ui.js` creates result cards, details, actor profiles, and loading or empty states.
- `src/theme.js` applies the saved light or dark theme.
- `src/styles/` separates design tokens, page layout, controls, cards, details, and responsive rules.

## TMDB API key

The v3 API key is configured in `src/config.js`. TMDB requires an account and an API application request. The key is included in browser requests and is visible to site visitors. For a public deployment, proxy TMDB requests through a server.

## Run locally

Open the project through a local HTTP server, such as Live Server in your editor. Browser ES modules may not work when opening `index.html` with `file://`.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
