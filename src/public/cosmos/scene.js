import * as THREE from "three";
import { OrbitControls } from "/vendor/OrbitControls.js";
import { computeLayout } from "./distances.js";
import {
  loadSaturnBandsTexture,
  loadSaturnRingTexture,
  loadEarthDaymapTexture,
  loadEarthNightTexture,
  loadEarthCloudsTexture,
  loadMilkyWayTexture,
  getRadialDotTexture,
  applyRadialRingUVs,
} from "./textures.js";
import { createStar, createGalaxy, createWeb } from "./celestial.js";
import { createAtmosphereMaterial, createEarthSurfaceMaterial } from "./atmosphere.js";

// Objects still inside the Milky Way (even the two nearby stars, at 548 and
// 1,560 light-years, are far closer than the galaxy's ~100,000-light-year
// diameter) vs. the three genuinely extragalactic destinations — used to
// fade the sky background in and out as the brief asks.
const IN_GALAXY = new Set(["earth", "saturn", "betelgeuse", "gaia-bh1"]);

// Saturn's body radius relative to Earth's (real equatorial-diameter
// ratio: ~120,536 km vs ~12,756 km). Earth's radius is 1, so Saturn's
// body becomes this value directly — illustrative, human-scale sizing
// for the two Solar System bodies (see distances.js's matching position
// special-case), not the same scale as the log-distance model used
// beyond the Solar System.
const SATURN_DIAMETER_RATIO = 9.4;

// Cheap-to-render looks for each object: textured spheres for the two
// solar-system bodies, emissive spheres for the visible stars, THREE.Points
// clouds for everything too large or too uncertain to model as a surface.
// No postprocessing (no bloom passes) — "glow" comes from emissive materials
// and additive blending only, so this runs fine on integrated graphics. The
// handful of textures used (Saturn's bands/rings, Earth's surface/clouds)
// are small, pre-compressed JPEGs/PNGs — see textures.js and
// src/content/CREDITS.md. sunDir is the direction from this object toward
// the Sun (the origin) — used by Earth's day/night and atmosphere shaders
// so their terminator always agrees with the scene's single PointLight,
// which (being positioned at the origin) already lights every other object
// from the same real direction, for free.
function buildObjectMesh(id, lowGraphics, sunDir) {
  switch (id) {
    case "earth": {
      const segments = lowGraphics ? [24, 16] : [64, 48];
      const geometry = new THREE.SphereGeometry(1, ...segments);

      // Low-graphics keeps the simple, pre-existing look (a single lit
      // daymap, relying on the scene's PointLight for day/night shading)
      // — no night-lights texture, no custom shader, no cloud/atmosphere
      // shells. Normal mode uses the day/night shader below, which blends
      // in city lights on the dark side with a soft twilight terminator.
      const material = lowGraphics
        ? new THREE.MeshStandardMaterial({
            map: loadEarthDaymapTexture(true),
            roughness: 0.85,
            metalness: 0,
          })
        : createEarthSurfaceMaterial({
            dayMap: loadEarthDaymapTexture(false),
            nightMap: loadEarthNightTexture(),
            sunDir,
          });
      const earth = new THREE.Mesh(geometry, material);

      if (!lowGraphics) {
        // A thin, slightly larger shell for cloud cover reads as weather at
        // a glance; illuminated by the scene's own lighting (left as a
        // standard material so it still responds to the PointLight,
        // giving it its own, slightly softer day/night shading).
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(1.012, 48, 32),
          new THREE.MeshStandardMaterial({
            map: loadEarthCloudsTexture(),
            alphaMap: loadEarthCloudsTexture(),
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
          }),
        );
        clouds.userData.isCloudLayer = true;
        earth.add(clouds);

        // A Fresnel-glow shell, slightly larger again than the clouds, for
        // a rim-only atmosphere highlight rather than a uniformly tinted
        // sphere. Skipped in low-graphics along with the cloud layer, same
        // pattern, same reasoning: both are decorative, neither is needed
        // to read Earth as Earth.
        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(1.025, 48, 32),
          createAtmosphereMaterial(sunDir),
        );
        earth.add(atmosphere);
      }
      return earth;
    }
    case "saturn": {
      const group = new THREE.Group();
      const bodyRadius = SATURN_DIAMETER_RATIO;
      const bodySegments = lowGraphics ? [32, 24] : [64, 48];
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(bodyRadius, ...bodySegments),
        new THREE.MeshStandardMaterial({
          map: loadSaturnBandsTexture(lowGraphics),
          roughness: 0.75,
          metalness: 0,
        }),
      );
      // Saturn's real oblateness (polar radius ~90% of equatorial) reads
      // clearly even at this scale and costs nothing extra to render.
      body.scale.y = 0.9;

      // Ring extent is proportional to the body radius using real
      // ring-system ratios (inner main rings begin ~1.2 Saturn radii out;
      // the outer A-ring edge sits ~2.3 Saturn radii out) — scales
      // automatically with SATURN_DIAMETER_RATIO above, at zero extra
      // rendering cost (vertex positions scale, segment counts don't).
      const innerRadius = bodyRadius * 1.2;
      const outerRadius = bodyRadius * 2.3;
      const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, lowGraphics ? 64 : 160, 1);
      applyRadialRingUVs(ringGeometry, innerRadius, outerRadius);
      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshStandardMaterial({
          map: loadSaturnRingTexture(lowGraphics),
          alphaMap: loadSaturnRingTexture(lowGraphics),
          transparent: true,
          side: THREE.DoubleSide,
          roughness: 0.9,
          metalness: 0,
        }),
      );
      // Saturn's real axial tilt is about 27 degrees from vertical; the ring
      // plane tilts with it rather than sitting arbitrarily angled.
      ring.rotation.x = Math.PI / 2;
      group.rotation.z = THREE.MathUtils.degToRad(27);
      group.add(body, ring);
      return group;
    }
    case "betelgeuse": return createStar(2.4, true, lowGraphics);
    case "gaia-bh1": return createStar(1, false, lowGraphics);
    case "andromeda": return createGalaxy(lowGraphics);
    case "quipu": return createWeb(false, lowGraphics);
    case "great-wall": return createWeb(true, lowGraphics);
    default:
      return new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
  }
}

