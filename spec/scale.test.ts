import { expect, it } from 'vitest';
import { SCALE_BODIES, SCALE_PAIRS, comparisonLayout } from '../src/public/cosmos/scale-model.js';

it('preserves the diameter ratio at every zoom and marking viewport', () => {
  for (const pair of SCALE_PAIRS) for (const [width,height] of [[820,300],[350,240]]) for (const progress of [0,.25,.5,.75,1]) {
    const l=comparisonLayout(pair,width,height,progress);
    expect(l.diameterLarge/l.diameterSmall).toBeCloseTo(SCALE_BODIES[pair.large].diameterKm/SCALE_BODIES[pair.small].diameterKm,8);
    expect(l.xSmall).toBeGreaterThan(0); expect(l.xSmall).toBeLessThan(width); expect(Number.isFinite(l.xLarge)).toBe(true);
  }
});
it('fits both objects initially and makes the smaller disc visible at maximum zoom', () => {
  for (const pair of SCALE_PAIRS) {
    const start=comparisonLayout(pair,350,240,0),end=comparisonLayout(pair,350,240,1);
    expect(start.xSmall-start.diameterSmall/2).toBeGreaterThanOrEqual(0);
    expect(start.xLarge+start.diameterLarge/2).toBeLessThanOrEqual(350);
    expect(end.diameterSmall).toBeCloseTo(start.diameterLarge);
  }
});
