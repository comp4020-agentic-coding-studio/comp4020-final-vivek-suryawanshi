import * as THREE from "three";
import { OrbitControls } from "/vendor/OrbitControls.js";
import { computeLayout } from "./distances.js";
import {
  loadSaturnBandsTexture,
  loadSaturnRingTexture,
  loadEarthDaymapTexture,
  loadEarthCloudsTexture,
  loadMilkyWayTexture,
  getRadialDotTexture,
  applyRadialRingUVs,
} from "./textures.js";
import { createAtmosphereMaterial } from "./atmosphere.js";

// Objects still inside the Milky Way (even the two nearby stars, at 548 and
// 1,560 light-years, are far closer than the galaxy's ~100,000-light-year
// diameter) vs. the three genuinely extragalactic destinations — used to
// fade the sky background in and out as the brief asks.
const IN_GALAXY = new Set(["earth", "saturn", "betelgeuse", "gaia-bh1"]);

// Cheap-to-render looks for each object: textured spheres for the two
// solar-system bodies, emissive spheres for the visible stars, THREE.Points
// clouds for everything too large or too uncertain to model as a surface.
// No postprocessing (no bloom passes) — "glow" comes from emissive materials
// and additive blending only, so this runs fine on integrated graphics. The
// handful of textures used (Saturn's bands/rings, Earth's surface/clouds)
// are small, pre-compressed JPEGs/PNGs — see textures.js and
// src/content/CREDITS.md. sunDir is only used by Earth's atmosphere shader
// (so its rim brightens on the lit side); every other object is unaffected.
function buildObjectMesh(id, lowGraphics, sunDir) {
  switch (id) {
    case "earth": {
      const segments = lowGraphics ? [16, 12] : [48, 32];
      const geometry = new THREE.SphereGeometry(1, ...segments);
      const material = new THREE.MeshStandardMaterial({
        map: loadEarthDaymapTexture(),
        roughness: 0.85,
        metalness: 0,
      });
      const earth = new THREE.Mesh(geometry, material);

      // A thin, slightly larger shell for cloud cover reads as atmosphere at
      // a glance without a second light pass or a postprocessing pass.
      if (!lowGraphics) {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(1.01, 32, 24),
          new THREE.MeshStandardMaterial({
            map: loadEarthCloudsTexture(),
            transparent: true,
            opacity: 0.45,
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
          new THREE.SphereGeometry(1.08, 32, 24),
          createAtmosphereMaterial(sunDir),
        );
        earth.add(atmosphere);
      }
      return earth;
    }
    case "saturn": {
      const group = new THREE.Group();
      const bodySegments = lowGraphics ? [16, 12] : [48, 32];
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(1.3, ...bodySegments),
        new THREE.MeshStandardMaterial({
          map: loadSaturnBandsTexture(),
          roughness: 0.75,
          metalness: 0,
        }),
      );
      // Saturn's real oblateness (polar radius ~90% of equatorial) reads
      // clearly even at this scale and costs nothing extra to render.
      body.scale.y = 0.9;

      const innerRadius = 1.6;
      const outerRadius = 2.9;
      const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, lowGraphics ? 48 : 128, 1);
      applyRadialRingUVs(ringGeometry, innerRadius, outerRadius);
      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshStandardMaterial({
          map: loadSaturnRingTexture(),
          alphaMap: loadSaturnRingTexture(),
          transparent: true,
          side: THREE.DoubleSide,
          roughness: 0.9,
          metalness: 0,
        }),
      );
      // Saturn's real axial tilt is about 27 degrees from vertical; the ring
      // plane tilts with it rather than sitting arbitrarily angled.
      ring.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(27);
      group.add(body, ring);
      return group;
    }
    case "betelgeuse": {
      const geometry = new THREE.SphereGeometry(2.4, lowGraphics ? 16 : 32, lowGraphics ? 12 : 24);
      const material = new THREE.MeshStandardMaterial({
        color: 0xff6a35,
        emissive: 0xff3300,
        emissiveIntensity: 1.3,
        roughness: 1,
      });
      return new THREE.Mesh(geometry, material);
    }
    case "gaia-bh1": {
      // Only the Sun-like companion star is shown — the black hole itself
      // stays invisible, per the brief.
      const geometry = new THREE.SphereGeometry(1, lowGraphics ? 16 : 32, lowGraphics ? 12 : 24);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffe08a,
        emissive: 0xffb02e,
        emissiveIntensity: 0.7,
        roughness: 1,
      });
      return new THREE.Mesh(geometry, material);
    }
    case "andromeda":
      return buildPointCloud({ count: lowGraphics ? 800 : 4000, spread: 3, flatten: 0.15, color: 0xaad4ff, opacity: 0.8, core: true });
    case "quipu":
      return buildChainCloud({ count: lowGraphics ? 400 : 2000, length: 6, color: 0x7fffd4 });
    case "great-wall":
      return buildPointCloud({ count: lowGraphics ? 600 : 3000, spread: 4, flatten: 0.6, color: 0xcfcfcf, opacity: 0.25, jitter: 1.4 });
    default:
      return new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
  }
}

