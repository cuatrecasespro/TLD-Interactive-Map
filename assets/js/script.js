import { mapTransitions, TRANSITION_SIZE } from "./transitions.js";

const DIFFICULTIES = new Set(["pilgrim", "voyageur", "stalker", "interloper", "misery"]);
const MAP_CATEGORIES = {
  pilgrim: "pilgrim",
  voyageur: "pilgrim",
  stalker: "pilgrim",
  interloper: "interloper",
  misery: "interloper"
};
const STORAGE_KEY = "tld-map:difficulty";
const HOTSPOT_STORAGE_KEY = "tld-map:home-hotspot-style";
const PLAYER_POSITION_STORAGE_KEY = "tld-map:player-positions";
const ORIENTATION_STORAGE_KEY = "tld-map:orientation";
const LAST_VIEW_STORAGE_KEY = "tld-map:last-view";
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const PAN_STEP = 80;

const elements = {
  homeView: document.querySelector("#home-view"), mapView: document.querySelector("#map-view"),
  homeStage: document.querySelector("#home-map-stage"), homeImage: document.querySelector("#start-map-image"), homeHotspots: document.querySelector("#home-map-hotspots"), viewport: document.querySelector("#map-viewport"),
  image: document.querySelector("#region-image"), playerMarker: document.querySelector("#player-marker"), loading: document.querySelector("#loading"), error: document.querySelector("#map-error"),
  retry: document.querySelector("#retry-button"), worldBrand: document.querySelector("#world-brand"), locationButton: document.querySelector("#location-button"), title: document.querySelector("#map-title"), difficultyButton: document.querySelector("#difficulty-button"), difficultyStatus: document.querySelector("#difficulty-status"), status: document.querySelector("#app-status"),
  mobileControlsButton: document.querySelector("#mobile-controls-button"), mobileControlsPanel: document.querySelector("#mobile-controls-panel"),
  zoomControls: document.querySelector("#zoom-controls"),
  zoomIn: document.querySelector("#zoom-in"), zoomOut: document.querySelector("#zoom-out"), zoomReset: document.querySelector("#zoom-reset"), hotspotControl: document.querySelector("#hotspot-control"), hotspotToggle: document.querySelector("#hotspot-toggle"), hotspotOptions: document.querySelector("#hotspot-options"), hotspotButtons: [...document.querySelectorAll("[data-hotspot-style]")],
  playerControl: document.querySelector("#player-control"), playerToggle: document.querySelector("#player-toggle"), playerLocate: document.querySelector("#player-locate"), playerClear: document.querySelector("#player-clear"),
  orientationControl: document.querySelector("#orientation-control"), orientationInput: document.querySelector("#orientation-input"), orientationValue: document.querySelector("#orientation-value"), orientationReset: document.querySelector("#orientation-reset"),
  regions: document.querySelector("#regions-panel"), regionsClose: document.querySelector("#regions-close"), worldRegion: document.querySelector("#world-region-button"), regionSearch: document.querySelector("#region-search"), regionList: document.querySelector("#region-list"), regionResultsCount: document.querySelector("#region-results-count"),
  creditsButton: document.querySelector("#credits-button"), credits: document.querySelector("#credits-panel"), creditsClose: document.querySelector("#credits-close"),
  difficultyPanel: document.querySelector("#difficulty-panel"), difficultyClose: document.querySelector("#difficulty-close"),
  difficultyButtons: [...document.querySelectorAll("[data-difficulty]")], transitionMenu: document.querySelector("#transition-menu"),
  install: document.querySelector("#install-button"), installDialog: document.querySelector("#install-dialog"),
  installInstructions: document.querySelector("#install-instructions"), installClose: document.querySelector("#install-close"), nativeInstall: document.querySelector("#native-install-button"),
  updateNotice: document.querySelector("#update-notice"), updateApp: document.querySelector("#update-app-button")
};

const state = {
  maps: null, mapId: null, difficulty: readDifficulty(),
  zoom: 1, panX: 0, panY: 0, requestId: 0, pointer: null, pointers: new Map(), pinch: null,
  homeZoom: 1, homePanX: 0, homePanY: 0, homePointer: null, homePointers: new Map(), homePinch: null, homeHotspotStyle: readHotspotStyle(),
  playerPositions: readPlayerPositions(), isPlacingPlayer: false, playerPointer: null, playerDragPosition: null, orientation: readOrientation()
};
let deferredInstallPrompt = null;
let viewportSyncFrame = 0;
let updateRegistration = null;
let reloadForUpdate = false;
const compactControlsQuery = window.matchMedia("(max-width: 600px)");

function readDifficulty() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return DIFFICULTIES.has(value) ? value : "pilgrim";
  } catch {
    return "pilgrim";
  }
}

function saveDifficulty() {
  try { localStorage.setItem(STORAGE_KEY, state.difficulty); } catch { /* Storage is optional. */ }
}

function readHotspotStyle() {
  try {
    const style = localStorage.getItem(HOTSPOT_STORAGE_KEY);
    if (["green", "white", "none"].includes(style)) return style;
    return localStorage.getItem("tld-map:home-hotspots") === "on" ? "white" : "none";
  } catch { return "none"; }
}

function readPlayerPositions() {
  try {
    const positions = JSON.parse(localStorage.getItem(PLAYER_POSITION_STORAGE_KEY));
    if (!positions || typeof positions !== "object" || Array.isArray(positions)) return {};
    return Object.fromEntries(Object.entries(positions).filter(([, position]) => Number.isFinite(position?.x) && Number.isFinite(position?.y) && position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1));
  } catch { return {}; }
}

function savePlayerPositions() {
  try { localStorage.setItem(PLAYER_POSITION_STORAGE_KEY, JSON.stringify(state.playerPositions)); } catch { /* Storage is optional. */ }
}

