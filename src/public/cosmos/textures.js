import * as THREE from "three";

// CC-BY-licensed texture images make Saturn and Earth read as real planets
// instead of flat-shaded spheres — see src/content/CREDITS.md for the exact
// source and licence of each file. Each one ships as a normal-mode and a
// smaller `_lg` low-graphics file; callers pass `lowGraphics` and this picks
// the right one. One shared loader/cache: multiple calls for the same
// texture (e.g. reopening the education panel, which clones meshes) reuse
// one GPU upload instead of re-decoding the image every time.
const loader = new THREE.TextureLoader();
const cache = new Map();

function loadTexture(path, { colorSpace } = {}) {
  if (cache.has(path)) return cache.get(path);
  const texture = loader.load(path);
  if (colorSpace) texture.colorSpace = colorSpace;
  cache.set(path, texture);
  return texture;
}

function variant(base, lowGraphics) {
  if (!lowGraphics) return `/cosmos/assets/${base}`;
  return `/cosmos/assets/${base.replace(/\.(jpg|png)$/, "_lg.$1")}`;
}

export function loadSaturnBandsTexture(lowGraphics) {
  return loadTexture(variant("saturn_bands.jpg", lowGraphics), { colorSpace: THREE.SRGBColorSpace });
}

export function loadSaturnRingTexture(lowGraphics) {
  const texture = loadTexture(variant("saturn_ring_alpha.png", lowGraphics));
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function loadEarthDaymapTexture(lowGraphics) {
  return loadTexture(variant("earth_daymap.jpg", lowGraphics), { colorSpace: THREE.SRGBColorSpace });
}

// Earth's city-lights texture is only ever used on the night shader (see
// atmosphere.js's day/night material), which only exists in normal mode —
// no low-graphics variant is loaded.
export function loadEarthNightTexture() {
  return loadTexture("/cosmos/assets/earth_night.jpg", { colorSpace: THREE.SRGBColorSpace });
}

export function loadEarthCloudsTexture() {
  return loadTexture("/cosmos/assets/earth_clouds.jpg");
}

export function loadMilkyWayTexture(lowGraphics) {
  return loadTexture(variant("milkyway.jpg", lowGraphics), { colorSpace: THREE.SRGBColorSpace });
}

// A soft round dot, drawn once to an offscreen canvas rather than fetched
// over the network — used as the point sprite for the starfield. Cached so
// every caller shares one GPU upload.
let dotTexture = null;
export function getRadialDotTexture() {
  if (dotTexture) return dotTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.8)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  dotTexture = new THREE.CanvasTexture(canvas);
  return dotTexture;
}

// A larger, softer radial glow used for the Sun sprite — a bigger falloff
// radius than the star dot so it reads as a glowing disc with a gradual
// fade, not a hard-edged point.
let sunGlowTexture = null;
export function getSunGlowTexture() {
  if (sunGlowTexture) return sunGlowTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.15, "rgba(255,250,230,1)");
  gradient.addColorStop(0.35, "rgba(255,230,160,0.9)");
  gradient.addColorStop(0.6, "rgba(255,200,110,0.35)");
  gradient.addColorStop(1, "rgba(255,180,90,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sunGlowTexture = new THREE.CanvasTexture(canvas);
  return sunGlowTexture;
}

// RingGeometry's built-in UVs are a flat XY projection (u,v both derived from
// x/y position), which is right for a texture drawn to look like a ring but
// wrong for solarsystemscope's ring texture: that image is a 1D radial
// brightness/alpha *profile*, constant down its height, meant to be read
// left-to-right from inner edge to outer edge. This replaces the UVs so each
// vertex's u is purely a function of its distance from the centre —
// (radius - innerRadius) / (outerRadius - innerRadius) — which is what that
// kind of profile texture expects.
export function applyRadialRingUVs(ringGeometry, innerRadius, outerRadius) {
  const position = ringGeometry.attributes.position;
  const uv = ringGeometry.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const radius = Math.sqrt(v.x * v.x + v.y * v.y);
    const u = (radius - innerRadius) / (outerRadius - innerRadius);
    uv.setXY(i, u, 0.5);
  }
  uv.needsUpdate = true;
}
