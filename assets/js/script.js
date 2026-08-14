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
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const PAN_STEP = 80;

const elements = {
  homeView: document.querySelector("#home-view"), mapView: document.querySelector("#map-view"),
  homeImage: document.querySelector("#start-map-image"), viewport: document.querySelector("#map-viewport"),
  image: document.querySelector("#region-image"), loading: document.querySelector("#loading"), error: document.querySelector("#map-error"),
  retry: document.querySelector("#retry-button"), worldBrand: document.querySelector("#world-brand"), locationButton: document.querySelector("#location-button"), title: document.querySelector("#map-title"), difficultyButton: document.querySelector("#difficulty-button"), difficultyStatus: document.querySelector("#difficulty-status"), status: document.querySelector("#app-status"),
  zoomControls: document.querySelector("#zoom-controls"),
  zoomIn: document.querySelector("#zoom-in"), zoomOut: document.querySelector("#zoom-out"), zoomReset: document.querySelector("#zoom-reset"),
  regions: document.querySelector("#regions-panel"), regionsClose: document.querySelector("#regions-close"), worldRegion: document.querySelector("#world-region-button"), regionSearch: document.querySelector("#region-search"), regionList: document.querySelector("#region-list"),
  creditsButton: document.querySelector("#credits-button"), credits: document.querySelector("#credits-panel"), creditsClose: document.querySelector("#credits-close"),
  difficultyPanel: document.querySelector("#difficulty-panel"), difficultyClose: document.querySelector("#difficulty-close"),
  difficultyButtons: [...document.querySelectorAll("[data-difficulty]")], transitionMenu: document.querySelector("#transition-menu"),
  install: document.querySelector("#install-button"), installDialog: document.querySelector("#install-dialog"),
  installInstructions: document.querySelector("#install-instructions"), installClose: document.querySelector("#install-close"), nativeInstall: document.querySelector("#native-install-button")
};

const state = { maps: null, mapId: null, difficulty: readDifficulty(), zoom: 1, panX: 0, panY: 0, requestId: 0, pointer: null, pointers: new Map(), pinch: null };
let deferredInstallPrompt = null;

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
  const percentage = Math.round(state.zoom * 100);
  elements.zoomReset.textContent = `${percentage}%`;
  elements.zoomReset.setAttribute("aria-label", `Reset zoom, currently ${percentage} percent`);
  elements.zoomOut.disabled = state.zoom <= MIN_ZOOM;
  elements.zoomIn.disabled = state.zoom >= MAX_ZOOM;
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
  elements.regionList.replaceChildren(...regionIds
    .filter((id) => labelFor(id).toLowerCase().includes(normalizedQuery))
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
  elements.regions.hidden = true;
  elements.locationButton.setAttribute("aria-expanded", "false");
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
  const width = elements.image.clientWidth * state.zoom;
  const height = elements.image.clientHeight * state.zoom;
  const maxX = Math.max(0, (width - elements.viewport.clientWidth) / 2);
  const maxY = Math.max(0, (height - elements.viewport.clientHeight) / 2);
  state.panX = Math.min(maxX, Math.max(-maxX, state.panX));
  state.panY = Math.min(maxY, Math.max(-maxY, state.panY));
}

function applyTransform() {
  clampPan();
  elements.image.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

function fitMapImage() {
  if (!elements.image.naturalWidth || !elements.viewport.clientWidth || !elements.viewport.clientHeight) return;
  const scale = Math.min(
    elements.viewport.clientWidth / elements.image.naturalWidth,
    elements.viewport.clientHeight / elements.image.naturalHeight
  );
  elements.image.style.width = `${Math.floor(elements.image.naturalWidth * scale)}px`;
  elements.image.style.height = `${Math.floor(elements.image.naturalHeight * scale)}px`;
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
  const imageRect = elements.image.getBoundingClientRect();
  if (!elements.image.naturalWidth || !imageRect.width) return null;
  const x = (clientX - imageRect.left) / (imageRect.width / elements.image.naturalWidth);
  const y = (clientY - imageRect.top) / (imageRect.height / elements.image.naturalHeight);
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
  state.requestId += 1;
  hideTransitionMenu();
  closeRegions();
  closeCredits();
  closeDifficulty();
  elements.mapView.hidden = true;
  elements.homeView.hidden = false;
  elements.zoomControls.hidden = true;
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
  hideTransitionMenu();
  elements.homeView.hidden = true;
  elements.mapView.hidden = false;
  elements.zoomControls.hidden = false;
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
  elements.difficultyButton.addEventListener("click", openDifficulty);
  elements.retry.addEventListener("click", () => state.mapId && navigate(state.mapId, { route: false }));
  elements.zoomIn.addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));
  elements.zoomOut.addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));
  elements.zoomReset.addEventListener("click", resetView);
  elements.regionsClose.addEventListener("click", closeRegions);
  elements.regionSearch.addEventListener("input", () => renderRegionList(elements.regionSearch.value));
  elements.install.addEventListener("click", openInstallDialog);
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
    if (!elements.transitionMenu.hidden && !elements.transitionMenu.contains(event.target)) hideTransitionMenu();
  });
  elements.viewport.addEventListener("wheel", (event) => { event.preventDefault(); setZoom(state.zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY); }, { passive: false });
  elements.viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
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
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    hideTransitionMenu();
    if (!elements.regions.hidden) closeRegions();
    else if (!elements.difficultyPanel.hidden) closeDifficulty();
    else if (!elements.credits.hidden) closeCredits();
    else if (state.mapId) showHome();
  });
  window.addEventListener("resize", () => {
    scaleHomeAreas();
    updateInstallButton();
    if (state.mapId) {
      fitMapImage();
      applyTransform();
    }
  });
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
  elements.homeImage.addEventListener("load", scaleHomeAreas);
}

function applyRoute() {
  const route = routeFromHash();
  if (route.difficulty) setDifficulty(route.difficulty, { route: false });
  if (route.mapId) navigate(route.mapId, { route: false });
  else showHome({ route: false });
}

async function initialize() {
  updateDifficultyControls();
  updateZoomControls();
  bindEvents();
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
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((error) => console.error("Unable to register service worker", error)));
}
