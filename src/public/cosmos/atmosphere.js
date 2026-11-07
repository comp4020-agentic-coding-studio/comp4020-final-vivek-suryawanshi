import * as THREE from "three";

// Custom ShaderMaterials bypass Three's automatic linear-to-sRGB output
// conversion (the `colorspace_fragment` chunk built-in materials get for
// free), so a texture loaded with sRGBColorSpace — hardware-decoded to
// linear on sampling — would otherwise be written out still in linear
// space, reading as washed-out and muddy next to correctly-encoded
// neighbours. This is the standard sRGB OETF, applied by hand at the end
// of each fragment shader below that samples an sRGB texture.
const SRGB_ENCODE_GLSL = `
  vec3 linearToSRGB(vec3 c) {
    vec3 higher = pow(c, vec3(0.41666)) * 1.055 - vec3(0.055);
    vec3 lower = c * 12.92;
    return mix(higher, lower, vec3(lessThanEqual(c, vec3(0.0031308))));
  }
`;

// Earth's surface: a day/night shader that blends between the lit daymap
// and the night-lights texture based on the angle to the Sun, rather than
// relying on Three.js's standard per-fragment lighting alone — a stock
// MeshStandardMaterial lit by a point light already darkens the night
// side, but it has no night-lights texture to fade in there, and the
// terminator falloff needs to be tuned by eye (it's much softer in nature
// — twilight — than a lighting equation alone produces). The night texture
// is masked to fade in only once a fragment is past the terminator, and
// fades out again well before full daylight, so city lights don't bleed
// into the lit hemisphere.
export function createEarthSurfaceMaterial({ dayMap, nightMap, sunDir }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      sunDirection: { value: sunDir.clone() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      ${SRGB_ENCODE_GLSL}
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vec3 day = texture2D(dayMap, vUv).rgb;
        vec3 night = texture2D(nightMap, vUv).rgb;
        float sunFacing = dot(vNormal, sunDirection);
        // Smooth, twilight-width terminator rather than a hard day/night
        // split: fully day above +0.15, fully night below -0.15, blended
        // in between.
        float dayAmount = smoothstep(-0.15, 0.15, sunFacing);
        // City lights only belong on the dark side, fading out approaching
        // the terminator so they never appear to "glow through" daylight.
        vec3 litDay = day * (0.009 + 1.15 * max(sunFacing, 0.0)) * dayAmount;
        vec3 cityLights = night * (1.0 - dayAmount) * 1.2;
        gl_FragColor = vec4(linearToSRGB(litDay + cityLights), 1.0);
      }
    `,
  });
}

// Earth's atmospheric rim: a Fresnel glow (brighter where the view direction
// grazes the surface, near the silhouette) rather than a uniform tint — no
// stock Three.js material can do this, so this is a small custom shader.
// Kept in its own file so scene.js doesn't grow a GLSL block. The rim is
// brightest near the sunlit edge and dimmer (not absent) on the dark side,
// following the same sunDir used for the scene's lighting.
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
      ${SRGB_ENCODE_GLSL}
      uniform vec3 sunDirection;
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = 1.0 - abs(dot(viewDir, normalize(vNormal)));
        rim = pow(rim, 3.0);
        float sunFacing = max(dot(vNormal, sunDirection), 0.0);
        // Strongest near the sunlit edge, present but dim on the dark
        // side — real atmospheric limb glow doesn't vanish at night.
        float lightFactor = mix(0.25, 1.0, sunFacing);
        gl_FragColor = vec4(linearToSRGB(glowColor), rim * lightFactor * 0.48);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
}