// A handful of plausible star colours by rough stellar type (blue-white,
// white, pale yellow, warm orange) — picked at random per point via a
// vertex-color attribute, which PointsMaterial supports natively with no
// custom shader.
const STAR_PALETTE = [
  [0.75, 0.85, 1.0], // blue-white
  [1.0, 1.0, 1.0], // white
  [1.0, 0.95, 0.8], // pale yellow
  [1.0, 0.8, 0.6], // warm orange
];

function randomSpherePoint(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = radius * (0.8 + Math.random() * 0.2);
  return [r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)];
}

function buildStarLayer(count, size, radius, sprite) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions.set(randomSpherePoint(radius), i * 3);
    const [r, g, b] = STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)];
    colors.set([r, g, b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: sprite,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false,
  });
  return new THREE.Points(geometry, material);
}

// Three size/brightness tiers instead of one uniform layer of flat white
// dots: most stars are small and faint (the large, small-size layer), a
// modest number are brighter and larger, and only a handful are the
// biggest "hero" stars — PointsMaterial only takes one `size` per
// material, so distinct point sizes mean distinct layers, not a single
// draw call. Low-graphics drops the hero layer entirely (purely
// decorative) and keeps the two workhorse layers at reduced counts, same
// ratio as before.
function buildStarfield(lowGraphics) {
  const sprite = getRadialDotTexture();
  const group = new THREE.Group();
  group.add(buildStarLayer(lowGraphics ? 1400 : 9000, 1.0, 300, sprite));
  group.add(buildStarLayer(lowGraphics ? 100 : 500, 1.9, 280, sprite));
  if (!lowGraphics) group.add(buildStarLayer(18, 3.0, 260, sprite));
  return group;
}

