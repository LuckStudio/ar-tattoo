// Efecto 3D para el tattoo "mandala" (flor de loto + gota/llama + hojas + puntos).
// Coordenadas de MindAR: el marcador mide 1 de ancho, centro en (0,0), Y hacia arriba, Z sale de la piel.
//
// Secuencia al detectar el tattoo (solo elementos 3D, sin calcar el trazo):
//   0.0s  Una onda de luz se expande desde el centro de la mandala.
//   0.2s  Un capullo brota de la piel girando.
//   1.0s  La flor de loto se abre por capas (pétalos curvos con degradado) y salen estambres dorados.
//   1.2s  Las hojas del tattoo se despegan de su sitio y vuelan a orbitar alrededor de la flor.
//   2.6s  La gota se enciende: llama animada por shader + brasas que suben.
//   2.8s  Anillos de halo giran bajo la flor.
//   3.2s  Los puntos del tattoo se convierten en luciérnagas.
//   4.0s  Algunos pétalos se desprenden y flotan. Cada 6 s vuelve una onda de luz suave.
// Tocar la pantalla reinicia la animación.

const THREE = AFRAME.THREE;

const PALETTE = {
  petalBase: new THREE.Color('#4a0b0e'),
  petalMid: new THREE.Color('#b8322a'),
  petalTip: new THREE.Color('#ff8f6b'),
  innerBase: new THREE.Color('#7d1c1c'),
  innerTip: new THREE.Color('#ffc58a'),
  gold: '#f5c86a',
  copper: '#d9824a',
  glow: '#ff8a3d',
};

// Puntos clave del diseño (en assets/effects/mandala.json)
const CENTER = new THREE.Vector3(-0.016, -0.129, 0); // punto central de la flor
const FLAME = new THREE.Vector3(0.048, 0.40, 0);      // bulbo de la gota
const FLOWER_Z = 0.09;                                // altura a la que flota la flor

// ---------- utilidades ----------
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeBack = (x) => { x = clamp01(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const phase = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const additive = (opts) => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...opts });

// ---------- pétalos (geometría paramétrica curva) ----------
// lobes > 0 crea el borde de tres lóbulos de los pétalos exteriores del tattoo
function petalGeometry({ len, wid, cup, curl, lobes = 0, base, tip }) {
  const U = 18, V = 12;
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  const white = new THREE.Color('#ffffff');
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const half = lobes
      ? (wid / 2) * Math.pow(Math.sin(Math.min(u / 0.55, 1) * Math.PI / 2), 0.6)
      : (wid / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.8);
    for (let j = 0; j <= V; j++) {
      const v = (j / V) * 2 - 1;
      const lobeCut = lobes ? lobes * (1 - Math.cos(3 * Math.PI * v)) / 2 * Math.pow(u, 4) : 0;
      const x = v * half;
      const y = len * u * (1 - lobeCut);
      const z = cup * wid * v * v + curl * len * u * u;
      pos.push(x, y, z);
      c.copy(base).lerp(tip, Math.pow(u, 1.3));
      c.lerp(white, 0.15 * (1 - Math.abs(v)) * u); // vena central más clara
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j, b = a + V + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const petalMaterial = (emissive) => new THREE.MeshStandardMaterial({
  vertexColors: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.05,
  emissive, emissiveIntensity: 0.05, transparent: true,
});

// ---------- flor de loto ----------
function buildFlower() {
  const flower = new THREE.Group();
  flower.position.copy(CENTER);
  const bud = new THREE.Group(); // gira y escala el conjunto
  flower.add(bud);

  const outerGeo = petalGeometry({ len: 0.3, wid: 0.24, cup: 0.35, curl: -0.25, lobes: 0.12, base: PALETTE.petalBase, tip: PALETTE.petalTip });
  const midGeo = petalGeometry({ len: 0.24, wid: 0.15, cup: 0.45, curl: -0.15, base: PALETTE.petalBase, tip: PALETTE.petalMid });
  const innerGeo = petalGeometry({ len: 0.17, wid: 0.11, cup: 0.55, curl: 0.05, base: PALETTE.innerBase, tip: PALETTE.innerTip });
  const matA = petalMaterial(PALETTE.glow);
  const matB = petalMaterial(PALETTE.gold);

  const petals = [];
  const ring = (geo, mat, count, offset, z, open, delay) => {
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.z = offset + (i * Math.PI * 2) / count;
      pivot.position.z = z;
      const mesh = new THREE.Mesh(geo, mat);
      pivot.add(mesh);
      bud.add(pivot);
      petals.push({ mesh, open, delay: delay + i * 0.07, seed: i });
    }
  };
  // Igual que en el tattoo: 4 pétalos lobulados en cruz y 4 en diagonal; más una capa interior para dar volumen
  ring(outerGeo, matA, 4, 0, 0.0, 0.3, 0.0);
  ring(midGeo, matA, 4, Math.PI / 4, 0.01, 0.7, 0.3);
  ring(innerGeo, matB, 6, Math.PI / 6, 0.02, 1.05, 0.6);

  // Estambres dorados
  const stamens = new THREE.Group();
  stamens.position.z = 0.02;
  const stemGeo = new THREE.CylinderGeometry(0.0025, 0.0035, 0.07, 6);
  stemGeo.translate(0, 0.035, 0);
  stemGeo.rotateX(Math.PI / 2);
  const tipGeo = new THREE.SphereGeometry(0.008, 10, 8);
  const goldMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.85, roughness: 0.25, emissive: PALETTE.gold, emissiveIntensity: 0.45 });
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const a = (i / 12) * Math.PI * 2;
    g.position.set(Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0);
    g.rotation.set(-Math.sin(a) * 0.45, Math.cos(a) * 0.45, 0);
    const stem = new THREE.Mesh(stemGeo, goldMat);
    const tip = new THREE.Mesh(tipGeo, goldMat);
    tip.position.z = 0.07;
    g.add(stem, tip);
    stamens.add(g);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), goldMat);
  core.position.z = 0.025;
  bud.add(stamens, core);

  return { flower, bud, petals, stamens, core, matA, matB };
}

