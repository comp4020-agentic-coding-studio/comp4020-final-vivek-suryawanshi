import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createJourney, JOURNEY_STOPS } from '../src/public/cosmos/journey.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function harness() {
  const visits: Array<{id: string; arrive: () => void}> = [];
  const changes: Array<{active: boolean; completed?: boolean}> = [];
  const journey = createJourney({ visit(id: string, arrive: () => void) { visits.push({id, arrive}); }, onChange(state: {active: boolean; completed?: boolean}) { changes.push(state); }, dwellMs: 1000 });
  return { journey, visits, changes };
}
it('starts its dwell only after arrival, then advances exactly once', () => {
  const {journey, visits} = harness(); journey.start(); vi.advanceTimersByTime(10000); expect(visits).toHaveLength(1);
  visits[0].arrive(); vi.advanceTimersByTime(999); expect(visits).toHaveLength(1); vi.advanceTimersByTime(1); expect(visits[1].id).toBe('saturn');
});
it('preserves time remaining across pause and resume', () => {
  const {journey, visits} = harness(); journey.start(); visits[0].arrive(); vi.advanceTimersByTime(400); journey.pause();
  vi.advanceTimersByTime(4000); expect(visits).toHaveLength(1); journey.resume(); vi.advanceTimersByTime(599); expect(visits).toHaveLength(1); vi.advanceTimersByTime(1); expect(visits).toHaveLength(2);
});
it('ignores a stale camera arrival after skipping or exiting', () => {
  const {journey, visits} = harness(); journey.start(); journey.next(); visits[0].arrive(); vi.advanceTimersByTime(3000); expect(visits).toHaveLength(2);
  journey.stop(); visits[1].arrive(); vi.advanceTimersByTime(3000); expect(visits).toHaveLength(2); expect(journey.state.active).toBe(false);
});
it('does not resume an explicit pause when the tab becomes visible', () => {
  const {journey, visits} = harness(); journey.start(); visits[0].arrive(); journey.pause(); journey.setHidden(true); journey.setHidden(false); vi.advanceTimersByTime(3000); expect(visits).toHaveLength(1);
});
it('stops at the last destination without wrapping or leaving an auto-advance timer', () => {
  const {journey, visits, changes} = harness(); journey.start();
  for (let i=0; i<JOURNEY_STOPS.length; i++) { visits[i].arrive(); vi.advanceTimersByTime(1000); }
  expect(visits.map(v=>v.id)).toEqual(JOURNEY_STOPS.map(stop=>stop.id)); expect(changes.at(-1)?.completed).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
it('can restart while travelling without reviving a previous journey', () => {
  const {journey, visits} = harness(); journey.start(); journey.next(); journey.start(); visits[1].arrive(); vi.advanceTimersByTime(2000); expect(visits).toHaveLength(3); expect(journey.state.index).toBe(0);
});