function readOrientation() {
  try {
    const orientation = Number(localStorage.getItem(ORIENTATION_STORAGE_KEY));
    return Number.isInteger(orientation) && orientation >= 0 && orientation < 360 ? orientation : 0;
  } catch { return 0; }
}

function saveOrientation() {
  try { localStorage.setItem(ORIENTATION_STORAGE_KEY, String(state.orientation)); } catch { /* Storage is optional. */ }
}

function readLastView() {
  try {
    const view = JSON.parse(localStorage.getItem(LAST_VIEW_STORAGE_KEY));
    return typeof view?.mapId === "string" && DIFFICULTIES.has(view.difficulty) ? view : null;
  } catch { return null; }
}

function saveLastView() {
  if (!state.mapId) return;
  try { localStorage.setItem(LAST_VIEW_STORAGE_KEY, JSON.stringify({ mapId: state.mapId, difficulty: state.difficulty })); } catch { /* Storage is optional. */ }
}

function closeHotspotOptions() {
  elements.hotspotOptions.hidden = true;
  elements.hotspotToggle.setAttribute("aria-expanded", "false");
}

function toggleHotspotOptions() {
  const open = elements.hotspotOptions.hidden;
  elements.hotspotOptions.hidden = !open;
  elements.hotspotToggle.setAttribute("aria-expanded", String(open));
}

function setHomeHotspotStyle(style, { announceChange = false } = {}) {
  if (!["green", "white", "none"].includes(style)) return;
  state.homeHotspotStyle = style;
  elements.homeHotspots.hidden = style === "none";
  elements.homeHotspots.dataset.style = style;
  elements.hotspotButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hotspotStyle === style)));
  closeHotspotOptions();
  try { localStorage.setItem(HOTSPOT_STORAGE_KEY, style); } catch { /* Storage is optional. */ }
  if (announceChange) announce(`Clickable region hints set to ${style}.`);
}

function labelFor(id) {
  return id.split("-").map((word) => word === "&" ? word : `${word[0].toUpperCase()}${word.slice(1)}`).join(" ");
}

function announce(message) { elements.status.textContent = message; }

function difficultyLabel() {
  return `${state.difficulty[0].toUpperCase()}${state.difficulty.slice(1)}`;
}

function mapCategory() {
  return MAP_CATEGORIES[state.difficulty];
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
}

function installInstructions() {
  const userAgent = navigator.userAgent;
  const isiOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isiOS && /CriOS|FxiOS|EdgiOS/i.test(userAgent)) return "Use the Share button in the browser, then choose Add to Home Screen. iPhone and iPad install web apps through the system share sheet.";
  if (isiOS) return "Tap the Share button, then scroll down and choose Add to Home Screen. Confirm Add to install it as an app.";
  if (/SamsungBrowser/i.test(userAgent)) return "Open the browser menu, choose Add page to, then select Home screen.";
  if (/Firefox/i.test(userAgent) && /Android/i.test(userAgent)) return "Open the browser menu and choose Add to Home screen.";
  if (/Android/i.test(userAgent)) return "Open the browser menu (three dots), then choose Install app or Add to Home screen and confirm.";
  return "Use your browser menu and choose Install app or Add to Home screen.";
}

function updateInstallButton() {
  elements.install.hidden = !isMobileDevice() || isStandalone();
}

function showAppUpdate(registration) {
  if (!isStandalone()) return;
  updateRegistration = registration;
  elements.updateNotice.hidden = false;
  announce("New version available. Activate the update to continue.");
}

function watchForAppUpdate(registration) {
  const watchWorker = (worker) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) showAppUpdate(registration);
    });
  };
  if (registration.waiting) showAppUpdate(registration);
  if (registration.installing) watchWorker(registration.installing);
  registration.addEventListener("updatefound", () => registration.installing && watchWorker(registration.installing));
}

function openInstallDialog() {
  elements.installInstructions.textContent = installInstructions();
  elements.nativeInstall.hidden = !deferredInstallPrompt;
  if (!elements.installDialog.open) elements.installDialog.showModal();
}

function routeFromHash() {
  const rawHash = location.hash.slice(1);
  // Preserve links created by the previous version of the site.
  if (rawHash && !rawHash.startsWith("map=") && !rawHash.startsWith("difficulty=")) return { mapId: rawHash, difficulty: null };
  const params = new URLSearchParams(rawHash);
  const mapId = params.get("map");
  const difficulty = params.get("difficulty");
  return { mapId, difficulty: DIFFICULTIES.has(difficulty) ? difficulty : null };
}

function writeRoute(mode = "replace") {
  const params = new URLSearchParams({ difficulty: state.difficulty });
  if (state.mapId) params.set("map", state.mapId);
  const url = `${location.pathname}${location.search}#${params}`;
  history[`${mode}State`]({ mapId: state.mapId, difficulty: state.difficulty }, "", url);
}

function updateDifficultyControls() {
  elements.difficultyButtons.forEach((button) => {
    const selected = button.dataset.difficulty === state.difficulty;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-current", String(selected));
  });
  elements.difficultyStatus.textContent = difficultyLabel();
  elements.difficultyButton.setAttribute("aria-label", `Change map difficulty, currently ${difficultyLabel()}`);
}

function updateZoomControls() {
  const zoom = state.mapId ? state.zoom : state.homeZoom;
  const percentage = Math.round(zoom * 100);
  elements.zoomReset.textContent = `${percentage}%`;
  elements.zoomReset.setAttribute("aria-label", `Reset zoom, currently ${percentage} percent`);
  elements.zoomOut.disabled = zoom <= MIN_ZOOM;
  elements.zoomIn.disabled = zoom >= MAX_ZOOM;
}

function updateRegionSelection() {
  elements.regionList.querySelectorAll("button[data-map]").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.map === state.mapId));
  });
}

