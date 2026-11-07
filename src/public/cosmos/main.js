import { createFallbackScene } from "./fallback.js";
import { PRESENTATION } from "./presentation.js";
import { createAmbience } from "./audio.js";
import { createCosmosScene } from "./scene.js";
import { attachKeyboardControls } from "./controls.js";
import { createPanelPreview } from "./panel-preview.js";
import { createAtlas } from "./atlas.js";
import { isLowGraphics, setLowGraphics } from "./settings.js";
import { OBJECTS } from "./distances.js";

const canvas = document.getElementById("cosmos-canvas");
const nameGateEl = document.getElementById("name-gate");
const nameFormEl = document.getElementById("name-form");
const nameInputEl = document.getElementById("name-input");
const objectListWrapEl = document.getElementById("object-list-wrap");
const objectListEl = document.getElementById("object-list");
const lowGraphicsLabelEl = document.getElementById("low-graphics-label");
const lowGraphicsToggle = document.getElementById("low-graphics-toggle");

const panelEl = document.getElementById("object-panel");
const panelCloseBtn = document.getElementById("panel-close");
const panelCanvas = document.getElementById("panel-preview-canvas");
const panelName = document.getElementById("panel-name");
const panelText = document.getElementById("panel-text");
const panelLookback = document.getElementById("panel-lookback");
const panelFacts = document.getElementById("panel-facts");
const panelSources = document.getElementById("panel-sources");

const tabs = [
  { btn: document.getElementById("tab-overview"), panel: document.getElementById("tabpanel-overview") },
  { btn: document.getElementById("tab-facts"), panel: document.getElementById("tabpanel-facts") },
  { btn: document.getElementById("tab-atlas"), panel: document.getElementById("tabpanel-atlas") },
];

const desktopQuery = window.matchMedia("(min-width: 769px)");

let objectsContent = {};
let lastTriggerEl = null;
let selectedObjectId = "earth";
let appReady = false;
const statusEl = document.getElementById("app-status");
const ambience = createAmbience(document.getElementById("audio-toggle"));
function setStatus(text) { statusEl.textContent = text; }
function updateCaption(id) {
  const p=PRESENTATION[id];
  document.getElementById("scene-title").textContent=p.short;
  document.getElementById("scene-kind").textContent=`${p.number} / 07 · ${p.kind}`;
  document.getElementById("scene-subtitle").textContent=p.subtitle;
  document.getElementById("scene-distance").textContent=p.distance;
  document.getElementById("scene-model").textContent=p.model;
  document.getElementById("info-button").textContent=`Explore ${p.short} ↗`;
  ambience.setDestination(id);
}

async function loadObjectsContent() {
  const res = await fetch("/api/objects");
  if (!res.ok) throw new Error("Destination information could not be loaded.");
  objectsContent = await res.json();
}

function buildObjectList() {
  objectListEl.replaceChildren(
    ...OBJECTS.map((obj) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const p=PRESENTATION[obj.id];
      btn.style.setProperty("--object-color",p.color);
      const number=document.createElement("span");number.className="destination-number";number.textContent=p.number;
      const dot=document.createElement("span");dot.className="destination-dot";dot.setAttribute("aria-hidden","true");
      const copy=document.createElement("span");copy.className="destination-copy";
      const title=document.createElement("strong");title.textContent=p.short;
      const kind=document.createElement("small");kind.textContent=p.kind;
      copy.append(title,kind);btn.append(number,dot,copy);
      btn.dataset.objectId = obj.id;
      btn.setAttribute("aria-current", "false");
      btn.addEventListener("click", () => selectObject(obj.id, btn));
      return btn;
    }),
  );
}

function markSelectedButton(objectId) {
  for (const btn of objectListEl.children) {
    btn.setAttribute("aria-current", String(btn.dataset.objectId === objectId));
  }
}

function selectTab(tabId) {
  for (const { btn, panel } of tabs) {
    const active = btn.id === tabId;
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
    panel.hidden = !active;
  }
}