// The sky background (stars + Milky Way) as a true skybox: re-centred on
// the camera every frame so it never appears to get closer no matter how
// far the camera travels within the scene (radius only needs to clear
// camera.near and stay inside camera.far — it doesn't need to track
// controls.maxDistance the way an origin-fixed sphere would have). The
// Milky Way band fades out for the three extragalactic destinations
// (Andromeda, Quipu, the Great Wall) via its own independent, time-based
// opacity glide — not tied to the camera flight's tween — so switching
// destinations again mid-fade just redirects the glide from wherever
// it currently is, with nothing to desynchronise.
function buildMilkyWay(lowGraphics) {
  const geometry = new THREE.SphereGeometry(150, lowGraphics ? 24 : 40, lowGraphics ? 12 : 24);
  const material = new THREE.MeshBasicMaterial({
    map: loadMilkyWayTexture(lowGraphics),
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    opacity: 0.5,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.rotation.set(.4, 1.9, .7);
  return sky;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function createCosmosScene(canvas, { lowGraphics = false, onFrame = null } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowGraphics });
  renderer.setPixelRatio(lowGraphics ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // The Sun is one PointLight at the origin with decay=0 (brightness doesn't
  // fall off with distance): every object's lit hemisphere already faces
  // the origin correctly, for free, because a point light's direction
  // varies per-fragment based on position — unlike a DirectionalLight,
  // which has one fixed direction for the whole scene and would light
  // Earth and Saturn (which sit in different directions from the origin)
  // from the same angle, weakening both their terminators. decay=0 because
  // real inverse-square falloff would make the compressed log-scaled
  // layout (Saturn only tens of units from Earth) look misleading — only
  // the per-object direction should come from the Sun's position, not a
  // simulated distance falloff. Ambient stays low so the night side reads
  // as night, not as evenly lit. No shadow maps — nothing here needs one
  // object's shadow falling on another.
  scene.add(new THREE.AmbientLight(0xffffff, 0.06));
  const sunLight = new THREE.PointLight(0xffffff, 2.4, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);
  // Lighting source is at the origin; no oversized Sun billboard in the compressed map.

  const milkyWay = buildMilkyWay(lowGraphics);
  scene.add(milkyWay);
  const stars = buildStarfield(lowGraphics);
  scene.add(stars);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.4;
  controls.enablePan = false;
  controls.maxDistance = 400;

  const layout = computeLayout();
  const objects = new Map();
  for (const entry of layout) {
    // Direction from this object toward the Sun (the origin) — the same
    // relationship the PointLight above already uses per-fragment,
    // expressed here as a per-mesh vector for the day/night and
    // atmosphere shaders.
    const sunDir = new THREE.Vector3(entry.position.x, entry.position.y, entry.position.z)
      .negate()
      .normalize();
    const mesh = buildObjectMesh(entry.id, lowGraphics, sunDir);
    mesh.position.set(entry.position.x, entry.position.y, entry.position.z);
    mesh.userData.objectId = entry.id;
    scene.add(mesh);

    // World-space bounding radius, computed once here and reused by every
    // flyTo() call and the initial camera composition. Box3.getBoundingSphere()
    // circumscribes the *box*, not the geometry — for a sphere that's its
    // half-diagonal, ~1.73x too large (worse still for Saturn's flat, wide
    // rings), which was silently inflating every computed camera distance
    // and making every object, especially Earth, render far smaller than
    // intended. Sphere.setFromPoints fits the actual vertex positions
    // instead, so the radius matches what's actually on screen.
    mesh.updateMatrixWorld(true);
    const worldPoints = [];
    const vertex = new THREE.Vector3();
    mesh.traverse((node) => {
      if (!node.geometry || node.isSprite || node.userData.ignoreBounds) return;
      const position = node.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
        worldPoints.push(vertex.clone());
      }
    });
    const boundingRadius = new THREE.Sphere().setFromPoints(worldPoints).radius;

    objects.set(entry.id, { ...entry, mesh, boundingRadius });
  }

  // The Milky Way fades out for the three extragalactic destinations and
  // back in for anything still inside our own galaxy. This is a simple
  // time-based glide, entirely independent of the camera-flight tween
  // (which may be short, interrupted, or skipped under reduced motion) —
  // so re-selecting a different object mid-fade just redirects the glide
  // from whatever opacity it's currently at, with no desync possible.
  let milkyWayFadeFrom = milkyWay.material.opacity;
  let milkyWayFadeTo = milkyWay.material.opacity;
  let milkyWayFadeStart = 0;
  const MILKY_WAY_FADE_DURATION = 1200;
  const MILKY_WAY_OPACITY_IN_GALAXY = 0.5;
  const MILKY_WAY_OPACITY_EXTRAGALACTIC = 0.015;

  function setMilkyWayTarget(objectId) {
    const target = IN_GALAXY.has(objectId) ? MILKY_WAY_OPACITY_IN_GALAXY : MILKY_WAY_OPACITY_EXTRAGALACTIC;
    if (target === milkyWayFadeTo) return;
    milkyWayFadeFrom = milkyWay.material.opacity;
    milkyWayFadeTo = target;
    milkyWayFadeStart = performance.now();
  }

  function updateMilkyWayFade(now) {
    if (milkyWay.material.opacity === milkyWayFadeTo) return;
    const t = Math.min(1, (now - milkyWayFadeStart) / MILKY_WAY_FADE_DURATION);
    milkyWay.material.opacity = THREE.MathUtils.lerp(milkyWayFadeFrom, milkyWayFadeTo, t);
  }

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = document.visibilityState === "visible";
  });

  // True until the first flyTo() — keeps the Earth-composed opening shot
  // responsive to window resizes (e.g. rotating a phone) for as long as no
  // destination has been chosen yet, instead of leaving the first framing
  // permanently fixed to whatever size the window happened to be at load.
  let hasSelectedDestination = false;

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    updateViewOffset();
    if (!hasSelectedDestination) composeInitialCamera();
  }
  window.addEventListener("resize", resize);

  // How much of the viewport the information panel currently covers, so
  // camera framing can keep the selected object visible in the remaining
  // space instead of centring it behind the panel. Set by main.js whenever
  // the panel opens/closes or the desktop/mobile breakpoint changes.
  let viewportInset = { side: "none", sizePx: 0 };
  let activeId = "earth";
  let paused = prefersReducedMotion();
  function setViewportInset(inset) {
    viewportInset = inset ?? { side: "none", sizePx: 0 };
    updateViewOffset();
  }
  function viewArea() {
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const desktop=w>768;
    const left=desktop ? (w>1000 ? 250 : 195) : 0;
    const right=viewportInset.side==="right" ? viewportInset.sizePx+36 : 0;
    const bottom=viewportInset.side==="bottom" ? viewportInset.sizePx : (desktop?180:240);
    return {w,h,left,right,bottom,top:desktop?90:100};
  }
  function updateViewOffset(){
    const {w,h,left,right,bottom,top}=viewArea();
    camera.setViewOffset(w,h,(right-left)/2,(bottom-top)/2,w,h);
  }
  function getEffectiveAspect(){const {w,h,left,right,bottom,top}=viewArea();return Math.max(100,w-left-right)/Math.max(100,h-top-bottom);}
  function frameDistance(radius, aspect, padding=1.2){
    const {w,h,left,right,bottom,top}=viewArea();
    const half=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*Math.max(.2,(h-top-bottom)/h));
    const horizontal=Math.atan(Math.tan(half)*aspect);
    return Math.min(controls.maxDistance, radius/Math.sin(Math.min(half,horizontal))*padding);
  }
  function applyPanelOffset(cameraPos,targetPos){updateViewOffset();return {cameraPos,targetPos};}
  function approach(id){
    if(id==="earth")return new THREE.Vector3(-.8,.32,1).normalize();
    if(id==="saturn")return new THREE.Vector3(-.45,.58,1).normalize();
    if(id==="andromeda")return new THREE.Vector3(.1,.85,1).normalize();
    return new THREE.Vector3(0,.25,1).normalize();
  }
  function showDestination(id){
    activeId=id;
    for(const [key,entry] of objects)entry.mesh.visible=key===id;
    const entry=objects.get(id);
    controls.minDistance=entry.boundingRadius*1.18;
    controls.maxDistance=Math.max(120,entry.boundingRadius*14);
  }
  showDestination("earth");
  let flight = null; // { fromPos, toPos, fromTarget, toTarget, start, duration, onArrive }

  function flyTo(objectId, { onArrive } = {}) {
    const entry = objects.get(objectId);
    if (!entry) return;
    hasSelectedDestination = true;
    showDestination(objectId);
    const targetPos = entry.mesh.position.clone();
    const aspect = getEffectiveAspect();
    const distance = frameDistance(entry.boundingRadius, aspect);
    // A consistent 3/4-angle approach offset for every object — elevated
    // and slightly to one side, rather than dead-on — so the camera visibly
    // arcs toward the destination instead of flying straight down the
    // look-at axis.
    const approachDir = approach(objectId);
    const rawCameraPos = targetPos.clone().addScaledVector(approachDir, distance);
    const { cameraPos, targetPos: offsetTarget } = applyPanelOffset(rawCameraPos, targetPos, distance);

    const reducedMotion = prefersReducedMotion();
    flight = {
      fromPos: camera.position.clone(),
      toPos: cameraPos,
      fromTarget: controls.target.clone(),
      toTarget: offsetTarget,
      start: performance.now(),
      duration: reducedMotion ? 1 : 1500,
      onArrive,
    };
    setMilkyWayTarget(objectId);
  }

  // Re-frames the camera for whichever object the flight just arrived at
  // (or is currently resting on), accounting for the panel's current
  // screen share — called when the panel's open/closed state or the
  // desktop/mobile breakpoint changes while a destination is already
  // selected, so the object doesn't end up hidden behind a panel that
  // opened after the camera had already settled.
  function reframeCurrent(objectId) {
    const entry = objects.get(objectId);
    if (!entry || flight) return;
    const targetPos = entry.mesh.position.clone();
    const aspect = getEffectiveAspect();
    const distance = frameDistance(entry.boundingRadius, aspect);
    const approachDir = approach(objectId);
    const rawCameraPos = targetPos.clone().addScaledVector(approachDir, distance);
    const { cameraPos, targetPos: offsetTarget } = applyPanelOffset(rawCameraPos, targetPos, distance);
    const reducedMotion = prefersReducedMotion();
    flight = {
      fromPos: camera.position.clone(),
      toPos: cameraPos,
      fromTarget: controls.target.clone(),
      toTarget: offsetTarget,
      start: performance.now(),
      duration: reducedMotion ? 1 : 700,
      onArrive: null,
    };
  }

  // The opening shot: composed algorithmically from Earth's real position
  // (not a hardcoded vector), so it stays correct if distances.js's layout
  // ever changes. sunDirFromOrigin points from the Sun toward Earth — the
  // same direction Earth's day/night shader and the scene's PointLight
  // already use — so the lighting and the opening camera angle agree with
  // each other by construction. Deliberately does NOT steer toward
  // Saturn's direction: with Saturn's now-realistic size (~9.4x Earth's
  // diameter) sitting only tens of units away, any opening angle that put
  // Saturn within the frame made it loom large next to Earth — exactly
  // the "similar apparent size" the brief says to avoid. A fixed
  // world-up-based cross axis keeps the shot Earth-only and predictable.
  function composeInitialCamera() {
    const entry=objects.get("earth");
    const distance=frameDistance(entry.boundingRadius,getEffectiveAspect(),1.15);
    camera.position.copy(entry.mesh.position).addScaledVector(approach("earth"),distance);
    controls.target.copy(entry.mesh.position);
    updateViewOffset();
  }
  composeInitialCamera();

  function updateFlight(now) {
    if (!flight) return;
    const t = Math.min(1, (now - flight.start) / flight.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(flight.fromPos, flight.toPos, eased);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
    if (t >= 1) {
      const { onArrive } = flight;
      flight = null;
      onArrive?.();
    }
  }

  let lastFrameTime = performance.now();
  function animate(now) {
    const deltaSeconds = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    if (running) {
      updateFlight(now);
      updateMilkyWayFade(now);
      // True skybox behaviour: re-centre on the camera every frame so the
      // background never appears to get closer no matter how far the
      // camera travels within the scene.
      milkyWay.position.copy(camera.position);
      stars.position.copy(camera.position);
      if (!flight) onFrame?.(deltaSeconds);
      controls.update();
      if (!paused) for (const [id,{mesh}] of objects) {
        if(!mesh.visible)continue;
        if(id==="earth")mesh.rotation.y += deltaSeconds*.018;
        if(id==="betelgeuse" || id==="gaia-bh1")mesh.material.uniforms.time.value+=deltaSeconds;
        const clouds=mesh.children.find(child=>child.userData.isCloudLayer);
        if(clouds)clouds.rotation.y+=deltaSeconds*.007;
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  function raycastAt(ndcX, ndcY) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const meshes = [...objects.values()].map((o) => o.mesh).filter(mesh=>mesh.visible);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    let node = hits[0].object;
    while (node && !node.userData.objectId) node = node.parent;
    return node?.userData.objectId ?? null;
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    objects,
    flyTo,
    reframeCurrent,
    setViewportInset,
    raycastAt,
    resize,
    setPaused(value) { paused=value; },
    get paused() { return paused; },
    reset() { reframeCurrent(activeId); },
  };
}
