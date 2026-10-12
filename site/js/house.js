// The HomeGuild — interactive house: a 3D lot with clickable hotspots, one per service.
// Loads assets/house.glb (Tripo, from a generated reference render), orbits slowly, and
// shows the service and its price for the sample lot when a hotspot is tapped.
// WebGL build on purpose: this is a GLB viewer, not a shader piece, and WebGL runs everywhere.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js/+esm';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js/+esm';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/environments/RoomEnvironment.js/+esm';
import { SERVICES, deriveMeasurements, money } from './catalog.js?v=2';
import { ICONS } from './house-icons.js';

// Hotspots in the model's normalised box: x,z across the lot (-1..1), y up (0..1).
// Tuned by hand against the generated mesh; see README "Interactive house".
const HOTSPOTS = [
  { id: 'mowing',   at: [0.72, 0.15, -0.10], still: [43, 76], label: 'Front lawn',      icon: 'tractor' },
  { id: 'fert',     at: [0.58, 0.15, -0.45], still: [61, 84], label: 'Turf',            icon: 'sprout' },
  { id: 'blowout',  at: [0.90, 0.15, -0.55], still: [24, 75], label: 'Sprinkler head',  icon: 'wind' },
  { id: 'pest',     at: [0.30, 0.22, 0.30],  still: [36, 55], label: 'Foundation line', icon: 'bug' },
  { id: 'gutters',  at: [0.44, 0.47, 0.76],  still: [16, 36], label: 'Eave & gutter',   icon: 'cloud-rain' },
  { id: 'windows',  at: [0.42, 0.34, -0.15], still: [46, 45], label: 'Front windows',   icon: 'app-window' },
  { id: 'shrubs',   at: [0.51, 0.18, -0.23], still: [70, 58], label: 'Front beds',      icon: 'scissors' },
  { id: 'mulch',    at: [0.10, 0.20, 0.85],  still: [80, 63], label: 'Side beds',       icon: 'shovel' },
  { id: 'snow',     at: [0.85, 0.15, 0.60],  still: [14, 63], label: 'Driveway',        icon: 'snowflake' },
  { id: 'mosquito', at: [-0.62, 0.17, 0.66], still: [80, 13], label: 'Back yard',       icon: 'spray-can' },
];

const SAMPLE_LOT = { lotSqft: 9583 }; // the North End parcel from the hero
const m = deriveMeasurements(SAMPLE_LOT);

function renderPanel(panel, { service, label }) {
  panel.hidden = false;
  panel.innerHTML = `
      <img class="house-photo" src="assets/services/${service.id}.webp" alt="" width="900" height="600" loading="lazy">
      <span class="label">${label} · ${service.group}</span>
      <h3 class="display h3">${service.name}</h3>
      <p>${service.blurb}</p>
      <div class="house-price"><b>${money(service.price(m))}</b><small>${service.cadence.label} · ${service.basis(m)}</small></div>
      <a class="btn sm primary" href="quote.html">Price it for my lot <svg class="arrow"><use href="#arrow"/></svg></a>`;
}