for (const [index,{btn}] of tabs.entries()) {
  btn.addEventListener("click",()=>selectTab(btn.id));
  btn.addEventListener("keydown", event=>{
    const keys={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1};
    if (!(event.key in keys))return;
    event.preventDefault();event.stopPropagation();const target=tabs[keys[event.key]].btn;selectTab(target.id);target.focus();
  });
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
      try { a.textContent = new URL(src).hostname.replace(/^www\./, "") + " ↗"; } catch { a.textContent = src; }
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

// Desktop keeps the panel non-modal (.show()) so the scene behind it stays
// orbit/zoom-able while reading; mobile keeps it a true modal bottom sheet
// (.showModal()) since there's no room to use both at once there. Decided
// at open time, not continuously, so resizing across the breakpoint while
// the panel is already open just keeps whatever modality it opened with.
function isDesktop() {
  return desktopQuery.matches;
}

function updateViewportInset() {
  if (!panelEl.open) {
    scene?.setViewportInset({ side: "none", sizePx: 0 });
    return;
  }
  if (isDesktop()) {
    scene?.setViewportInset({ side: "right", sizePx: panelEl.getBoundingClientRect().width });
  } else {
    scene?.setViewportInset({ side: "bottom", sizePx: panelEl.getBoundingClientRect().height });
  }
}

function openPanel(objectId, triggerEl) {
  const content = objectsContent[objectId];
  if (!content) return;
  lastTriggerEl = triggerEl ?? null;
  selectedObjectId = objectId;
  markSelectedButton(objectId);

  document.body.classList.add("panel-open");
  document.getElementById("panel-kind").textContent = PRESENTATION[objectId].kind;
  panelName.textContent = content.name;
  panelText.textContent = content.text;
  panelLookback.textContent = content.lookbackTime;
  renderFacts(content.facts ?? []);
  renderSources(content.sources);
  selectTab("tab-overview");

  atlas.open(objectId);

  // Re-opening while already open (clicking a different object on desktop,
  // where the list stays usable) would throw InvalidStateError on
  // show()/showModal() — just refresh the content above and leave the
  // dialog's open state alone.
  if (!panelEl.open) {
    if (isDesktop()) {
      panelEl.show();
    } else {
      panelEl.showModal();
      objectListWrapEl.hidden = true;
    }
    panelCloseBtn.focus();
  }

  updateViewportInset();
  scene?.reframeCurrent(objectId);

  const entry = scene.objects.get(objectId);
  if (entry) {
    const clone = entry.mesh.clone(true);
    preview.start(clone);
  }
}

function closePanel() {
  if (panelEl.open) panelEl.close();
}

// Fires for every way the dialog closes — the close button, the browser's
// own Escape handling on mobile, or the manual Escape listener below on
// desktop — so cleanup happens exactly once, from one place.
panelEl.addEventListener("close", () => {
  if (panelEl.open) return;
  preview.stop();
  document.body.classList.remove("panel-open");
  objectListWrapEl.hidden = false;
  updateViewportInset();
  scene?.reframeCurrent(selectedObjectId);
  lastTriggerEl?.focus();
});

// Non-modal dialogs (the desktop case) don't get native Escape-to-close —
// that's a showModal()-only behavior — so it's hand-rolled here, active
// only while the panel is actually open.
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && panelEl.open && isDesktop()) closePanel();
});

panelCloseBtn.addEventListener("click", closePanel);

window.addEventListener("resize", () => {
  if (panelEl.open) {
    // A dialog opened at one breakpoint must adopt the other modality.
    const needsModal=!isDesktop();
    if(panelEl.matches(":modal")!==needsModal){
      panelEl.close();
      if(needsModal)panelEl.showModal();else panelEl.show();
      document.body.classList.add("panel-open");
      objectListWrapEl.hidden=needsModal;
    }
    preview?.resize();
    updateViewportInset();
    if (selectedObjectId) scene?.reframeCurrent(selectedObjectId);
  }
});

