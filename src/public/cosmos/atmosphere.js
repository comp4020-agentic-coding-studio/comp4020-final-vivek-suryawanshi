import * as THREE from "three";

// Earth's atmospheric rim: a Fresnel glow (brighter where the view direction
// grazes the surface, near the silhouette) rather than a uniform tint — no
// stock Three.js material can do this, so this is the one small custom
// shader in the scene. Kept in its own file so scene.js doesn't grow a GLSL
// block. The rim is brighter on the lit side and dimmer (not absent) on the
// dark side, following the same sunDir used for the scene's lighting.
export function createAtmosphereMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunDirection: { value: sunDir.clone() },
      glowColor: { value: new THREE.Color(0x6fb4ff) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
        rim = pow(rim, 2.5);
        float sunFacing = max(dot(vNormal, sunDirection), 0.0);
        float lightFactor = mix(0.35, 1.0, sunFacing);
        gl_FragColor = vec4(glowColor, rim * lightFactor * 0.9);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
}
