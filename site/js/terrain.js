// The HomeGuild — WebGPU contour terrain (Three.js + TSL)
// Draws animated topographic contour lines of a slowly evolving noise field, the way
// a USGS quad of the Boise Front looks. Renders through WebGPU; Three falls back to
// WebGL2 automatically where WebGPU is unavailable. If neither works the static SVG stays.

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, uv, vec2, vec3, vec4, float, mix, smoothstep, fract, floor, abs,
  min, fwidth, mx_noise_float, screenSize
} from 'three/tsl';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Four octaves of 3D noise; z is time so the field breathes instead of scrolling.
const fbm = Fn(([p, t]) => {
  const n1 = mx_noise_float(vec3(p, t));
  const n2 = mx_noise_float(vec3(p.mul(2.03).add(vec2(17.1, 9.7)), t.mul(1.3))).mul(0.5);
  const n3 = mx_noise_float(vec3(p.mul(4.11).add(vec2(3.3, 41.2)), t.mul(1.7))).mul(0.25);
  const n4 = mx_noise_float(vec3(p.mul(8.07).add(vec2(71.9, 5.5)), t.mul(2.1))).mul(0.125);
  return n1.add(n2).add(n3).add(n4).mul(0.5).add(0.5); // ~0..1
});

export async function mountTerrain(host, opts = {}) {
  const o = Object.assign({
    line: '#9BA88D',        // sage
    accent: '#D9A441',      // bitterbrush gold
    lineAlpha: 0.55,
    accentAlpha: 0.9,
    levels: 16,             // contour interval count
    scale: 2.2,             // noise frequency
    speed: 0.045,
    accentLevel: 9,         // which contour gets the gold
    parallax: 0.06,
    maxDpr: 1.5
  }, opts);

  if (!host) return null;

  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  await renderer.init();
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.maxDpr));
  host.appendChild(renderer.domElement);
  host.classList.add('live');

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Uniforms driven from JS
  const uTime = uniform(0);
  const uPointer = uniform(new THREE.Vector2(0, 0));
  const uAspect = uniform(1);
  const uReveal = uniform(0); // 0→1 page-load draw-in

  const lineColor = new THREE.Color(o.line);
  const accentColor = new THREE.Color(o.accent);

  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });

  material.colorNode = Fn(() => {
    // Domain: aspect-corrected uv, slow drift, pointer parallax.
    const p = vec2(uv().x.mul(uAspect), uv().y)
      .mul(o.scale)
      .add(uPointer.mul(o.parallax))
      .add(vec2(uTime.mul(0.03), uTime.mul(0.017)));

    const h = fbm(p, uTime.mul(0.35));

    // Contour lines: distance to nearest level in screen-space units so width is constant.
    const lv = h.mul(o.levels);
    const f = fract(lv);
    const dist = min(f, float(1).sub(f)).div(fwidth(lv).add(1e-4));
    const line = float(1).sub(smoothstep(0.0, 1.4, dist));

    // Every 4th line slightly heavier — index contours, like a real quad sheet.
    const idx = floor(lv);
    const isIndex = abs(fract(idx.div(4)).sub(0)).lessThan(0.01);
    const isAccent = abs(idx.sub(o.accentLevel)).lessThan(0.5);

    // Fade lines out toward the "low" ground so the field has depth.
    const depth = smoothstep(0.15, 0.85, h);

    // Page-load reveal sweeps from the left.
    const reveal = smoothstep(uv().x.sub(0.35), uv().x.add(0.05), uReveal);

    const baseA = line.mul(o.lineAlpha).mul(mix(0.35, 1.0, depth));
    const indexA = mix(baseA, baseA.mul(1.6), float(isIndex));
    const col = mix(vec3(lineColor.r, lineColor.g, lineColor.b), vec3(accentColor.r, accentColor.g, accentColor.b), float(isAccent));
    const a = mix(indexA, line.mul(o.accentAlpha), float(isAccent)).mul(reveal);

    return vec4(col, a);
  })();

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  // Size to host
  function resize() {
    const w = host.clientWidth || 1, hgt = host.clientHeight || 1;
    renderer.setSize(w, hgt, false);
    uAspect.value = w / hgt;
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Pointer parallax (eased)
  const target = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    target.set((e.clientX / window.innerWidth - 0.5) * 2, (0.5 - e.clientY / window.innerHeight) * 2);
  }, { passive: true });

  // Only render while on screen
  let visible = true;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });
  io.observe(host);

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduceMotion) uTime.value += dt * o.speed * 10;
    uReveal.value = Math.min(1.2, uReveal.value + dt * (reduceMotion ? 10 : 0.6));
    uPointer.value.lerp(target, 0.04);
    renderer.render(scene, camera);
  }
  if (reduceMotion) {
    // One still frame, drawn fully, no loop.
    uReveal.value = 1.2;
    uTime.value = 3.7;
    renderer.render(scene, camera);
  } else {
    frame();
  }

  return {
    renderer,
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); }
  };
}

// Auto-mount every [data-terrain] host on the page.
export async function boot() {
  const hosts = document.querySelectorAll('[data-terrain]');
  for (const host of hosts) {
    try {
      const preset = host.dataset.terrain;
      const opts = preset === 'gold'
        ? { line: '#1E221F', accent: '#1E221F', lineAlpha: 0.5, accentAlpha: 0.5, levels: 12, scale: 1.6, parallax: 0.03 }
        : {};
      await mountTerrain(host, opts);
    } catch (err) {
      // Keep the static SVG contours; log once for debugging.
      console.warn('[HomeGuild] terrain unavailable, using static fallback:', err && err.message);
    }
  }
}
boot();
