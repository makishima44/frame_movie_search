import * as state from "./state.js";
import { createCatalogController } from "./catalog-controller.js";
import { createDetailsController } from "./details-controller.js";
import { initializeTheme } from "./theme.js";

// Точка входа связывает независимые части приложения.
let requestNumber = 0;
let catalogController;
let detailsController;

const nextRequest = () => ++requestNumber;
const isCurrentRequest = (requestId) => requestId === requestNumber;

function handleFavorite(movie) {
  state.toggleFavorite(movie);
  catalogController.refreshFavoriteCount();

  if (detailsController.isShowing(movie.id)) {
    detailsController.refreshCurrentDetails();
  } else {
    catalogController.renderCurrentResults();
  }
}

detailsController = createDetailsController({
  getBackLabel: () => catalogController.getBackLabel(),
  renderCurrentResults: () => catalogController.renderCurrentResults(),
  onFavorite: handleFavorite,
  isFavorite: state.isFavorite,
  nextRequest,
  isCurrentRequest,
});

catalogController = createCatalogController({
  onDetails: (selection) => detailsController.showDetails(selection),
  onFavorite: handleFavorite,
  resetDetails: detailsController.reset,
  nextRequest,
  isCurrentRequest,
});

initializeTheme();
detailsController.initialize();
catalogController.initialize();
