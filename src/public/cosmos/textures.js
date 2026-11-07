import * as THREE from "three";

// A handful of small (<= ~110 KB each) CC-BY-licensed texture images make
// Saturn and Earth read as real planets instead of flat-shaded spheres —
// see src/content/CREDITS.md for the exact source and licence of each file.
// One shared loader/cache: multiple calls for the same texture (e.g.
// reopening the education panel, which clones meshes) reuse one GPU upload
// instead of re-decoding the image every time.
const loader = new THREE.TextureLoader();
const cache = new Map();

function loadTexture(path, { colorSpace } = {}) {
  if (cache.has(path)) return cache.get(path);
  const texture = loader.load(path);
  if (colorSpace) texture.colorSpace = colorSpace;
  cache.set(path, texture);
  return texture;
}

export function loadSaturnBandsTexture() {
  return loadTexture("/cosmos/assets/saturn_bands.jpg", { colorSpace: THREE.SRGBColorSpace });
}

export function loadSaturnRingTexture() {
  const texture = loadTexture("/cosmos/assets/saturn_ring_alpha.png");
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function loadEarthDaymapTexture() {
  return loadTexture("/cosmos/assets/earth_daymap.jpg", { colorSpace: THREE.SRGBColorSpace });
}

export function loadEarthCloudsTexture() {
  return loadTexture("/cosmos/assets/earth_clouds.jpg");
}

export function loadMilkyWayTexture() {
  return loadTexture("/cosmos/assets/milkyway.jpg", { colorSpace: THREE.SRGBColorSpace });
}

// A soft round dot, drawn once to an offscreen canvas rather than fetched
// over the network — used as the point sprite for both the starfield and
// the Sun glow, so neither needs its own texture asset. Cached so every
// caller shares one GPU upload.
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
