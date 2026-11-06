import { createCosmosScene } from "./scene.js";
import { attachKeyboardControls } from "./controls.js";
import { createPanelPreview } from "./panel-preview.js";
import { createAtlas } from "./atlas.js";
import { isLowGraphics, setLowGraphics } from "./settings.js";
import { OBJECTS } from "./distances.js";

const canvas = document.getElementById("cosmos-canvas");
const nameGateEl = document.getElementById("name-gate");
const appEl = document.getElementById("app");
const nameFormEl = document.getElementById("name-form");
const nameInputEl = document.getElementById("name-input");
const objectListEl = document.getElementById("object-list");
const lowGraphicsToggle = document.getElementById("low-graphics-toggle");

const panelEl = document.getElementById("object-panel");
const panelCloseBtn = document.getElementById("panel-close");
const panelCanvas = document.getElementById("panel-preview-canvas");
const panelName = document.getElementById("panel-name");
const panelText = document.getElementById("panel-text");
const panelLookback = document.getElementById("panel-lookback");
const panelFacts = document.getElementById("panel-facts");
const panelSources = document.getElementById("panel-sources");

let objectsContent = {};
let lastTriggerEl = null;

async function loadObjectsContent() {
  const res = await fetch("/api/objects");
  objectsContent = await res.json();
}

function buildObjectList() {
  objectListEl.replaceChildren(
    ...OBJECTS.map((obj) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = obj.name;
      btn.dataset.objectId = obj.id;
      btn.addEventListener("click", () => selectObject(obj.id, btn));
      return btn;
    }),
  );
}

function renderFacts(facts) {
  panelFacts.replaceChildren(
    ...facts.map((fact) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.className = `fact-label fact-${fact.label.replace(/[^a-z]+/gi, "-")}`;
      label.textContent = fact.label;
      const text = document.createElement("span");
      text.className = "fact-text";
      text.textContent = fact.text;
      li.append(label, text);
      return li;
    }),
  );
}

function renderSources(sources) {
  panelSources.replaceChildren(
    ...(sources ?? []).map((src) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = src;
      a.textContent = src;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      li.append(a);
      return li;
    }),
  );
}

let scene;
let preview;
let atlas;

function openPanel(objectId, triggerEl) {
  const content = objectsContent[objectId];
  if (!content) return;
  lastTriggerEl = triggerEl ?? null;

  panelName.textContent = content.name;
  panelText.textContent = content.text;
  panelLookback.textContent = content.lookbackTime;
  renderFacts(content.facts ?? []);
  renderSources(content.sources);

  atlas.open(objectId);

  // The dialog must actually be open (and laid out) before starting the
  // preview — its canvas is display:none, with zero size, until showModal()
  // runs, and the preview sizes its renderer/camera from that layout.
  if (typeof panelEl.showModal === "function") {
    panelEl.showModal();
  } else {
    panelEl.setAttribute("open", "");
  }

  const entry = scene.objects.get(objectId);
  if (entry) {
    const clone = entry.mesh.clone(true);
    preview.start(clone);
  }

  panelCloseBtn.focus();
}

function closePanel() {
  if (typeof panelEl.close === "function" && panelEl.open) {
    panelEl.close();
  } else {
    panelEl.removeAttribute("open");
  }
}

// Fires for every way the dialog closes — the close button, or the browser's
// own Escape handling — so stopping the preview and restoring focus to
// whichever object triggered it happens exactly once, from one place.
panelEl.addEventListener("close", () => {
  preview.stop();
  lastTriggerEl?.focus();
});

panelCloseBtn.addEventListener("click", closePanel);

function selectObject(objectId, triggerEl) {
  scene.flyTo(objectId, { onArrive: () => openPanel(objectId, triggerEl) });
}

function showApp() {
  nameGateEl.hidden = true;
  appEl.hidden = false;
  // The canvas has zero size while #app is hidden (the scene is created
  // before the name gate is necessarily passed), so the renderer/camera need
  // a resize once it actually has layout.
  scene?.resize();
}

nameFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInputEl.value.trim();
  if (!name) return;
  const res = await fetch("/api/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (res.ok) showApp();
});

async function checkName() {
  const res = await fetch("/api/me");
  const { name } = await res.json();
  if (name) {
    nameInputEl.value = name;
    showApp();
  }
}

function connectStream() {
  const stream = new EventSource("/api/stream");
  for (const type of ["observation-added", "observation-edited", "observation-deleted"]) {
    stream.addEventListener(type, (event) => {
      atlas.handleStreamEvent(type, JSON.parse(event.data));
    });
  }
}

async function main() {
  await loadObjectsContent();
  buildObjectList();

  const lowGraphics = isLowGraphics();
  lowGraphicsToggle.checked = lowGraphics;

  const keyboardUpdate = { current: null };
  scene = createCosmosScene(canvas, {
    lowGraphics,
    onFrame: (dt) => keyboardUpdate.current?.(dt),
  });
  keyboardUpdate.current = attachKeyboardControls(scene.camera, scene.controls);

  preview = createPanelPreview(panelCanvas);

  atlas = createAtlas({
    listEl: document.getElementById("observation-list"),
    formEl: document.getElementById("observation-form"),
    textareaEl: document.getElementById("observation-input"),
    charCountEl: document.getElementById("observation-char-count"),
  });

  // Only treat this as a click-to-select if the pointer barely moved between
  // down and up — otherwise every orbit-drag release would also raycast and
  // could open a panel the user didn't mean to open.
  let downPos = null;
  canvas.addEventListener("pointerdown", (event) => {
    downPos = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!downPos) return;
    const moved = Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y);
    downPos = null;
    if (moved > 6) return;
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const objectId = scene.raycastAt(ndcX, ndcY);
    if (objectId) selectObject(objectId, null);
  });

  lowGraphicsToggle.addEventListener("change", () => {
    setLowGraphics(lowGraphicsToggle.checked);
    window.location.reload();
  });

  connectStream();
  checkName();
}

main();
