import * as THREE from "three";

// Keyboard orbit/zoom layered on top of OrbitControls, which already gives
// mouse drag/wheel and touch one-finger-rotate / two-finger-pinch. Arrow
// keys and WASD orbit the camera around the current target; +/- (and =/_)
// dolly in and out. Ignored while a text input/textarea has focus so typing
// a name or an observation never also spins the camera.
export function attachKeyboardControls(camera, controls) {
  const pressed = new Set();

  function isTyping() {
    const el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }

  window.addEventListener("keydown", (event) => {
    if (isTyping() || document.activeElement?.closest("dialog, button, nav, a")) return;
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","-","=","_","w","a","s","d"].includes(event.key)) {event.preventDefault();pressed.add(event.key.toLowerCase());}
  });
  window.addEventListener("keyup", (event) => {
    pressed.delete(event.key.toLowerCase());
  });
  window.addEventListener("blur", () => pressed.clear());

  const orbitSpeed = 1.4; // radians/sec
  const zoomSpeed = 8; // units/sec

  return function update(deltaSeconds) {
    if (isTyping() || document.activeElement?.closest("dialog, button, nav, a")) {pressed.clear();return;}
    if (pressed.size === 0) return;

    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    if (pressed.has("arrowleft") || pressed.has("a")) spherical.theta += orbitSpeed * deltaSeconds;
    if (pressed.has("arrowright") || pressed.has("d")) spherical.theta -= orbitSpeed * deltaSeconds;
    if (pressed.has("arrowup") || pressed.has("w")) spherical.phi -= orbitSpeed * deltaSeconds;
    if (pressed.has("arrowdown") || pressed.has("s")) spherical.phi += orbitSpeed * deltaSeconds;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    if (pressed.has("+") || pressed.has("=")) spherical.radius -= zoomSpeed * deltaSeconds;
    if (pressed.has("-") || pressed.has("_")) spherical.radius += zoomSpeed * deltaSeconds;
    spherical.radius = Math.max(controls.minDistance, Math.min(controls.maxDistance, spherical.radius));

    camera.position.setFromSpherical(spherical).add(controls.target);
  };
}