/** Phone version: the rendered still with finger-sized icon buttons. No WebGL, no 10 MB model. */
export function mountStill(host, panel) {
  host.classList.add('still');
  host.innerHTML = `<img src="assets/house-still.webp" alt="A ranch house on its lot, seen from above" width="1400" height="1050" loading="lazy">`;
  for (const h of HOTSPOTS) {
    const s = SERVICES.find(x => x.id === h.id);
    if (!s) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'spot';
    b.style.left = h.still[0] + '%'; b.style.top = h.still[1] + '%';
    b.setAttribute('aria-label', h.label + ': ' + s.name);
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[h.icon]}</svg>`;
    b.addEventListener('click', () => {
      host.querySelectorAll('.spot.active').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderPanel(panel, { service: s, label: h.label });
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    host.appendChild(b);
  }
  host.classList.add('live');
}

export async function mountHouse(host, panel) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(2.45, 1.75, 2.7);

  // Image-based lighting so the PBR materials have something to reflect, plus one soft sun
  // for shadows. Without an environment the textures read as flat clay.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  scene.add(new THREE.HemisphereLight(0xeceae3, 0x1e221f, 0.35));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(4, 7, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 20;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -2.4; sun.shadow.camera.right = sun.shadow.camera.top = 2.4;
  scene.add(sun);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = false; controls.enableZoom = false;
  controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.25;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.5;
  controls.target.set(0, 0.18, 0);

  // Model
  // 19 MB mesh on desktop; the 10 MB one on phones and for people who asked to save data.
  const lite = matchMedia('(max-width: 700px)').matches || (navigator.connection && navigator.connection.saveData);
  const gltf = await new GLTFLoader().loadAsync(lite ? 'assets/house-lite.glb' : 'assets/house.glb');
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = 3.4 / Math.max(size.x, size.z);
  model.scale.setScalar(scale);
  box.setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.envMapIntensity = 0.9; } } });
  scene.add(model);
  // A soft contact shadow under the lot so it sits on the page instead of floating
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.45 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true;
  scene.add(ground);
  box.setFromObject(model);
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);

  // Hotspots: gold discs carrying a line icon for the service, raycast-able; a label follows on hover
  const spots = [];
  for (const h of HOTSPOTS) {
    const s = SERVICES.find(x => x.id === h.id);
    if (!s) continue;
    const tex = await makeIconTexture(ICONS[h.icon]);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.position.set(h.at[0] * half.x, h.at[1] * half.y * 2, h.at[2] * half.z);
    sp.scale.setScalar(0.22);
    sp.userData = { service: s, label: h.label };
    sp.renderOrder = 10;
    scene.add(sp); spots.push(sp);
  }
  const tip = document.createElement('div');
  tip.className = 'house-tip'; tip.hidden = true;
  host.appendChild(tip);
  function placeTip(sp) {
    const v = sp.position.clone().project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    tip.style.left = ((v.x + 1) / 2 * r.width) + 'px';
    tip.style.top = ((1 - v.y) / 2 * r.height - 26) + 'px';
  }

  // Picking
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let active = null;
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(spots, false)[0];
    return hit ? hit.object : null;
  }
  let hover = null;
  renderer.domElement.addEventListener('pointermove', e => {
    const h = pick(e);
    hover = h;
    renderer.domElement.style.cursor = h ? 'pointer' : 'grab';
    spots.forEach(s => s.scale.setScalar(s === h || s === active ? 0.3 : 0.22));
    if (h) { tip.textContent = h.userData.label + ' · ' + h.userData.service.name; tip.hidden = false; placeTip(h); }
    else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });
  renderer.domElement.addEventListener('click', e => {
    const h = pick(e);
    if (!h) return;
    active = h;
    controls.autoRotate = false;
    show(h.userData);
  });

  const show = data => renderPanel(panel, data);

  // Size + loop
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 }).observe(host);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) controls.autoRotate = false;
  (function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    controls.update();
    if (hover) placeTip(hover);
    renderer.render(scene, camera);
  })();
  host.classList.add('live');

  // Authoring aid: window.__house.pick(clientX, clientY) → normalised model coords for HOTSPOTS.
  window.__house = {
    pick(clientX, clientY) {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObject(model, true)[0];
      if (!hit) return null;
      const p = hit.point;
      return [+(p.x / half.x).toFixed(2), +(p.y / (half.y * 2)).toFixed(2), +(p.z / half.z).toFixed(2)];
    },
    freeze() { controls.autoRotate = false; },
    screenOf(id) { const sp = spots.find(x => x.userData.service.id === id); if (!sp) return null; const v = sp.position.clone().project(camera); const r = renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
  };
  return { renderer, scene, spots };
}

// Gold disc with a basalt line icon, rendered from SVG so the strokes stay crisp at 2x.
function makeIconTexture(inner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <circle cx="64" cy="64" r="60" fill="rgba(217,164,65,0.22)"/>
    <circle cx="64" cy="64" r="34" fill="#D9A441" stroke="#1E221F" stroke-width="4"/>
    <g transform="translate(46 46) scale(1.5)" fill="none" stroke="#1E221F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  </svg>`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; resolve(t); };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// Auto-mount, but only once the section is near the viewport: the model is ~10 MB and the
// home page should not pay for it above the fold. (A scroll check rather than an
// IntersectionObserver: the observer proved unreliable on this element in two browsers.)
const host = document.getElementById('house');
const panel = document.getElementById('housePanel');
if (host && panel) {
  let started = false;
  const start = () => {
    if (started) return; started = true;
    removeEventListener('scroll', check); removeEventListener('resize', check);
    mountHouse(host, panel).catch(err => { console.warn('[HomeGuild] house unavailable:', err.message); host.classList.add('failed'); });
  };
  const phone = matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)').matches;
  const check = () => {
    if (host.getBoundingClientRect().top >= innerHeight + 700) return;
    if (phone) { if (!started) { started = true; removeEventListener('scroll', check); removeEventListener('resize', check); mountStill(host, panel); } }
    else start();
  };
  addEventListener('scroll', check, { passive: true }); addEventListener('resize', check);
  check(); setTimeout(check, 500);
}
