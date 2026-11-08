// Approximate equatorial diameters. Betelgeuse uses the existing Joyce et al.
// (2020) estimate of 764 solar radii, so the same factor applies to diameters.
export const SCALE_BODIES = {
  earth: { name: 'Earth', diameterKm: 12756, color: '#62a9e8', texture: 'earth_daymap', source: 'https://science.nasa.gov/earth/facts/' },
  saturn: { name: 'Saturn', diameterKm: 120500, color: '#dec28f', texture: 'saturn_bands', source: 'https://science.nasa.gov/saturn/facts/' },
  sun: { name: 'Sun', diameterKm: 1400000, color: '#ffe2a1', source: 'https://science.nasa.gov/sun/facts/' },
  betelgeuse: { name: 'Betelgeuse', diameterKm: 1400000 * 764, color: '#f49454', source: 'https://iopscience.iop.org/article/10.3847/1538-4357/abb8db' },
};
/** @type {{id:string,small:keyof typeof SCALE_BODIES,large:keyof typeof SCALE_BODIES,label:string}[]} */
export const SCALE_PAIRS = [
  { id: 'earth-saturn', small: 'earth', large: 'saturn', label: 'Earth & Saturn' },
  { id: 'earth-sun', small: 'earth', large: 'sun', label: 'Earth & Sun' },
  { id: 'sun-betelgeuse', small: 'sun', large: 'betelgeuse', label: 'Sun & Betelgeuse' },
];

export function comparisonLayout(pair, width, height, progress) {
  const small = SCALE_BODIES[pair.small], large = SCALE_BODIES[pair.large];
  const ratio = large.diameterKm / small.diameterKm;
  const maxDiameter = Math.max(60, Math.min(height * .66, width * .62));
  const zoom = Math.pow(ratio, Math.max(0, Math.min(1, progress)));
  const diameterLarge = maxDiameter * zoom, diameterSmall = diameterLarge / ratio;
  const gap = maxDiameter / ratio * .4;
  const centreGap = maxDiameter / 2 + maxDiameter / ratio / 2 + gap;
  const initialSmall = (width - maxDiameter - maxDiameter / ratio - gap) / 2 + maxDiameter / ratio / 2;
  const xSmall = initialSmall + (width * .32 - initialSmall) * progress;
  return { ratio, zoom, diameterSmall, diameterLarge, xSmall, xLarge: xSmall + centreGap * zoom, y: height * .47 };
}
