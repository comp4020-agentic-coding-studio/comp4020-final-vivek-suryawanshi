import * as THREE from 'three';
import { getRadialDotTexture, getSunGlowTexture } from './textures.js';

// Seeded illustrative geometry: reloads never pretend to reveal a different survey.
function randomSeed(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function pointMesh(positions, colors, size) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size, map: getRadialDotTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .85 }));
}
export function createStar(radius, warm = true, low = false) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, low ? 32 : 64, low ? 20 : 48), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, warm: { value: warm ? 1 : 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float time;uniform float warm;varying vec3 vP;varying vec3 vN;varying vec3 vW;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 p=normalize(vP);float n=noise(p*9.+time*.03)*.6+noise(p*23.-time*.02)*.28+noise(p*65.)*.12;float limb=pow(max(dot(normalize(vN),normalize(cameraPosition-vW)),0.),.35);vec3 dark=mix(vec3(.65,.24,.035),vec3(.44,.045,.008),warm);vec3 light=mix(vec3(1.,.92,.63),vec3(1.,.49,.09),warm);vec3 c=mix(dark,light,smoothstep(.16,.78,n))*(.5+.5*limb);gl_FragColor=vec4(c,1.);#include <colorspace_fragment>
      }`.replace(';#include',';\n#include'),
  }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getSunGlowTexture(), color: warm ? 0xff6c28 : 0xffcd76, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(radius * 3.9); mesh.add(halo);
  return mesh;
}
export function createGalaxy(low) {
  const rng = randomSeed(31), p=[], c=[];
  const count = low ? 6000 : 26000;
  for(let i=0;i<count;i++) {
    const r = Math.pow(rng(), .7)*6;
    const arm = i%2*Math.PI;
    const angle = arm + r*1.3 + (rng()-.5)*(.55 + 1/(r+.3));
    const bulge = i < count*.2;
    const theta = bulge ? rng()*Math.PI*2 : angle;
    const rr = bulge ? Math.pow(rng(),1.5)*1.6 : r;
    p.push(Math.cos(theta)*rr,(rng()-.5)*(bulge?1.1:.18)*(1-rr/8),Math.sin(theta)*rr*.7);
    const col = new THREE.Color().setRGB(1-rr*.045,.79+rr*.014,.53+rr*.065).multiplyScalar(.35+rng()*.7);
    c.push(col.r,col.g,col.b);
  }
  const group = new THREE.Group();group.add(pointMesh(p,c,low?.075:.045));
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map:getSunGlowTexture(),color:0xffd4a0,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false }));core.scale.set(2.7,2.7,1);group.add(core);
  const haze=new THREE.Mesh(new THREE.PlaneGeometry(13,13),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float arms=pow(.5+.5*cos(a*2.-r*14.),3.);float fade=pow(max(0.,1.-r),2.);vec3 color=mix(vec3(1.,.72,.4),vec3(.35,.5,.85),r);gl_FragColor=vec4(color,fade*(.14+arms*.18));}`
  }));haze.userData.ignoreBounds=true;haze.rotation.x=-Math.PI/2;group.add(haze);
  group.rotation.z=.25;
  return group;
}
export function createWeb(wall, low) {
  const rng=randomSeed(wall?19:74),p=[],c=[],lines=[];
  const nodes=[];
  const n=wall?70:42;
  for(let i=0;i<n;i++){
    const t=i/(n-1);nodes.push(new THREE.Vector3((t-.5)*13,wall?(rng()-.5)*5:Math.sin(t*9)*1.3,(rng()-.5)*(wall?4:1.5)));
  }
  // Branches and luminous knots suggest a web without implying measured coordinates.
  for(let i=1;i<n;i++){
    const a=nodes[i-1],b=nodes[i];
    lines.push(a.x,a.y,a.z,b.x,b.y,b.z);
    const count=low?35:110;
    for(let j=0;j<count;j++){
      const t=rng(),spread=j%5===0?.5:.15;
      p.push(THREE.MathUtils.lerp(a.x,b.x,t)+(rng()-.5)*spread,THREE.MathUtils.lerp(a.y,b.y,t)+(rng()-.5)*spread,THREE.MathUtils.lerp(a.z,b.z,t)+(rng()-.5)*spread);
      const light=.4+rng()*.6;c.push(light*.7,light*.85,light);
    }
    for(let j=0;j<(low?20:60);j++){
      const r=Math.pow(rng(),2)*.45,theta=rng()*Math.PI*2;
      p.push(b.x+Math.cos(theta)*r,b.y+(rng()-.5)*r,b.z+Math.sin(theta)*r);c.push(.95,.78,.52);
    }
    if(i%4===0){const branch=b.clone().add(new THREE.Vector3((rng()-.5)*2,1+rng()*1.8,(rng()-.5)*2));lines.push(b.x,b.y,b.z,branch.x,branch.y,branch.z);for(let j=0;j<100;j++){const v=b.clone().lerp(branch,rng());p.push(v.x+(rng()-.5)*.15,v.y+(rng()-.5)*.15,v.z+(rng()-.5)*.15);c.push(.3,.5,.65);}}
  }
  const group=new THREE.Group();group.add(pointMesh(p,c,low?.11:.07));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));group.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:wall?0x8a83bb:0x76b5c0,transparent:true,opacity:.12})));return group;
}
