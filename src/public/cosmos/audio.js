// Original, optional synthesised ambience. No recordings or autoplay.
export function createAmbience(button) {
  let context, gain, voices = [], enabled = false, destination = 'earth';
  function tune() {
    if (!context) return;
    const moods = { earth: [73.42, [1, 1.5, 2.002, 2.25]], saturn: [65.41, [1, 1.498, 2, 2.5]], betelgeuse: [55, [1, 1.26, 1.5, 2.01]], 'gaia-bh1': [49, [1, 1.059, 1.5, 2]], andromeda: [82.41, [1, 1.5, 2, 2.52]], quipu: [65.41, [1, 1.067, 1.5, 2.001]], 'great-wall': [43.65, [1, 1.189, 1.498, 2.002]] };
    const [base, intervals] = moods[destination] ?? moods.earth;
    intervals.forEach((ratio, i) => voices[i].frequency.setTargetAtTime(base * ratio, context.currentTime, 2));
  }
  button.addEventListener('click', async () => {
    try {
      if (!context) {
        context = new AudioContext(); gain = context.createGain();gain.gain.value=0;gain.connect(context.destination);
        voices = [1,1.5,2.002,2.25].map((ratio,i)=>{const osc=context.createOscillator(),level=context.createGain();osc.type='sine';level.gain.value=i===0?.4:.13;osc.connect(level);level.connect(gain);osc.start();return osc;});tune();
      }
      await context.resume();enabled=!enabled;
      gain.gain.setTargetAtTime(enabled?.09:0,context.currentTime,.5);
      button.textContent=enabled?'Sound on':'Sound off';button.setAttribute('aria-pressed',String(enabled));
    } catch { button.textContent='Sound unavailable';button.disabled=true; }
  });
  document.addEventListener('visibilitychange',()=>{if(context)gain.gain.setTargetAtTime(enabled&&!document.hidden?.09:0,context.currentTime,.25);});
  return { setDestination(id){destination=id;tune();} };
}
