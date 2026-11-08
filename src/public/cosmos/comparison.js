import { SCALE_BODIES, SCALE_PAIRS, comparisonLayout } from './scale-model.js';

export function createComparison({ dialog, onOpen }) {
  const canvas = document.getElementById('comparison-canvas');
  const ctx = canvas.getContext('2d');
  const slider = document.getElementById('comparison-zoom');
  const tabs = document.getElementById('comparison-pairs');
  const images = new Map();
  let pair = SCALE_PAIRS[0], trigger = null;
  for (const body of Object.values(SCALE_BODIES)) {
    if (!body.texture) continue;
    const image = new Image(); image.onload = draw; image.src = `/cosmos/assets/${body.texture}.jpg`; images.set(body.texture, image);
  }
  function drawBody(body, x, y, diameter) {
    const r = diameter / 2;
    if (x - r > canvas.clientWidth || x + r < 0) return;
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    const image = images.get(body.texture);
    if (image?.complete && image.naturalWidth) ctx.drawImage(image, x - r, y - r, diameter, diameter);
    else { ctx.fillStyle = body.color; ctx.fillRect(x - r, y - r, diameter, diameter); }
    const shade = ctx.createRadialGradient(x - r * .4, y - r * .4, 0, x + r * .2, y, r * 1.2);
    shade.addColorStop(0, 'rgba(255,255,255,.1)'); shade.addColorStop(.6, 'rgba(0,0,0,.08)'); shade.addColorStop(1, 'rgba(0,0,0,.65)');
    ctx.fillStyle = shade; ctx.fillRect(x - r, y - r, diameter, diameter); ctx.restore();
  }
  function draw() {
    if (!dialog.open || !ctx) return;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#03080e'; ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 100; i++) { ctx.fillStyle = i % 7 ? '#283a48' : '#8c9da9'; ctx.fillRect((i * 137.37) % width, (i * 71.17) % height, 1, 1); }
    const small = SCALE_BODIES[pair.small], large = SCALE_BODIES[pair.large];
    const layout = comparisonLayout(pair, width, height, Number(slider.value) / 100);
    drawBody(large, layout.xLarge, layout.y, layout.diameterLarge);
    drawBody(small, layout.xSmall, layout.y, layout.diameterSmall);
    // Guide lines locate tiny discs without silently increasing their diameters.
    ctx.strokeStyle = '#87b7c3'; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(layout.xSmall, layout.y + layout.diameterSmall / 2 + 7); ctx.lineTo(layout.xSmall, height - 40); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#dce8ed'; ctx.font = '12px Arial'; ctx.textAlign = 'center'; ctx.fillText(small.name, layout.xSmall, height - 21);
    if (layout.xLarge < width - 35) ctx.fillText(large.name, layout.xLarge, Math.min(height - 21, layout.y + layout.diameterLarge / 2 + 25));
    const clipped = layout.xLarge + layout.diameterLarge / 2 > width || layout.diameterLarge > height;
    document.getElementById('comparison-view-label').textContent = clipped ? `${large.name} continues beyond the frame. Both discs keep the same diameter scale.` : 'Both discs use the same diameter scale. The space between them is illustrative.';
    document.getElementById('comparison-zoom-value').textContent = `${layout.zoom.toFixed(layout.zoom < 10 ? 1 : 0)}× view magnification`;
    slider.setAttribute('aria-valuetext', `${Math.round(Number(slider.value))}% towards ${small.name}; ${layout.zoom.toFixed(1)} times view magnification`);
  }
  function select(next) {
    pair = next; slider.value = '0';
    for (const button of tabs.children) { const active = button.dataset.pair === pair.id; button.setAttribute('aria-pressed', String(active)); }
    const small = SCALE_BODIES[pair.small], large = SCALE_BODIES[pair.large], ratio = large.diameterKm / small.diameterKm;
    document.getElementById('comparison-title').textContent = `${small.name}, meet ${large.name}.`;
    document.getElementById('comparison-ratio').textContent = `${large.name} is about ${ratio.toLocaleString('en-AU', { maximumFractionDigits: ratio < 10 ? 1 : 0 })}× wider than ${small.name === "Sun" ? "the Sun" : small.name}.`;
    document.getElementById('comparison-small-label').textContent = `Zoom towards ${small.name === "Sun" ? "the Sun" : small.name}`;
    document.getElementById('comparison-note').textContent = pair.large === 'betelgeuse' ? 'Betelgeuse is variable and its size is uncertain. This uses Joyce et al. (2020): about 764 solar radii. Colours are illustrative; this is a diameter comparison.' : 'Approximate equatorial diameters. Saturn’s rings are omitted so the comparison measures the planet itself. Textures are illustrative.';
    const sources = document.getElementById('comparison-sources'); sources.replaceChildren();
    for (const body of [small, large]) { const a = document.createElement('a'); a.href = body.source; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = `${body.name} source ↗`; sources.append(a); }
    draw();
  }
  for (const item of SCALE_PAIRS) { const button = document.createElement('button'); button.type = 'button'; button.dataset.pair = item.id; button.textContent = item.label; button.addEventListener('click', () => select(item)); tabs.append(button); }
  slider.addEventListener('input', draw);
  document.getElementById('comparison-reset').addEventListener('click', () => { slider.value = '0'; draw(); });
  document.getElementById('comparison-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { trigger?.focus(); });
  window.addEventListener('resize', draw);
  return { open(button, destination) { trigger = button; onOpen(); if (!dialog.open) dialog.showModal(); select(SCALE_PAIRS[destination === 'betelgeuse' || destination === 'gaia-bh1' ? 2 : 0]); document.getElementById('comparison-close').focus(); } };
}
