// Real (approximate) distances, in light-years, and a distinct direction for
// each object so they spread out in 3D rather than lining up on one ray.
// Kept dependency-free (no three.js import) so this math is unit-testable
// directly in Node/JSDOM.
export const OBJECTS = [
  { id: "earth", name: "Earth", distanceLy: 0.0000158 },
  { id: "saturn", name: "Saturn", distanceLy: 0.00015 },
  { id: "betelgeuse", name: "Betelgeuse", distanceLy: 548 },
  { id: "gaia-bh1", name: "Gaia BH1", distanceLy: 1560 },
  { id: "andromeda", name: "Andromeda Galaxy", distanceLy: 2_500_000 },
  { id: "quipu", name: "Quipu", distanceLy: 1_200_000_000 },
  { id: "great-wall", name: "Hercules–Corona Borealis Great Wall", distanceLy: 10_000_000_000 },
];

const DIRECTIONS = {
  earth: [1, 0, 0],
  saturn: [0.8, 0.3, 0.5],
  betelgeuse: [-1, 0.2, 0.3],
  "gaia-bh1": [0.2, -1, 0.4],
  andromeda: [-0.3, 0.5, -1],
  quipu: [1, -0.5, -0.8],
  "great-wall": [-0.6, -0.8, 0.6],
};

const SCALE = 40; // scene units per decade of log10(1 + lightYears)
const FLOOR = 6; // minimum radius for the nearest object, so it isn't at the origin
const MIN_GAP = 6; // minimum radius difference between successive objects

function normalize([x, y, z]) {
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / len, y / len, z / len];
}

function rawRadius(distanceLy) {
  return SCALE * Math.log10(1 + distanceLy);
}

// The real distances span from light-minutes to ~10 billion light-years: on
// a log scale the two solar-system bodies land almost exactly on top of each
// other near the origin. Rather than abandon the log scale, this walks the
// objects in distance order and nudges each one's radius up just enough to
// stay clearly outside the previous one — a floor for the nearest object and
// a minimum gap after that. Every object's position still orders and spaces
// out by its real log-distance once that distance is large enough to matter;
// only the near pair actually gets nudged.
export function computeLayout() {
  const sorted = [...OBJECTS].sort((a, b) => a.distanceLy - b.distanceLy);
  let previousRadius = 0;
  return sorted.map((object, index) => {
    const raw = rawRadius(object.distanceLy);
    const radius = index === 0 ? Math.max(raw, FLOOR) : Math.max(raw, previousRadius + MIN_GAP);
    previousRadius = radius;
    const [dx, dy, dz] = normalize(DIRECTIONS[object.id] ?? [1, 0, 0]);
    return {
      ...object,
      radius,
      position: { x: dx * radius, y: dy * radius, z: dz * radius },
    };
  });
}