// ---------- hojas del tattoo que se despegan ----------
function buildLeaves(data) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.copper, metalness: 0.35, roughness: 0.3, emissive: PALETTE.glow, emissiveIntensity: 0.2, side: THREE.DoubleSide });
  // Las hojas son formas rellenas medianas, alejadas del centro de la flor
  const shapes = data.shapes.filter((s) => s.holes.length === 0 && s.area > 0.007 && s.area < 0.0145 &&
    Math.hypot(s.center[0] - CENTER.x, s.center[1] - CENTER.y) > 0.3);
  const leaves = shapes.map((s, i) => {
    const [cx, cy] = s.center;
    const shape = new THREE.Shape(s.outer.map(([x, y]) => new THREE.Vector2(x - cx, y - cy)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3, curveSegments: 4 });
    geo.translate(0, 0, -0.004);
    const mesh = new THREE.Mesh(geo, mat);
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.visible = false;
    group.add(holder);
    return { holder, mesh, home: new THREE.Vector3(cx, cy, 0.002), angle0: Math.atan2(cy - CENTER.y, cx - CENTER.x), i };
  });
  return { group, leaves, mat };
}

// ---------- llama con shader ----------
const flameVertex = `
  uniform float uTime;
  varying float vH;
  void main() {
    vH = uv.y;
    vec3 p = position;
    float h = uv.y;
    p.x += sin(h * 7.0 + uTime * 9.0) * 0.018 * h + sin(uTime * 3.1) * 0.01 * h * h;
    p.y += cos(h * 6.0 + uTime * 7.3) * 0.014 * h;
    p.z *= 1.0 + 0.08 * sin(uTime * 13.0) + 0.05 * sin(uTime * 23.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const flameFragment = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uBase;
  uniform vec3 uMid;
  uniform vec3 uTip;
  varying float vH;
  void main() {
    vec3 c = mix(uBase, uMid, smoothstep(0.0, 0.45, vH));
    c = mix(c, uTip, smoothstep(0.45, 1.0, vH));
    float a = (1.0 - smoothstep(0.55, 1.0, vH)) * smoothstep(0.0, 0.06, vH);
    float flick = 0.85 + 0.15 * sin(uTime * 31.0 + vH * 12.0);
    gl_FragColor = vec4(c * flick * uIntensity, a * uIntensity);
  }`;

function flameGeometry(radius, height) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const r = radius * Math.sin(Math.PI * Math.pow(t, 0.5)) * Math.pow(1 - t, 0.4);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), t * height));
  }
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.rotateX(Math.PI / 2); // eje de la llama = Z (sale de la piel)
  return geo;
}