function renderRegionList(query = "") {
  const normalizedQuery = query.trim().toLowerCase();
  const regionIds = [...new Set([...document.querySelectorAll("area[data-map]")].map((area) => area.dataset.map))]
    .filter((id) => state.maps[id])
    .sort((first, second) => labelFor(first).localeCompare(labelFor(second)));
  const matches = regionIds.filter((id) => labelFor(id).toLowerCase().includes(normalizedQuery));
  elements.regionResultsCount.textContent = normalizedQuery ? `${matches.length} ${matches.length === 1 ? "result" : "results"}` : `${matches.length} regions`;
  elements.regionList.replaceChildren(...matches
    .map((id) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.map = id;
      button.textContent = labelFor(id);
      button.setAttribute("aria-current", String(id === state.mapId));
      button.addEventListener("click", () => {
        closeRegions();
        navigate(id);
      });
      item.append(button);
      return item;
    }));
}

function closeCredits() {
  elements.credits.hidden = true;
  elements.creditsButton.setAttribute("aria-expanded", "false");
}

function closeDifficulty() {
  elements.difficultyPanel.hidden = true;
  elements.difficultyButton.setAttribute("aria-expanded", "false");
}

function closeRegions() {
  elements.regions.classList.remove("is-searching");
  elements.regions.hidden = true;
  elements.locationButton.setAttribute("aria-expanded", "false");
}

function closeMobileControls() {
  elements.mobileControlsPanel.hidden = true;
  elements.mobileControlsButton.setAttribute("aria-expanded", "false");
}

function syncMobileControls() {
  if (compactControlsQuery.matches) {
    elements.mobileControlsPanel.append(elements.zoomControls, elements.playerControl, elements.orientationControl);
    elements.mobileControlsButton.hidden = false;
    if (!state.mapId) closeMobileControls();
    return;
  }
  elements.controls.prepend(elements.zoomControls);
  elements.regions.before(elements.playerControl, elements.orientationControl);
  elements.mobileControlsButton.hidden = true;
  closeMobileControls();
}

function toggleMobileControls() {
  const open = elements.mobileControlsPanel.hidden;
  elements.mobileControlsPanel.hidden = !open;
  elements.mobileControlsButton.setAttribute("aria-expanded", String(open));
}

function setRegionSearchActive(active) {
  elements.regions.classList.toggle("is-searching", active);
  if (active) scheduleViewportSync();
}

function openCredits() {
  closeRegions();
  closeDifficulty();
  elements.credits.hidden = false;
  elements.creditsButton.setAttribute("aria-expanded", "true");
  elements.creditsClose.focus();
}

function openDifficulty() {
  closeRegions();
  closeCredits();
  elements.difficultyPanel.hidden = false;
  elements.difficultyButton.setAttribute("aria-expanded", "true");
  elements.difficultyClose.focus();
}

function toggleRegions() {
  const open = elements.regions.hidden;
  if (open) {
    closeCredits();
    closeDifficulty();
    elements.regions.hidden = false;
    elements.locationButton.setAttribute("aria-expanded", "true");
    elements.regionSearch.focus();
  } else {
    closeRegions();
  }
}

function resetView() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyTransform();
  updateZoomControls();
}

function panBy(x, y) {
  state.panX += x;
  state.panY += y;
  applyTransform();
}

function clampPan() {
  const angle = state.orientation * Math.PI / 180;
  const imageWidth = elements.image.clientWidth * state.zoom;
  const imageHeight = elements.image.clientHeight * state.zoom;
  const width = Math.abs(imageWidth * Math.cos(angle)) + Math.abs(imageHeight * Math.sin(angle));
  const height = Math.abs(imageWidth * Math.sin(angle)) + Math.abs(imageHeight * Math.cos(angle));
  const maxX = Math.max(0, (width - elements.viewport.clientWidth) / 2);
  const maxY = Math.max(0, (height - elements.viewport.clientHeight) / 2);
  state.panX = Math.min(maxX, Math.max(-maxX, state.panX));
  state.panY = Math.min(maxY, Math.max(-maxY, state.panY));
}

