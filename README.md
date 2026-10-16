# Frame — Movie Search

A small app built with plain HTML, CSS, and JavaScript. No bundler or third-party libraries are required.

## Data sources

- TMDB provides the trending feed, movie and TV catalogs, title search, posters, and details. Requests use the `en-US` locale.
- OMDb is retained only to open details for favorites saved by the previous version.

## TMDB API key

The v3 API key is configured in `src/config.js`. TMDB requires an account and an API application request. The key is included in browser requests and is visible to site visitors. For a public deployment, proxy TMDB requests through a server.

## Run locally

Open the project through a local HTTP server, such as Live Server in your editor. Browser ES modules may not work when opening `index.html` with `file://`.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