function buildFlame(sprite) {
  const group = new THREE.Group();
  group.position.copy(FLAME);
  const mk = (base, mid, tip) => new THREE.ShaderMaterial({
    vertexShader: flameVertex, fragmentShader: flameFragment,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uBase: { value: new THREE.Color(base) }, uMid: { value: new THREE.Color(mid) }, uTip: { value: new THREE.Color(tip) } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const outerMat = mk('#ffb347', '#ff5a14', '#b3170a');
  const innerMat = mk('#ffffff', '#ffe08a', '#ff8a2a');
  const outer = new THREE.Mesh(flameGeometry(0.1, 0.52), outerMat);
  const inner = new THREE.Mesh(flameGeometry(0.05, 0.3), innerMat);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: '#ff8a3d', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  halo.scale.setScalar(0.45);
  halo.position.z = 0.12;
  const light = new THREE.PointLight('#ff9a4d', 0, 1.5, 2);
  light.position.z = 0.15;
  group.add(outer, inner, halo, light);

  // Brasas
  const N = 90;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  const embers = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.028, map: sprite, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false;
  const seeds = Array.from({ length: N }, () => ({ off: Math.random(), speed: 0.35 + Math.random() * 0.4, a: Math.random() * 6.28, r: 0.02 + Math.random() * 0.05 }));
  group.add(embers);

  return { group, outerMat, innerMat, halo, light, embers, seeds };
}

// ---------- luciérnagas desde los puntos del tattoo ----------
function buildFireflies(dots, sprite) {
  const list = [];
  dots.forEach(([x, y], i) => {
    for (let k = 0; k < 2; k++) list.push({ x, y, a: i * 1.7 + k * 3.1, b: i * 0.9 + k * 2.3, h: 0.12 + ((i * 7 + k * 3) % 5) * 0.05 });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(list.length * 3), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(list.length * 3), 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.04, map: sprite, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  points.frustumCulled = false;
  return { points, list };
}

// ---------- onda de luz + halo ----------
function buildRings() {
  const group = new THREE.Group();
  group.position.set(CENTER.x, CENTER.y, 0.004);
  const waveGeo = new THREE.RingGeometry(0.94, 1, 96);
  const waves = [0, 1].map(() => {
    const m = new THREE.Mesh(waveGeo, additive({ color: PALETTE.gold, opacity: 0, side: THREE.DoubleSide }));
    group.add(m);
    return m;
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), additive({ color: PALETTE.glow, opacity: 0 }));
  group.add(disc);

  // Halo: dos anillos finos con cuentas que giran en sentidos opuestos
  const halo = new THREE.Group();
  halo.position.z = 0.03;
  const beadMat = additive({ color: PALETTE.gold, opacity: 0.9 });
  const ringMat = additive({ color: PALETTE.gold, opacity: 0.55 });
  const haloRings = [0.36, 0.44].map((r, k) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.0025, 6, 120), ringMat));
    const n = k ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(k ? 0.006 : 0.01, 8, 6), beadMat);
      const a = (i / n) * Math.PI * 2;
      b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      g.add(b);
    }
    halo.add(g);
    return g;
  });
  group.add(halo);
  return { group, waves, disc, halo, haloRings, beadMat, ringMat };
}

// ---------- pétalos que se desprenden ----------
function buildDrift() {
  const geo = petalGeometry({ len: 0.08, wid: 0.05, cup: 0.4, curl: -0.1, base: PALETTE.petalMid, tip: PALETTE.petalTip });
  const group = new THREE.Group();
  const items = Array.from({ length: 6 }, (_, i) => {
    const mat = petalMaterial(PALETTE.glow);
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    group.add(m);
    return { m, mat, off: i / 6, a: (i / 6) * Math.PI * 2 + 0.4 };
  });
  return { group, items };
}

