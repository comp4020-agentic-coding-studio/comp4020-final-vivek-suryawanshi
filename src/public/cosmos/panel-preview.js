import * as THREE from "three";

// A small dedicated scene/camera/renderer for the education panel's rotating
// model preview, independent of the main scene. Its render loop only runs
// while the panel is open (start()/stop()) so it costs nothing on phones
// once the panel is closed.
export function createPanelPreview(canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 6);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(2, 2, 4);
  scene.add(light);

  let current = null;
  let frameId = null;

  function resize() {
    const size = Math.min(canvas.clientWidth || 200, canvas.clientHeight || 200) || 200;
    renderer.setSize(canvas.clientWidth || size, canvas.clientHeight || size, false);
    camera.aspect = (canvas.clientWidth || size) / (canvas.clientHeight || size);
    camera.updateProjectionMatrix();
  }

  function show(mesh) {
    if (current) scene.remove(current);
    current = mesh;
    scene.add(current);
  }

  function render() {
    if (current) current.rotation.y += 0.01;
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(render);
  }

  function start(mesh) {
    resize();
    show(mesh);
    stop();
    frameId = requestAnimationFrame(render);
  }

  function stop() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  }

  return { start, stop, resize };
}
