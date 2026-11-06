import * as THREE from "three";

// A small dedicated scene/camera/renderer for the education panel's rotating
// model preview, independent of the main scene. Its render loop only runs
// while the panel is open (start()/stop()) so it costs nothing on phones
// once the panel is closed.
export function createPanelPreview(canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(2, 2, 4);
  scene.add(light);

  let current = null;
  let frameId = null;

  function resize() {
    const width = canvas.clientWidth || 200;
    const height = canvas.clientHeight || 200;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // The mesh handed in is a clone straight out of the main 3D scene, so it
  // still carries its real position out among the log-scaled planets (tens
  // to hundreds of units from the origin) — rendering it as-is would put it
  // entirely outside this preview's view frustum, which is the bug this
  // fixes. Re-centering it at the origin and framing the camera to its
  // bounding sphere makes every object, from a small sphere to the Great
  // Wall's scattered point cloud, fill the preview regardless of its size or
  // position in the main scene.
  function show(mesh) {
    if (current) scene.remove(current);

    mesh.position.set(0, 0, 0);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    mesh.position.sub(sphere.center);

    const radius = Math.max(sphere.radius, 0.01);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distance = (radius / Math.sin(fov / 2)) * 1.6;
    camera.position.set(0, 0, distance);
    camera.near = Math.max(0.01, distance - radius * 4);
    camera.far = distance + radius * 4;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

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