AFRAME.registerComponent('effect-mandala', {
  schema: { src: { type: 'string' }, autostart: { default: false } },

  init() {
    this.started = false;
    this.root = new THREE.Group();
    this.root.visible = false;
    this.el.setObject3D('mandala', this.root);

    // Los eventos se registran antes de cargar los datos: el tattoo puede detectarse enseguida.
    // targetFound se emite en la entidad padre con mindar-image-target (no baja a los hijos).
    const restart = () => { this.t0 = performance.now(); this.started = true; this.root.visible = true; };
    const target = this.el.closest('[mindar-image-target]') || this.el;
    target.addEventListener('targetFound', restart);
    if (this.data.autostart) restart();

    // Un toque corto (sin arrastrar) reinicia la animación
    let downAt = null;
    window.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    window.addEventListener('pointerup', (e) => {
      if (!downAt || e.target.closest('a') || !this.started) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      if (moved < 8 && performance.now() - downAt.t < 350) restart();
    });

    this.load();
  },

  async load() {
    const data = await (await fetch(this.data.src)).json();
    const sprite = glowTexture();
    this.flowerParts = buildFlower();
    this.leafParts = buildLeaves(data);
    this.flameParts = buildFlame(sprite);
    this.fireflies = buildFireflies(data.dots, sprite);
    this.rings = buildRings();
    this.drift = buildDrift();
    this.root.add(this.rings.group, this.flowerParts.flower, this.leafParts.group, this.flameParts.group, this.fireflies.points, this.drift.group);
    this.ready = true;
    if (this.started) this.t0 = performance.now(); // arranca cuando ya está todo listo
  },

  tick() {
    if (!this.started || !this.ready) return;
    const t = (performance.now() - this.t0) / 1000;
    this.updateRings(t);
    this.updateFlower(t);
    this.updateLeaves(t);
    this.updateFlame(t);
    this.updateFireflies(t);
    this.updateDrift(t);
  },

  updateRings(t) {
    const { waves, disc, halo, haloRings, beadMat, ringMat } = this.rings;
    // Onda inicial (dos anillos) y luego un pulso suave cada 6 s
    waves.forEach((w, i) => {
      const intro = t < 3;
      const cycle = intro ? t - i * 0.25 : ((t - 3) % 6) - i * 0.25;
      const k = phase(cycle, 0, intro ? 1.4 : 2.2);
      w.scale.setScalar(0.05 + easeOut(k) * (intro ? 0.9 : 0.6));
      w.material.opacity = cycle >= 0 && k < 1 ? (intro ? 1 : 0.45) * (1 - k) : 0;
    });
    disc.material.opacity = 0.35 * Math.max(0, 1 - t / 0.8) * phase(t, 0, 0.1);

    const h = easeOut(phase(t, 2.8, 3.6));
    halo.scale.setScalar(Math.max(h, 0.001));
    halo.position.z = 0.03 + 0.02 * Math.sin(t * 1.2);
    haloRings[0].rotation.z = t * 0.35;
    haloRings[1].rotation.z = -t * 0.22;
    halo.rotation.x = 0.08 * Math.sin(t * 0.7);
    beadMat.opacity = 0.9 * h * (0.75 + 0.25 * Math.sin(t * 2.5));
    ringMat.opacity = 0.5 * h;
  },

  updateFlower(t) {
    const { bud, petals, stamens, core, matA, matB } = this.flowerParts;
    // El capullo brota girando y luego respira suavemente
    const rise = easeBack(phase(t, 0.2, 1.1));
    const breath = t > 3 ? 1 + 0.025 * Math.sin(t * 1.8) : 1;
    bud.scale.setScalar(Math.max(rise, 0.001) * breath);
    bud.position.z = lerp(0, FLOWER_Z, easeOut(phase(t, 0.2, 1.4))) + (t > 1.4 ? 0.012 * Math.sin(t * 1.3) : 0);
    bud.rotation.z = (1 - easeOut(phase(t, 0.2, 2.2))) * -2.5 + t * 0.18;

    const BUD_ANGLE = 1.45; // casi vertical (cerrado)
    petals.forEach((p) => {
      const o = easeBack(phase(t, 1.0 + p.delay, 2.4 + p.delay));
      const sway = o >= 1 ? 0.05 * Math.sin(t * 1.6 + p.seed * 1.3) : 0;
      p.mesh.rotation.x = lerp(BUD_ANGLE, p.open, o) + sway;
    });
    const s = Math.max(easeBack(phase(t, 2.2, 3.0)), 0.001);
    stamens.scale.set(s, s, s);
    stamens.rotation.z = -t * 0.4;
    core.scale.set(1, 1, 0.6).multiplyScalar(1 + 0.1 * Math.sin(t * 3));
    const glow = 0.03 + 0.05 * (0.5 + 0.5 * Math.sin(t * 2));
    matA.emissiveIntensity = glow;
    matB.emissiveIntensity = glow + 0.05;
  },

  updateLeaves(t) {
    const { leaves, mat } = this.leafParts;
    const R = 0.5, H = 0.2;
    leaves.forEach((L) => {
      const start = 1.2 + L.i * 0.12;
      const lift = easeOut(phase(t, start, start + 0.7));
      const fly = easeInOut(phase(t, start + 0.7, start + 2.1));
      L.holder.visible = t >= start;
      if (!L.holder.visible) return;

      // Posición en la órbita alrededor de la flor
      const ang = L.angle0 + Math.max(0, t - start - 0.7) * 0.45;
      const orbit = new THREE.Vector3(
        CENTER.x + Math.cos(ang) * R,
        CENTER.y + Math.sin(ang) * R,
        H + 0.04 * Math.sin(t * 1.7 + L.i)
      );
      const lifted = L.home.clone().setZ(0.002 + 0.06 * lift);
      if (fly <= 0) {
        L.holder.position.copy(lifted);
      } else {
        // Curva con un arco hacia arriba entre el sitio original y la órbita
        const mid = lifted.clone().lerp(orbit, 0.5).setZ(Math.max(lifted.z, orbit.z) + 0.25);
        const a = lifted.clone().lerp(mid, fly), b = mid.clone().lerp(orbit, fly);
        L.holder.position.copy(a.lerp(b, fly));
      }
      // Al despegar dan una vuelta sobre sí mismas; en la órbita se inclinan y giran suavemente
      L.mesh.rotation.y = lift * Math.PI * 2;
      L.holder.rotation.set(fly * 0.9, 0, fly * (ang + Math.PI / 2) + 0.15 * Math.sin(t * 2 + L.i));
      L.holder.scale.setScalar(1 + 0.25 * fly);
    });
    mat.emissiveIntensity = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * 2.4));
  },

  updateFlame(t) {
    const { outerMat, innerMat, halo, light, embers, seeds } = this.flameParts;
    const fl = easeBack(phase(t, 2.6, 3.4));
    const flick = 1 + 0.12 * Math.sin(t * 13) + 0.07 * Math.sin(t * 23.7) + 0.05 * Math.sin(t * 41);
    [outerMat, innerMat].forEach((m) => { m.uniforms.uTime.value = t; m.uniforms.uIntensity.value = clamp01(fl); });
    this.flameParts.group.scale.setScalar(Math.max(fl, 0.001));
    halo.material.opacity = 0.35 * clamp01(fl) * flick;
    light.intensity = 0.8 * clamp01(fl) * flick;

    const e = phase(t, 3.0, 3.6);
    const pos = embers.geometry.attributes.position.array;
    const col = embers.geometry.attributes.color.array;
    seeds.forEach((s, i) => {
      const life = (t * s.speed + s.off) % 1;
      const r = s.r * (0.4 + life);
      pos[i * 3] = Math.cos(s.a + life * 4) * r;
      pos[i * 3 + 1] = Math.sin(s.a + life * 4) * r;
      pos[i * 3 + 2] = 0.08 + life * 0.75;
      const k = e * (1 - life) * (life < 0.08 ? life / 0.08 : 1);
      col[i * 3] = k;
      col[i * 3 + 1] = k * (0.35 + 0.5 * (1 - life));
      col[i * 3 + 2] = k * 0.12;
    });
    embers.geometry.attributes.position.needsUpdate = true;
    embers.geometry.attributes.color.needsUpdate = true;
  },

  updateFireflies(t) {
    const { points, list } = this.fireflies;
    const pos = points.geometry.attributes.position.array;
    const col = points.geometry.attributes.color.array;
    list.forEach((f, i) => {
      const d = (i % 7) * 0.12;
      const appear = easeOut(phase(t, 3.2 + d, 4.4 + d));
      pos[i * 3] = f.x + 0.07 * Math.sin(t * 0.7 + f.a) * appear;
      pos[i * 3 + 1] = f.y + 0.07 * Math.cos(t * 0.9 + f.b) * appear;
      pos[i * 3 + 2] = 0.01 + (f.h + 0.06 * Math.sin(t * 0.6 + f.a)) * appear;
      const blink = appear * (0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.6 + f.a * 2), 2));
      col[i * 3] = blink;
      col[i * 3 + 1] = blink * 0.82;
      col[i * 3 + 2] = blink * 0.4;
    });
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
  },

  updateDrift(t) {
    this.drift.items.forEach((d) => {
      const active = t > 4;
      d.m.visible = active;
      if (!active) return;
      const k = ((t - 4) / 5 + d.off) % 1;
      const a = d.a + k * 1.5;
      const r = 0.1 + k * 0.45;
      d.m.position.set(CENTER.x + Math.cos(a) * r, CENTER.y + Math.sin(a) * r, FLOWER_Z + 0.05 + Math.sin(k * Math.PI) * 0.35);
      d.m.rotation.set(k * 6 + d.a, k * 4, a);
      d.mat.opacity = Math.sin(Math.PI * k) * 0.9;
    });
  },

  remove() {
    this.el.removeObject3D('mandala');
  },
});