function selectObject(objectId, triggerEl, showInfo = true) {
  if (!appReady) return;
  selectedObjectId=objectId;
  updateCaption(objectId);markSelectedButton(objectId);
  setStatus(`Travelling to ${PRESENTATION[objectId].short}…`);
  scene.flyTo(objectId, { onArrive: () => {setStatus("");if(showInfo)openPanel(objectId,triggerEl);} });
}

function showApp() {
  nameGateEl.hidden = true;
  objectListWrapEl.hidden = false;
  lowGraphicsLabelEl.hidden = false;
  document.getElementById("scene-caption").hidden=false;
  document.getElementById("scene-toolbar").hidden=false;
  updateCaption("earth");markSelectedButton("earth");
}

nameFormEl.addEventListener("submit", async event=>{
  event.preventDefault();const name=nameInputEl.value.trim();if(!name||!appReady)return;
  const button=nameFormEl.querySelector("button");button.disabled=true;
  const error=document.getElementById("name-error");error.textContent="";
  try {
    const res=await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
    if(!res.ok)throw new Error("Could not save your name. Please try again.");
    showApp();document.getElementById("info-button").focus();
  } catch {error.textContent="Could not connect. Your name has not been saved. Please try again.";}
  finally{button.disabled=false;}
});

async function checkName() {
  const res = await fetch("/api/me");
  if (!res.ok) return;
  const { name } = await res.json();
  if (name) {
    nameInputEl.value = name;
    showApp();
  }
}

function connectStream() {
  const stream = new EventSource("/api/stream");
  const connection=document.getElementById("connection-status");
  stream.addEventListener("open",()=>{connection.textContent="Atlas live";connection.dataset.state="live";atlas.refresh();});
  stream.addEventListener("error",()=>{connection.textContent="Reconnecting…";connection.dataset.state="offline";});
  for (const type of ["observation-added", "observation-edited", "observation-deleted"]) {
    stream.addEventListener(type, (event) => {
      atlas.handleStreamEvent(type, JSON.parse(event.data));
    });
  }
}

async function main() {
  nameFormEl.querySelector("button").disabled=true;
  await loadObjectsContent();
  buildObjectList();

  const lowGraphics = isLowGraphics();
  lowGraphicsToggle.checked = lowGraphics;

  const keyboardUpdate = { current: null };
  try {
    scene = createCosmosScene(canvas, {
      lowGraphics,
      onFrame: dt => keyboardUpdate.current?.(dt),
    });
    keyboardUpdate.current = attachKeyboardControls(scene.camera, scene.controls);
    try { preview = createPanelPreview(panelCanvas); } catch { panelCanvas.hidden=true; }
  } catch {
    scene = createFallbackScene(canvas, {lowGraphics});
    panelCanvas.hidden=true;
    document.querySelector(".control-hint").textContent="Software view · Drag to rotate · Scroll to zoom";
    document.getElementById("low-graphics-label").title="Software view is active because WebGL is unavailable";
  }
  preview ??= {start(){},stop(){},resize(){}};

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

  appReady=true;
  nameFormEl.querySelector("button").disabled=false;
  setStatus("");
  document.getElementById("home-button").addEventListener("click",()=>{closePanel();selectObject("earth",null,false);});
  document.getElementById("focus-button").addEventListener("click",()=>scene.reset());
  document.getElementById("info-button").addEventListener("click",event=>openPanel(selectedObjectId,event.currentTarget));
  const motion=document.getElementById("motion-toggle");
  function syncMotion(){motion.textContent=scene.paused?"Resume motion":"Pause motion";motion.setAttribute("aria-pressed",String(scene.paused));}
  syncMotion();motion.addEventListener("click",()=>{scene.setPaused(!scene.paused);syncMotion();});
  canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();setStatus("The 3D view was interrupted. Reload to restore it. Your notes are saved.");});
  connectStream();
  await checkName();
}

main().catch(error=>{console.error(error);setStatus("COSMOS could not start. Check your connection and WebGL support, then reload.");});
