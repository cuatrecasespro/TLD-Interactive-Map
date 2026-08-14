import { mapTransitions, TRANSITION_SIZE } from "./transitions.js";

const DIFFICULTIES = new Set(["pilgrim", "interloper"]);
const STORAGE_KEY = "tld-map:difficulty";
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

const elements = {
  homeView: document.querySelector("#home-view"), mapView: document.querySelector("#map-view"),
  homeImage: document.querySelector("#start-map-image"), viewport: document.querySelector("#map-viewport"),
  image: document.querySelector("#region-image"), loading: document.querySelector("#loading"), error: document.querySelector("#map-error"),
  retry: document.querySelector("#retry-button"), title: document.querySelector("#map-title"), status: document.querySelector("#app-status"),
  home: document.querySelector("#home-button"), zoomControls: document.querySelector("#zoom-controls"),
  zoomIn: document.querySelector("#zoom-in"), zoomOut: document.querySelector("#zoom-out"), zoomReset: document.querySelector("#zoom-reset"),
  settingsButton: document.querySelector("#settings-button"), settings: document.querySelector("#settings-panel"),
  difficultyButtons: [...document.querySelectorAll("[data-difficulty]")], transitionMenu: document.querySelector("#transition-menu")
};

const state = { maps: null, mapId: null, difficulty: readDifficulty(), zoom: 1, panX: 0, panY: 0, requestId: 0, pointer: null, pointers: new Map(), pinch: null };

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
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficulty));
  });
}

function resetView() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
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
    const url = state.maps[id]?.[state.difficulty];
    if (url) new Image().src = url;
  });
}

function showHome({ route = "push" } = {}) {
  state.mapId = null;
  state.requestId += 1;
  hideTransitionMenu();
  elements.mapView.hidden = true;
  elements.homeView.hidden = false;
  elements.home.hidden = true;
  elements.zoomControls.hidden = true;
  elements.title.textContent = "Choose a region";
  if (route) writeRoute(route);
}

function loadImage(url, mapId) {
  const requestId = ++state.requestId;
  elements.error.hidden = true;
  elements.loading.hidden = false;
  elements.image.hidden = true;
  elements.viewport.classList.remove("is-ready");
  elements.image.alt = `${labelFor(mapId)} map for ${state.difficulty} difficulty`;
  elements.image.onload = async () => {
    if (requestId !== state.requestId) return;
    try { await elements.image.decode(); } catch { /* The loaded image is still usable. */ }
    if (requestId !== state.requestId) return;
    elements.loading.hidden = true;
    elements.image.hidden = false;
    elements.viewport.classList.add("is-ready");
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
  const url = state.maps?.[mapId]?.[state.difficulty];
  if (!url) {
    announce(`No ${state.difficulty} map is available for ${labelFor(mapId)}.`);
    return;
  }
  state.mapId = mapId;
  hideTransitionMenu();
  elements.homeView.hidden = true;
  elements.mapView.hidden = false;
  elements.home.hidden = false;
  elements.zoomControls.hidden = false;
  elements.title.textContent = `${labelFor(mapId)} · ${state.difficulty === "pilgrim" ? "Pilgrim / Voyageur / Stalker" : "Interloper / Misery"}`;
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
  announce(`Difficulty set to ${difficulty}.`);
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
  elements.home.addEventListener("click", () => showHome());
  elements.retry.addEventListener("click", () => state.mapId && navigate(state.mapId, { route: false }));
  elements.zoomIn.addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));
  elements.zoomOut.addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));
  elements.zoomReset.addEventListener("click", resetView);
  elements.settingsButton.addEventListener("click", () => {
    const open = elements.settings.hidden;
    elements.settings.hidden = !open;
    elements.settingsButton.setAttribute("aria-expanded", String(open));
    if (open) elements.settings.querySelector("button").focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!elements.settings.hidden && !elements.settings.contains(event.target) && event.target !== elements.settingsButton) {
      elements.settings.hidden = true;
      elements.settingsButton.setAttribute("aria-expanded", "false");
    }
    if (!elements.transitionMenu.hidden && !elements.transitionMenu.contains(event.target)) hideTransitionMenu();
  });
  elements.viewport.addEventListener("wheel", (event) => { event.preventDefault(); setZoom(state.zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY); }, { passive: false });
  elements.viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
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
    const pointer = state.pointer;
    state.pointer = null;
    elements.viewport.classList.remove("is-dragging");
    if (!pointer.moved) activateTransition(event.clientX, event.clientY);
  });
  elements.viewport.addEventListener("pointercancel", (event) => { state.pointers.delete(event.pointerId); state.pointer = null; state.pinch = null; elements.viewport.classList.remove("is-dragging"); });
  elements.viewport.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoom(state.zoom + ZOOM_STEP); }
    if (event.key === "-") { event.preventDefault(); setZoom(state.zoom - ZOOM_STEP); }
    if (event.key === "0") { event.preventDefault(); resetView(); }
  });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") { hideTransitionMenu(); if (!elements.settings.hidden) elements.settingsButton.click(); else if (state.mapId) showHome(); } });
  window.addEventListener("resize", () => { scaleHomeAreas(); if (state.mapId) applyTransform(); });
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
  bindEvents();
  try {
    const response = await fetch("assets/js/maps.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.maps = await response.json();
    applyRoute();
  } catch (error) {
    elements.title.textContent = "Map data is unavailable";
    announce("Map data could not be loaded. Please refresh the page.");
    console.error("Unable to load maps.json", error);
  }
}

initialize();
