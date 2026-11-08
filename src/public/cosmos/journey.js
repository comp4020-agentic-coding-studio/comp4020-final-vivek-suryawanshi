// Optional journey; every asynchronous arrival is tied to its visit token.
export const JOURNEY_STOPS = [
  { id: 'earth', title: 'Begin with the familiar.', text: 'Oceans, weather, a thin blue atmosphere. Everything we know as home fits on this one world.', question: 'Look at the boundary between day and night. What becomes visible in the darkness?' },
  { id: 'saturn', title: 'A giant, wearing ice.', text: 'Beyond the rocky planets, sunlight reaches a world wrapped in countless fragments of ice and rock.', question: 'The rings look solid from here. Imagine moving close enough to see the spaces between their pieces.' },
  { id: 'betelgeuse', title: 'Our Sun is no giant.', text: 'Leave the Solar System for a red supergiant. Betelgeuse has expanded far beyond the scale of a star like our Sun.', question: 'Open “Compare sizes” later to see how small our own star becomes beside this estimate.' },
  { id: 'gaia-bh1', title: 'The evidence is in the motion.', text: 'One ordinary-looking star has an extraordinary companion. The dormant black hole gives off no detectable light here.', question: 'We show only the visible star. The black hole is inferred from its gravitational influence—not a glowing disc.' },
  { id: 'andromeda', title: 'An entire galaxy, in one view.', text: 'A distant island of stars becomes a single destination. Light from Andromeda has travelled for about 2.5 million years to reach us.', question: 'The spiral here is an illustration. Open Facts to separate observation from predictions about the galaxy’s future.' },
  { id: 'quipu', title: 'Galaxies become threads.', text: 'At a much larger scale, clusters trace enormous connected structures. Quipu takes its name from the Inca’s knotted recording cords.', question: 'This model suggests the branching form of the cosmic web; the points are not measured survey coordinates.' },
  { id: 'great-wall', title: 'End with an open question.', text: 'The Hercules–Corona Borealis Great Wall is a proposed structure inferred from a concentration of gamma-ray bursts.', question: 'Its interpretation remains debated. What is the difference between seeing a pattern and establishing what caused it?' },
];

export function createJourney({ visit, onChange, dwellMs = 18000, clock = { now: () => performance.now(), set: (fn, delay) => setTimeout(fn, delay), clear: id => clearTimeout(id) } }) {
  let active = false, paused = false, hidden = false, travelling = false, index = 0;
  let token = 0, timer = null, deadline = 0, remaining = dwellMs;
  const state = () => ({ active, paused, travelling, index, stop: JOURNEY_STOPS[index], total: JOURNEY_STOPS.length, remaining });
  const emit = () => onChange(state());
  function disarm() {
    if (timer !== null) { remaining = Math.max(0, deadline - clock.now()); clock.clear(timer); timer = null; }
  }
  function arm() {
    if (!active || paused || hidden || travelling || timer !== null) return;
    deadline = clock.now() + remaining;
    timer = clock.set(() => { timer = null; if (index === JOURNEY_STOPS.length - 1) stop(true); else go(index + 1); }, remaining);
  }
  function go(next) {
    disarm(); index = Math.max(0, Math.min(JOURNEY_STOPS.length - 1, next)); remaining = dwellMs; travelling = true;
    const visitToken = ++token;
    emit();
    visit(JOURNEY_STOPS[index].id, () => {
      if (!active || token !== visitToken) return;
      travelling = false; arm(); emit();
    });
  }
  function stop(completed = false) {
    if (!active) return;
    disarm(); active = false; travelling = false; token++; onChange({ ...state(), completed });
  }
  return {
    start() { active = true; paused = false; go(0); },
    stop,
    next() { if (!active) return; if (index === JOURNEY_STOPS.length - 1) stop(true); else go(index + 1); },
    previous() { if (active) go(index - 1); },
    pause() { if (!active) return; disarm(); paused = true; emit(); },
    resume() { if (!active) return; paused = false; arm(); emit(); },
    setHidden(value) { hidden = value; if (hidden) disarm(); else arm(); },
    get state() { return state(); },
  };
}