function applyTransform() {
  clampPan();
  elements.image.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom}) rotate(${state.orientation}deg)`;
  renderPlayerMarker();
}

function mapPointAt(clientX, clientY) {
  const imageRect = elements.image.getBoundingClientRect();
  if (!imageRect.width || !elements.image.clientWidth || !elements.image.clientHeight) return null;
  const angle = state.orientation * Math.PI / 180;
  const x = clientX - (imageRect.left + imageRect.width / 2);
  const y = clientY - (imageRect.top + imageRect.height / 2);
  const unrotatedX = (x * Math.cos(angle) + y * Math.sin(angle)) / state.zoom;
  const unrotatedY = (-x * Math.sin(angle) + y * Math.cos(angle)) / state.zoom;
  return {
    x: unrotatedX / elements.image.clientWidth + .5,
    y: unrotatedY / elements.image.clientHeight + .5
  };
}

function setOrientation(orientation, { announceChange = false } = {}) {
  state.orientation = ((Math.round(orientation) % 360) + 360) % 360;
  saveOrientation();
  fitMapImage();
  applyTransform();
  updatePlayerControls();
  if (announceChange) announce(`Map rotated to ${state.orientation} degrees.`);
}

function updatePlayerControls() {
  const hasPosition = Boolean(state.mapId && state.playerPositions[state.mapId]);
  elements.playerControl.hidden = !state.mapId;
  elements.playerToggle.textContent = state.isPlacingPlayer ? "Cancel placement" : hasPosition ? "Move character" : "Place character";
  elements.playerToggle.setAttribute("aria-pressed", String(state.isPlacingPlayer));
  elements.playerLocate.hidden = !hasPosition;
  elements.playerClear.hidden = !hasPosition;
  elements.orientationControl.hidden = !state.mapId;
  elements.orientationInput.value = String(state.orientation);
  elements.orientationValue.value = `${state.orientation}°`;
  elements.orientationValue.textContent = `${state.orientation}°`;
  elements.orientationReset.disabled = state.orientation === 0;
}

function renderPlayerMarker() {
  const position = state.playerDragPosition ?? state.playerPositions[state.mapId];
  const imageRect = elements.image.getBoundingClientRect();
  if (!position || !imageRect.width || !imageRect.height || elements.image.hidden) {
    elements.playerMarker.hidden = true;
    return;
  }
  const angle = state.orientation * Math.PI / 180;
  const x = (position.x - .5) * elements.image.clientWidth * state.zoom;
  const y = (position.y - .5) * elements.image.clientHeight * state.zoom;
  elements.playerMarker.style.left = `${imageRect.left + imageRect.width / 2 + x * Math.cos(angle) - y * Math.sin(angle)}px`;
  elements.playerMarker.style.top = `${imageRect.top + imageRect.height / 2 + x * Math.sin(angle) + y * Math.cos(angle)}px`;
  elements.playerMarker.hidden = false;
}

function placePlayerPosition(clientX, clientY, { persist = true } = {}) {
  const point = mapPointAt(clientX, clientY);
  if (!state.mapId || !point) return false;
  const position = {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y))
  };
  if (persist) {
    state.playerPositions[state.mapId] = position;
    savePlayerPositions();
    updatePlayerControls();
  } else {
    state.playerDragPosition = position;
  }
  renderPlayerMarker();
  return true;
}

function togglePlayerPlacement() {
  state.isPlacingPlayer = !state.isPlacingPlayer;
  updatePlayerControls();
  announce(state.isPlacingPlayer ? "Choose a point on the map for your character." : "Character placement cancelled.");
}

function clearPlayerPosition() {
  if (!state.mapId) return;
  state.playerDragPosition = null;
  delete state.playerPositions[state.mapId];
  savePlayerPositions();
  renderPlayerMarker();
  updatePlayerControls();
  announce("Character position cleared.");
}

function focusPlayerPosition() {
  if (!state.mapId || !state.playerPositions[state.mapId] || elements.playerMarker.hidden) return;
  const viewportRect = elements.viewport.getBoundingClientRect();
  const markerRect = elements.playerMarker.getBoundingClientRect();
  state.panX += viewportRect.left + viewportRect.width / 2 - (markerRect.left + markerRect.width / 2);
  state.panY += viewportRect.top + viewportRect.height / 2 - (markerRect.top + markerRect.height);
  applyTransform();
  elements.playerMarker.focus({ preventScroll: true });
  announce("Centered on character position.");
}

function fitMapImage() {
  if (!elements.image.naturalWidth || !elements.viewport.clientWidth || !elements.viewport.clientHeight) return;
  const angle = state.orientation * Math.PI / 180;
  const rotatedWidth = elements.image.naturalWidth * Math.abs(Math.cos(angle)) + elements.image.naturalHeight * Math.abs(Math.sin(angle));
  const rotatedHeight = elements.image.naturalWidth * Math.abs(Math.sin(angle)) + elements.image.naturalHeight * Math.abs(Math.cos(angle));
  const scale = Math.min(
    elements.viewport.clientWidth / rotatedWidth,
    elements.viewport.clientHeight / rotatedHeight
  );
  elements.image.style.width = `${Math.floor(elements.image.naturalWidth * scale)}px`;
  elements.image.style.height = `${Math.floor(elements.image.naturalHeight * scale)}px`;
}

function fitHomeImage() {
  if (!elements.homeImage.naturalWidth || !elements.homeView.clientWidth || !elements.homeView.clientHeight) return;
  const scale = Math.min(
    elements.homeView.clientWidth / elements.homeImage.naturalWidth,
    elements.homeView.clientHeight / elements.homeImage.naturalHeight
  );
  elements.homeImage.style.width = `${Math.floor(elements.homeImage.naturalWidth * scale)}px`;
  elements.homeImage.style.height = `${Math.floor(elements.homeImage.naturalHeight * scale)}px`;
  elements.homeStage.style.width = elements.homeImage.style.width;
  elements.homeStage.style.height = elements.homeImage.style.height;
  syncHomeHotspots();
}

function syncViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
}

function refreshMapLayout() {
  scaleHomeAreas();
  updateInstallButton();
  fitHomeImage();
  applyHomeTransform();
  if (state.mapId) {
    fitMapImage();
    applyTransform();
  }
}

function scheduleViewportSync() {
  cancelAnimationFrame(viewportSyncFrame);
  viewportSyncFrame = requestAnimationFrame(() => {
    syncViewportHeight();
    refreshMapLayout();
  });
}

function syncHomeHotspots() {
  const image = elements.homeImage;
  if (!image.naturalWidth) return;
  elements.homeHotspots.style.width = `${image.clientWidth}px`;
  elements.homeHotspots.style.height = `${image.clientHeight}px`;
  elements.homeHotspots.replaceChildren(...[...document.querySelectorAll("area[data-map]")].map((area) => {
    const [left, top, right, bottom] = (area.dataset.originalCoords ?? area.getAttribute("coords")).split(",").map(Number);
    const hotspot = document.createElement("span");
    hotspot.className = "home-map-hotspot";
    hotspot.style.left = `${left / image.naturalWidth * 100}%`;
    hotspot.style.top = `${top / image.naturalHeight * 100}%`;
    hotspot.style.width = `${(right - left) / image.naturalWidth * 100}%`;
    hotspot.style.height = `${(bottom - top) / image.naturalHeight * 100}%`;
    return hotspot;
  }));
}

function clampHomePan() {
  const width = elements.homeImage.clientWidth * state.homeZoom;
  const height = elements.homeImage.clientHeight * state.homeZoom;
  const maxX = Math.max(0, (width - elements.homeView.clientWidth) / 2);
  const maxY = Math.max(0, (height - elements.homeView.clientHeight) / 2);
  state.homePanX = Math.min(maxX, Math.max(-maxX, state.homePanX));
  state.homePanY = Math.min(maxY, Math.max(-maxY, state.homePanY));
}

function applyHomeTransform() {
  clampHomePan();
  const transform = `translate(${state.homePanX}px, ${state.homePanY}px) scale(${state.homeZoom})`;
  elements.homeStage.style.transform = transform;
}

function resetHomeView() {
  state.homeZoom = 1;
  state.homePanX = 0;
  state.homePanY = 0;
  applyHomeTransform();
  updateZoomControls();
}

function panHomeBy(x, y) {
  state.homePanX += x;
  state.homePanY += y;
  applyHomeTransform();
}

function setHomeZoom(nextZoom, clientX, clientY) {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  if (zoom === state.homeZoom) return;
  const rect = elements.homeView.getBoundingClientRect();
  const x = clientX ?? rect.left + rect.width / 2;
  const y = clientY ?? rect.top + rect.height / 2;
  const relativeX = (x - (rect.left + rect.width / 2) - state.homePanX) / state.homeZoom;
  const relativeY = (y - (rect.top + rect.height / 2) - state.homePanY) / state.homeZoom;
  state.homeZoom = zoom;
  state.homePanX = x - (rect.left + rect.width / 2) - relativeX * zoom;
  state.homePanY = y - (rect.top + rect.height / 2) - relativeY * zoom;
  applyHomeTransform();
  updateZoomControls();
}

function homeMapAt(clientX, clientY) {
  const rect = elements.homeImage.getBoundingClientRect();
  if (!rect.width || !elements.homeImage.naturalWidth) return null;
  const x = (clientX - rect.left) / (rect.width / elements.homeImage.naturalWidth);
  const y = (clientY - rect.top) / (rect.height / elements.homeImage.naturalHeight);
  return [...document.querySelectorAll("area[data-map]")].find((area) => {
    const coords = (area.dataset.originalCoords ?? area.getAttribute("coords")).split(",").map(Number);
    return x >= coords[0] && x <= coords[2] && y >= coords[1] && y <= coords[3];
  });
}

function setZoom(nextZoom, clientX, clientY) {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  if (zoom === state.zoom) return;
  const rect = elements.viewport.getBoundingClientRect();
  const x = clientX ?? rect.left + rect.width / 2;
  const y = clientY ?? rect.top + rect.height / 2;
  const relativeX = (x - (rect.left + rect.width / 2) - state.panX) / state.zoom;
  const relativeY = (y - (rect.top + rect.height / 2) - state.panY) / state.zoom;
  state.zoom = zoom;
  state.panX = x - (rect.left + rect.width / 2) - relativeX * zoom;
  state.panY = y - (rect.top + rect.height / 2) - relativeY * zoom;
  applyTransform();
  updateZoomControls();
}

function hideTransitionMenu() { elements.transitionMenu.hidden = true; elements.transitionMenu.replaceChildren(); }

function showTransitionMenu(targets, clientX, clientY) {
  elements.transitionMenu.replaceChildren();
  targets.forEach((target) => {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "menuitem";
    button.textContent = `To ${labelFor(target)}`;
    button.addEventListener("click", () => navigate(target));
    elements.transitionMenu.append(button);
  });
  elements.transitionMenu.hidden = false;
  const margin = 8;
  const rect = elements.transitionMenu.getBoundingClientRect();
  elements.transitionMenu.style.left = `${Math.min(innerWidth - rect.width - margin, Math.max(margin, clientX))}px`;
  elements.transitionMenu.style.top = `${Math.min(innerHeight - rect.height - margin, Math.max(margin, clientY))}px`;
  elements.transitionMenu.querySelector("button").focus();
}

function transitionAt(clientX, clientY) {
  const point = mapPointAt(clientX, clientY);
  if (!elements.image.naturalWidth || !point || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
  const x = point.x * elements.image.naturalWidth;
  const y = point.y * elements.image.naturalHeight;
  return mapTransitions[state.mapId]?.find((transition) => x >= transition.x && x <= transition.x + TRANSITION_SIZE && y >= transition.y && y <= transition.y + TRANSITION_SIZE);
}

function activateTransition(clientX, clientY) {
  const transition = transitionAt(clientX, clientY);
  if (!transition) return;
  if (transition.target) navigate(transition.target);
  else showTransitionMenu(transition.targets, clientX, clientY);
}

function preloadAdjacentMaps() {
  mapTransitions[state.mapId]?.flatMap((transition) => transition.targets ?? [transition.target]).forEach((id) => {
    const url = state.maps[id]?.[mapCategory()];
    if (url) new Image().src = url;
  });
}

function showHome({ route = "push" } = {}) {
  state.mapId = null;
  state.playerDragPosition = null;
  state.requestId += 1;
  hideTransitionMenu();
  closeRegions();
  closeCredits();
  closeDifficulty();
  elements.mapView.hidden = true;
  elements.homeView.hidden = false;
  elements.zoomControls.hidden = false;
  elements.hotspotControl.hidden = false;
  state.isPlacingPlayer = false;
  updatePlayerControls();
  syncMobileControls();
  renderPlayerMarker();
  fitHomeImage();
  resetHomeView();
  elements.title.textContent = "Choose a region";
  elements.locationButton.setAttribute("aria-label", "Choose a region");
  updateRegionSelection();
  if (route) writeRoute(route);
}

function loadImage(url, mapId) {
  const requestId = ++state.requestId;
  elements.error.hidden = true;
  elements.loading.hidden = false;
  elements.image.hidden = true;
  elements.playerMarker.hidden = true;
  elements.viewport.classList.remove("is-ready");
  elements.image.alt = `${labelFor(mapId)} map for ${difficultyLabel()} difficulty`;
  elements.image.onload = async () => {
    if (requestId !== state.requestId) return;
    try { await elements.image.decode(); } catch { /* The loaded image is still usable. */ }
    if (requestId !== state.requestId) return;
    elements.loading.hidden = true;
    elements.image.hidden = false;
    elements.viewport.classList.add("is-ready");
    fitMapImage();
    resetView();
    renderPlayerMarker();
    preloadAdjacentMaps();
    elements.viewport.focus({ preventScroll: true });
    announce(`${labelFor(mapId)} loaded.`);
  };
  elements.image.onerror = () => {
    if (requestId !== state.requestId) return;
    elements.loading.hidden = true;
    elements.error.hidden = false;
    announce(`Unable to load ${labelFor(mapId)}.`);
  };
  elements.image.src = url;
}

function navigate(mapId, { route = "push" } = {}) {
  const url = state.maps?.[mapId]?.[mapCategory()];
  if (!url) {
    announce(`No ${difficultyLabel()} map is available for ${labelFor(mapId)}.`);
    return;
  }
  state.mapId = mapId;
  state.playerDragPosition = null;
  saveLastView();
  closeMobileControls();
  hideTransitionMenu();
  elements.homeView.hidden = true;
  elements.mapView.hidden = false;
  elements.zoomControls.hidden = false;
  elements.hotspotControl.hidden = true;
  state.isPlacingPlayer = false;
  updatePlayerControls();
  syncMobileControls();
  closeHotspotOptions();
  elements.title.textContent = labelFor(mapId);
  elements.locationButton.setAttribute("aria-label", `Choose a region, currently ${labelFor(mapId)}`);
  updateRegionSelection();
  if (route) writeRoute(route);
  loadImage(url, mapId);
}

function setDifficulty(difficulty, { route = "replace" } = {}) {
  if (!DIFFICULTIES.has(difficulty)) return;
  state.difficulty = difficulty;
  saveDifficulty();
  updateDifficultyControls();
  if (state.mapId) navigate(state.mapId, { route });
  else if (route) writeRoute(route);
  announce(`Difficulty set to ${difficultyLabel()}.`);
}

function scaleHomeAreas() {
  const image = elements.homeImage;
  if (!image.naturalWidth) return;
  const scaleX = image.clientWidth / image.naturalWidth;
  const scaleY = image.clientHeight / image.naturalHeight;
  document.querySelectorAll("area[data-map]").forEach((area) => {
    const original = (area.dataset.originalCoords ??= area.coords).split(",").map(Number);
    area.coords = original.map((value, index) => Math.round(value * (index % 2 ? scaleY : scaleX))).join(",");
  });
}

function bindEvents() {
  document.querySelectorAll("area[data-map]").forEach((area) => area.addEventListener("click", (event) => { event.preventDefault(); navigate(area.dataset.map); }));
  elements.difficultyButtons.forEach((button) => button.addEventListener("click", () => setDifficulty(button.dataset.difficulty)));
  elements.worldBrand.addEventListener("click", () => showHome());
  elements.worldRegion.addEventListener("click", () => showHome());
  elements.locationButton.addEventListener("click", toggleRegions);
  elements.mobileControlsButton.addEventListener("click", toggleMobileControls);
  elements.difficultyButton.addEventListener("click", openDifficulty);
  elements.retry.addEventListener("click", () => state.mapId && navigate(state.mapId, { route: false }));
  elements.zoomIn.addEventListener("click", () => state.mapId ? setZoom(state.zoom + ZOOM_STEP) : setHomeZoom(state.homeZoom + ZOOM_STEP));
  elements.zoomOut.addEventListener("click", () => state.mapId ? setZoom(state.zoom - ZOOM_STEP) : setHomeZoom(state.homeZoom - ZOOM_STEP));
  elements.zoomReset.addEventListener("click", () => state.mapId ? resetView() : resetHomeView());
  elements.hotspotToggle.addEventListener("click", toggleHotspotOptions);
  elements.hotspotButtons.forEach((button) => button.addEventListener("click", () => setHomeHotspotStyle(button.dataset.hotspotStyle, { announceChange: true })));
  elements.playerToggle.addEventListener("click", togglePlayerPlacement);
  elements.playerLocate.addEventListener("click", focusPlayerPosition);
  elements.playerClear.addEventListener("click", clearPlayerPosition);
  elements.orientationInput.addEventListener("input", () => setOrientation(Number(elements.orientationInput.value)));
  elements.orientationInput.addEventListener("change", () => announce(`Map rotated to ${state.orientation} degrees.`));
  elements.orientationReset.addEventListener("click", () => setOrientation(0, { announceChange: true }));
  elements.mobileControlsPanel.addEventListener("click", (event) => {
    if (!elements.orientationControl.contains(event.target)) closeMobileControls();
  });
  elements.regionsClose.addEventListener("click", closeRegions);
  elements.regionSearch.addEventListener("focus", () => setRegionSearchActive(true));
  elements.regionSearch.addEventListener("blur", () => setRegionSearchActive(false));
  elements.regionSearch.addEventListener("input", () => renderRegionList(elements.regionSearch.value));
  elements.install.addEventListener("click", openInstallDialog);
  elements.updateApp.addEventListener("click", () => {
    if (!updateRegistration?.waiting) return;
    reloadForUpdate = true;
    elements.updateApp.disabled = true;
    updateRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  });
  elements.installClose.addEventListener("click", () => elements.installDialog.close());
  elements.nativeInstall.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    elements.nativeInstall.hidden = true;
    elements.installDialog.close();
    updateInstallButton();
  });
  elements.creditsButton.addEventListener("click", () => {
    if (elements.credits.hidden) openCredits();
    else closeCredits();
  });
  elements.creditsClose.addEventListener("click", closeCredits);
  elements.difficultyClose.addEventListener("click", closeDifficulty);
  document.addEventListener("pointerdown", (event) => {
    if (!elements.credits.hidden && !elements.credits.contains(event.target) && event.target !== elements.creditsButton) {
      closeCredits();
    }
    if (!elements.difficultyPanel.hidden && !elements.difficultyPanel.contains(event.target) && event.target !== elements.difficultyButton) {
      closeDifficulty();
    }
    if (!elements.regions.hidden && !elements.regions.contains(event.target) && event.target !== elements.locationButton) {
      closeRegions();
    }
    if (!elements.hotspotOptions.hidden && !elements.hotspotControl.contains(event.target)) closeHotspotOptions();
    if (!elements.transitionMenu.hidden && !elements.transitionMenu.contains(event.target)) hideTransitionMenu();
    if (!elements.mobileControlsPanel.hidden && !elements.mobileControlsPanel.contains(event.target) && event.target !== elements.mobileControlsButton) closeMobileControls();
  });
  elements.homeView.addEventListener("wheel", (event) => {
    event.preventDefault();
    setHomeZoom(state.homeZoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY);
  }, { passive: false });
  elements.homeView.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    elements.homeView.focus({ preventScroll: true });
    elements.homeView.setPointerCapture(event.pointerId);
    state.homePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.homePointers.size === 2) {
      const [first, second] = [...state.homePointers.values()];
      state.homePinch = { distance: Math.hypot(second.x - first.x, second.y - first.y), zoom: state.homeZoom };
      state.homePointer = null;
    } else {
      state.homePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: state.homePanX, panY: state.homePanY, moved: false };
    }
    elements.homeView.classList.add("is-dragging");
  });
  elements.homeView.addEventListener("pointermove", (event) => {
    if (!state.homePointers.has(event.pointerId)) return;
    state.homePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.homePinch && state.homePointers.size === 2) {
      const [first, second] = [...state.homePointers.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      setHomeZoom(state.homePinch.zoom * (distance / state.homePinch.distance), (first.x + second.x) / 2, (first.y + second.y) / 2);
      return;
    }
    if (!state.homePointer || event.pointerId !== state.homePointer.id) return;
    const dx = event.clientX - state.homePointer.x;
    const dy = event.clientY - state.homePointer.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) state.homePointer.moved = true;
    state.homePanX = state.homePointer.panX + dx;
    state.homePanY = state.homePointer.panY + dy;
    applyHomeTransform();
  });
  elements.homeView.addEventListener("pointerup", (event) => {
    state.homePointers.delete(event.pointerId);
    if (state.homePinch) {
      state.homePinch = null;
      const [remainingId, remaining] = [...state.homePointers.entries()][0] ?? [];
      state.homePointer = remaining ? { id: remainingId, x: remaining.x, y: remaining.y, panX: state.homePanX, panY: state.homePanY, moved: true } : null;
      if (!remaining) elements.homeView.classList.remove("is-dragging");
      return;
    }
    if (!state.homePointer || event.pointerId !== state.homePointer.id) return;
    const pointer = state.homePointer;
    state.homePointer = null;
    elements.homeView.classList.remove("is-dragging");
    if (!pointer.moved) {
      const area = homeMapAt(event.clientX, event.clientY);
      if (area) navigate(area.dataset.map);
    }
  });
  elements.homeView.addEventListener("pointercancel", (event) => {
    state.homePointers.delete(event.pointerId);
    state.homePointer = null;
    state.homePinch = null;
    elements.homeView.classList.remove("is-dragging");
  });
  elements.homeView.addEventListener("dragstart", (event) => event.preventDefault());
  elements.homeView.addEventListener("selectstart", (event) => event.preventDefault());
  elements.homeView.addEventListener("contextmenu", (event) => event.preventDefault());
  elements.viewport.addEventListener("wheel", (event) => { event.preventDefault(); setZoom(state.zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY); }, { passive: false });
  elements.viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (state.isPlacingPlayer) {
      event.preventDefault();
      if (placePlayerPosition(event.clientX, event.clientY)) {
        state.isPlacingPlayer = false;
        updatePlayerControls();
        announce("Character position saved.");
      }
      return;
    }
    event.preventDefault();
    hideTransitionMenu();
    elements.viewport.setPointerCapture(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size === 2) {
      const [first, second] = [...state.pointers.values()];
      state.pinch = { distance: Math.hypot(second.x - first.x, second.y - first.y), zoom: state.zoom };
      state.pointer = null;
    } else {
      state.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY, moved: false };
    }
    elements.viewport.classList.add("is-dragging");
  });
  elements.viewport.addEventListener("pointermove", (event) => {
    if (!state.pointers.has(event.pointerId)) return;
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pinch && state.pointers.size === 2) {
      const [first, second] = [...state.pointers.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      setZoom(state.pinch.zoom * (distance / state.pinch.distance), (first.x + second.x) / 2, (first.y + second.y) / 2);
      return;
    }
    if (!state.pointer || event.pointerId !== state.pointer.id) return;
    event.preventDefault();
    const dx = event.clientX - state.pointer.x;
    const dy = event.clientY - state.pointer.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) state.pointer.moved = true;
    state.panX = state.pointer.panX + dx;
    state.panY = state.pointer.panY + dy;
    applyTransform();
    elements.viewport.style.cursor = state.pointer.moved ? "grabbing" : transitionAt(event.clientX, event.clientY) ? "pointer" : "grab";
  });
  elements.viewport.addEventListener("pointerup", (event) => {
    state.pointers.delete(event.pointerId);
    if (state.pinch) {
      state.pinch = null;
      const [remainingId, remaining] = [...state.pointers.entries()][0] ?? [];
      state.pointer = remaining ? { id: remainingId, x: remaining.x, y: remaining.y, panX: state.panX, panY: state.panY, moved: true } : null;
      if (!remaining) elements.viewport.classList.remove("is-dragging");
      return;
    }
    if (!state.pointer || event.pointerId !== state.pointer.id) return;
    event.preventDefault();
    const pointer = state.pointer;
    state.pointer = null;
    elements.viewport.classList.remove("is-dragging");
    if (!pointer.moved) activateTransition(event.clientX, event.clientY);
  });
  elements.viewport.addEventListener("pointercancel", (event) => { state.pointers.delete(event.pointerId); state.pointer = null; state.pinch = null; elements.viewport.classList.remove("is-dragging"); });
  elements.playerMarker.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    const markerRect = elements.playerMarker.getBoundingClientRect();
    state.playerPointer = {
      id: event.pointerId,
      moved: false,
      offsetX: event.clientX - (markerRect.left + markerRect.width / 2),
      offsetY: event.clientY - (markerRect.top + markerRect.height)
    };
    elements.playerMarker.setPointerCapture(event.pointerId);
  });
  elements.playerMarker.addEventListener("pointermove", (event) => {
    if (event.pointerId !== state.playerPointer?.id) return;
    state.playerPointer.moved = true;
    placePlayerPosition(event.clientX - state.playerPointer.offsetX, event.clientY - state.playerPointer.offsetY, { persist: false });
  });
  elements.playerMarker.addEventListener("pointerup", (event) => {
    if (event.pointerId !== state.playerPointer?.id) return;
    if (state.playerPointer.moved && state.playerDragPosition) {
      state.playerPositions[state.mapId] = state.playerDragPosition;
      state.playerDragPosition = null;
      savePlayerPositions();
      updatePlayerControls();
      renderPlayerMarker();
      announce("Character position saved.");
    }
    state.playerPointer = null;
  });
  elements.playerMarker.addEventListener("pointercancel", () => { state.playerPointer = null; state.playerDragPosition = null; renderPlayerMarker(); });
  elements.viewport.addEventListener("dragstart", (event) => event.preventDefault());
  elements.image.addEventListener("dragstart", (event) => event.preventDefault());
  elements.viewport.addEventListener("selectstart", (event) => event.preventDefault());
  elements.viewport.addEventListener("contextmenu", (event) => event.preventDefault());
  elements.viewport.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoom(state.zoom + ZOOM_STEP); }
    if (event.key === "-") { event.preventDefault(); setZoom(state.zoom - ZOOM_STEP); }
    if (event.key === "0") { event.preventDefault(); resetView(); }
    const distance = event.shiftKey ? PAN_STEP * 3 : PAN_STEP;
    if (event.key === "ArrowLeft") { event.preventDefault(); panBy(-distance, 0); }
    if (event.key === "ArrowRight") { event.preventDefault(); panBy(distance, 0); }
    if (event.key === "ArrowUp") { event.preventDefault(); panBy(0, -distance); }
    if (event.key === "ArrowDown") { event.preventDefault(); panBy(0, distance); }
  });
  elements.homeView.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") { event.preventDefault(); setHomeZoom(state.homeZoom + ZOOM_STEP); }
    if (event.key === "-") { event.preventDefault(); setHomeZoom(state.homeZoom - ZOOM_STEP); }
    if (event.key === "0") { event.preventDefault(); resetHomeView(); }
    const distance = event.shiftKey ? PAN_STEP * 3 : PAN_STEP;
    if (event.key === "ArrowLeft") { event.preventDefault(); panHomeBy(-distance, 0); }
    if (event.key === "ArrowRight") { event.preventDefault(); panHomeBy(distance, 0); }
    if (event.key === "ArrowUp") { event.preventDefault(); panHomeBy(0, -distance); }
    if (event.key === "ArrowDown") { event.preventDefault(); panHomeBy(0, distance); }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    hideTransitionMenu();
    if (!elements.regions.hidden) closeRegions();
    else if (!elements.difficultyPanel.hidden) closeDifficulty();
    else if (!elements.credits.hidden) closeCredits();
    else if (!elements.hotspotOptions.hidden) closeHotspotOptions();
    else if (state.isPlacingPlayer) {
      state.isPlacingPlayer = false;
      updatePlayerControls();
      announce("Character placement cancelled.");
    }
    else if (state.mapId) showHome();
  });
  window.addEventListener("resize", scheduleViewportSync);
  compactControlsQuery.addEventListener("change", syncMobileControls);
  window.addEventListener("orientationchange", scheduleViewportSync);
  window.visualViewport?.addEventListener("resize", scheduleViewportSync);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    elements.installDialog.close();
    updateInstallButton();
    announce("TLD Map installed.");
  });
  window.addEventListener("popstate", () => applyRoute());
  elements.homeImage.addEventListener("load", () => {
    fitHomeImage();
    scaleHomeAreas();
    resetHomeView();
  });
}

function applyRoute() {
  const route = location.hash ? routeFromHash() : readLastView() ?? routeFromHash();
  if (route.difficulty) setDifficulty(route.difficulty, { route: false });
  if (route.mapId) navigate(route.mapId, { route: false });
  else showHome({ route: false });
}

async function initialize() {
  syncViewportHeight();
  updateDifficultyControls();
  updateZoomControls();
  setHomeHotspotStyle(state.homeHotspotStyle);
  bindEvents();
  syncMobileControls();
  updateInstallButton();
  try {
    const response = await fetch("assets/js/maps.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.maps = await response.json();
    renderRegionList();
    applyRoute();
  } catch (error) {
    elements.title.textContent = "Map data is unavailable";
    announce("Map data could not be loaded. Please refresh the page.");
    console.error("Unable to load maps.json", error);
  }
}

initialize();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadForUpdate) window.location.reload();
  });
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js")
    .then((registration) => {
      watchForAppUpdate(registration);
      return registration.update();
    })
    .catch((error) => console.error("Unable to register service worker", error)));
}