function buildPointCloud({ count, spread, flatten, color, opacity, jitter = 1, core = false }) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Exponent > 1 concentrates more points toward the centre (a galaxy's
    // bright core and tightly-wound inner arms) while still thinning out
    // toward the edge; exponent 0.5 (the non-core case) instead spreads
    // points uniformly across the disc's area, which reads better for an
    // amorphous cloud like the Great Wall.
    const r = spread * Math.pow(Math.random(), core ? 1.8 : 0.5) * jitter;
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = (Math.random() - 0.5) * spread * flatten * (1 - 0.6 * (r / spread));
    positions.set([x, y, z], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.05,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);

  if (!core) return points;

  // A small bright core glow gives a galaxy an obvious bulge at a glance,
  // for the cost of one extra low-poly sphere.
  const group = new THREE.Group();
  const bulge = new THREE.Mesh(
    new THREE.SphereGeometry(spread * 0.08, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.9 }),
  );
  group.add(bulge, points);
  return group;
}

// A long, glowing chain of points following a gently curved path — Quipu's
// shape as one of the largest known galaxy-cluster filaments.
function buildChainCloud({ count, length, color }) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const x = (t - 0.5) * length * 2;
    const curve = Math.sin(t * Math.PI * 3) * 0.6;
    const y = curve + (Math.random() - 0.5) * 0.3;
    const z = Math.cos(t * Math.PI * 3) * 0.4 + (Math.random() - 0.5) * 0.3;
    positions.set([x, y, z], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.08,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
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
// dots — PointsMaterial only takes one `size` per material, so distinct
// point sizes mean distinct layers, not a single draw call. Low-graphics
// drops the smallest-count, biggest "hero" layer (purely decorative) and
// keeps the two workhorse layers at reduced counts, same ratio as before.
function buildStarfield(lowGraphics) {
  const sprite = getRadialDotTexture();
  const group = new THREE.Group();
  group.add(buildStarLayer(lowGraphics ? 1400 : 7500, 1.1, 300, sprite));
  group.add(buildStarLayer(lowGraphics ? 100 : 450, 2, 280, sprite));
  if (!lowGraphics) group.add(buildStarLayer(15, 3.2, 260, sprite));
  return group;
}

// The Sun: a camera-facing billboard at the origin, the same point used as
// the light source, so the visible glow and the lighting direction are
// consistent. Never added to the objects Map, so raycastAt() (which only
// intersects objects.values()) automatically skips it — it isn't
// selectable, isn't in the object list, and isn't scientific content.
function buildSunSprite() {
  const material = new THREE.SpriteMaterial({
    map: getRadialDotTexture(),
    color: 0xfff2c8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(6, 6, 1);
  sprite.position.set(0, 0, 0);
  return sprite;
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
  const geometry = new THREE.SphereGeometry(150, lowGraphics ? 24 : 32, lowGraphics ? 12 : 16);
  const material = new THREE.MeshBasicMaterial({
    map: loadMilkyWayTexture(),
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
  });
  return new THREE.Mesh(geometry, material);
}

export function createCosmosScene(canvas, { lowGraphics = false, onFrame = null } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
  camera.position.set(0, 4, 16);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowGraphics });
  renderer.setPixelRatio(lowGraphics ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

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
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));
  const sunLight = new THREE.PointLight(0xffffff, 2.2, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);
  scene.add(buildSunSprite());

  const milkyWay = buildMilkyWay(lowGraphics);
  scene.add(milkyWay);
  scene.add(buildStarfield(lowGraphics));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 2;
  controls.maxDistance = 400;

  const layout = computeLayout();
  const objects = new Map();
  for (const entry of layout) {
    // Earth's atmosphere shader brightens on whichever side faces the Sun
    // (the origin) — the same physical relationship the PointLight above
    // already uses, just expressed as a per-mesh direction for the shader.
    const sunDir = new THREE.Vector3(
      entry.position.x,
      entry.position.y,
      entry.position.z,
    )
      .negate()
      .normalize();
    const mesh = buildObjectMesh(entry.id, lowGraphics, sunDir);
    mesh.position.set(entry.position.x, entry.position.y, entry.position.z);
    mesh.userData.objectId = entry.id;
    scene.add(mesh);
    objects.set(entry.id, { ...entry, mesh });
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
  const MILKY_WAY_OPACITY_IN_GALAXY = 0.85;
  const MILKY_WAY_OPACITY_EXTRAGALACTIC = 0.15;

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

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener("resize", resize);

  let flight = null; // { fromPos, toPos, fromTarget, toTarget, start, duration }

  function flyTo(objectId, { onArrive } = {}) {
    const entry = objects.get(objectId);
    if (!entry) return;
    const targetPos = entry.mesh.position;
    const approachDistance = 6;
    const desiredCamera = targetPos.clone().add(new THREE.Vector3(0, 1.2, 1).setLength(approachDistance));
    flight = {
      fromPos: camera.position.clone(),
      toPos: desiredCamera,
      fromTarget: controls.target.clone(),
      toTarget: targetPos.clone(),
      start: performance.now(),
      duration: 1200,
      onArrive,
    };
    setMilkyWayTarget(objectId);
  }

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
      if (!flight) onFrame?.(deltaSeconds);
      controls.update();
      for (const { mesh } of objects.values()) {
        mesh.rotation.y += 0.001;
        // The cloud shell drifts slightly faster than the globe beneath it,
        // which is the one cue that reads as "clouds moving" rather than
        // "texture painted on."
        const clouds = mesh.children.find((child) => child.userData.isCloudLayer);
        if (clouds) clouds.rotation.y += 0.0006;
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  function raycastAt(ndcX, ndcY) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const meshes = [...objects.values()].map((o) => o.mesh);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    let node = hits[0].object;
    while (node && !node.userData.objectId) node = node.parent;
    return node?.userData.objectId ?? null;
  }

  return { scene, camera, renderer, controls, objects, flyTo, raycastAt, resize };
}
