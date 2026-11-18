// Efecto 3D para el tattoo "mandala" (flor + gota/llama + puntos).
// Coordenadas de MindAR: el marcador mide 1 de ancho, centro en (0,0), Y hacia arriba, Z sale de la piel.
//
// Secuencia al detectar el tattoo:
//   1. El diseño del tattoo se eleva de la piel como un relieve de cobre.
//   2. En el centro de la mandala se abre una flor de loto 3D.
//   3. La gota superior se enciende como una llama.
//   4. Los puntos del tattoo sueltan chispas que suben.
// Tocar la pantalla reinicia la animación.

const THREE = AFRAME.THREE;

const COLORS = {
  ink: '#8c3f26',
  glow: '#ff7a3d',
  petalOuter: '#c4573c',
  petalInner: '#e8946a',
  gold: '#f2c46d',
};

// Puntos clave del diseño (sacados de assets/effects/mandala.json)
const CENTER = new THREE.Vector3(-0.016, -0.129, 0);   // punto central de la flor
const FLAME = new THREE.Vector3(0.048, 0.40, 0);        // bulbo de la gota

const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
const window01 = (t, a, b) => ease((t - a) / (b - a));

// ---------- Relieve del tattoo ----------
function buildRelief(data) {
  const shapes = data.shapes.map((s) => {
    const shape = new THREE.Shape(s.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    s.holes.forEach((h) => shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
    return shape;
  });
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.018, curveSegments: 1,
    bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.002, bevelSegments: 2,
  });
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.ink, metalness: 0.55, roughness: 0.3,
    emissive: COLORS.glow, emissiveIntensity: 0.2, transparent: true,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- Flor de loto ----------
// Pétalo exterior con tres lóbulos, como los de la flor del tattoo
function lobedPetalShape(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(-wid * 0.18, 0);
  s.bezierCurveTo(-wid * 0.7, len * 0.25, -wid * 0.6, len * 0.6, -wid * 0.45, len * 0.75);
  s.quadraticCurveTo(-wid * 0.5, len * 0.95, -wid * 0.18, len * 0.85);
  s.quadraticCurveTo(0, len * 1.08, wid * 0.18, len * 0.85);
  s.quadraticCurveTo(wid * 0.5, len * 0.95, wid * 0.45, len * 0.75);
  s.bezierCurveTo(wid * 0.6, len * 0.6, wid * 0.7, len * 0.25, wid * 0.18, 0);
  s.closePath();
  return s;
}
// Pétalo interior en forma de rombo/hoja, como los rellenos del centro
function leafPetalShape(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(-wid * 0.6, len * 0.45, 0, len);
  s.quadraticCurveTo(wid * 0.6, len * 0.45, 0, 0);
  return s;
}

function buildFlower() {
  const flower = new THREE.Group();
  const extrude = { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 10 };
  const outerGeo = new THREE.ExtrudeGeometry(lobedPetalShape(0.3, 0.26), extrude);
  const innerGeo = new THREE.ExtrudeGeometry(leafPetalShape(0.21, 0.13), extrude);
  const outerMat = new THREE.MeshStandardMaterial({ color: COLORS.petalOuter, roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide, emissive: COLORS.glow, emissiveIntensity: 0.08 });
  const innerMat = new THREE.MeshStandardMaterial({ color: COLORS.petalInner, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide, emissive: COLORS.gold, emissiveIntensity: 0.1 });

  const petals = [];
  const addRing = (geo, mat, count, offset, z, openAngle, delay) => {
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.z = offset + (i * Math.PI * 2) / count;
      pivot.position.z = z;
      const mesh = new THREE.Mesh(geo, mat);
      pivot.add(mesh);
      flower.add(pivot);
      petals.push({ mesh, openAngle, delay: delay + i * 0.08 });
    }
  };
  // 4 pétalos lobulados (arriba/abajo/izq/der) y 4 interiores en diagonal, como en el tattoo
  addRing(outerGeo, outerMat, 4, 0, 0.0, 0.55, 0.0);
  addRing(innerGeo, innerMat, 4, Math.PI / 4, 0.012, 1.05, 0.35);
  addRing(innerGeo, outerMat, 4, 0, 0.02, 1.3, 0.6);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 24, 16),
    new THREE.MeshStandardMaterial({ color: COLORS.gold, metalness: 0.8, roughness: 0.25, emissive: COLORS.gold, emissiveIntensity: 0.35 })
  );
  core.position.z = 0.045;
  flower.add(core);

  flower.position.copy(CENTER);
  return { flower, petals, core };
}

// ---------- Llama ----------
function flameGeometry(radius, height) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = radius * Math.sin(Math.PI * Math.pow(t, 0.55)) * Math.pow(1 - t, 0.35);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), t * height));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateX(Math.PI / 2); // eje de la llama = Z (sale de la piel)
  return geo;
}

function buildFlame() {
  const group = new THREE.Group();
  const additive = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const outer = new THREE.Mesh(flameGeometry(0.1, 0.5), additive('#ff6a1f', 0.75));
  const inner = new THREE.Mesh(flameGeometry(0.05, 0.3), additive('#ffe08a', 0.95));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), additive('#ff8a3d', 0.18));
  halo.position.z = 0.12;
  const light = new THREE.PointLight('#ff9a4d', 0, 1.2, 2);
  light.position.z = 0.1;
  group.add(outer, inner, halo, light);
  group.position.copy(FLAME);
  return { group, outer, inner, halo, light };
}

// ---------- Chispas desde los puntos del tattoo ----------
function buildSparks(dots) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.02, 10, 8);
  const sparks = dots.map(([x, y], i) => {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    return { mesh, x, y, phase: (i * 0.37) % 1, speed: 0.6 + ((i * 7) % 5) * 0.08 };
  });
  return { group, sparks };
}

AFRAME.registerComponent('effect-mandala', {
  schema: { src: { type: 'string' }, autostart: { default: false } },

  init() {
    this.started = false;
    this.root = new THREE.Group();
    this.root.visible = false;
    this.el.setObject3D('mandala', this.root);

    // Los eventos se registran antes de cargar los datos: el tattoo puede detectarse enseguida
    const restart = () => { this.t0 = performance.now(); this.started = true; this.root.visible = true; };
    // targetFound se emite en la entidad padre con mindar-image-target (no baja a los hijos)
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
    this.relief = buildRelief(data);
    this.flowerParts = buildFlower();
    this.flameParts = buildFlame();
    this.sparkParts = buildSparks(data.dots);
    this.root.add(this.relief, this.flowerParts.flower, this.flameParts.group, this.sparkParts.group);
    if (this.started) this.t0 = performance.now(); // arranca la animación cuando ya está todo listo
  },

  tick() {
    if (!this.started || !this.relief) return;
    const t = (performance.now() - this.t0) / 1000;

    // 1. Relieve: crece desde la piel y queda latiendo
    const r = window01(t, 0, 1.2);
    this.relief.scale.z = Math.max(r, 0.01);
    this.relief.position.z = 0.004 + 0.02 * r + (t > 1.2 ? 0.006 * Math.sin(t * 1.6) : 0);
    this.relief.material.opacity = Math.min(1, r * 1.5);
    this.relief.material.emissiveIntensity = 0.15 + 0.15 * (0.5 + 0.5 * Math.sin(t * 2.2));

    // 2. Flor: aparece y abre los pétalos por capas
    const { flower, petals, core } = this.flowerParts;
    const f = window01(t, 0.8, 1.6);
    flower.scale.setScalar(Math.max(f, 0.001));
    flower.position.z = 0.04 + 0.1 * f + (f >= 1 ? 0.015 * Math.sin(t * 1.3) : 0);
    flower.rotation.z = t > 0.8 ? (t - 0.8) * 0.25 : 0;
    petals.forEach((p) => {
      const o = window01(t, 1.2 + p.delay, 2.6 + p.delay);
      p.mesh.rotation.x = p.openAngle * o + (o >= 1 ? 0.04 * Math.sin(t * 1.5 + p.delay * 5) : 0);
    });
    core.scale.setScalar(1 + 0.12 * Math.sin(t * 3));

    // 3. Llama: se enciende y parpadea
    const { group, outer, inner, halo, light } = this.flameParts;
    const fl = window01(t, 1.8, 2.6);
    const flicker = 1 + 0.12 * Math.sin(t * 13) + 0.07 * Math.sin(t * 23.7) + 0.05 * Math.sin(t * 41);
    group.scale.set(fl * (1 + 0.04 * Math.sin(t * 17)), fl * (1 + 0.04 * Math.cos(t * 15)), Math.max(fl * flicker, 0.001));
    outer.rotation.z = 0.15 * Math.sin(t * 3.1);
    inner.rotation.z = 0.1 * Math.sin(t * 4.3);
    halo.material.opacity = 0.18 * fl * flicker;
    light.intensity = 0.6 * fl * flicker;

    // 4. Chispas: suben desde cada punto y se desvanecen
    const sp = window01(t, 2.2, 3);
    this.sparkParts.sparks.forEach((s) => {
      const k = ((t * s.speed) / 2.4 + s.phase) % 1;
      s.mesh.position.set(s.x + 0.02 * Math.sin(k * 9 + s.phase * 6), s.y, 0.02 + k * 0.7);
      s.mesh.material.opacity = sp * Math.sin(Math.PI * k);
      s.mesh.scale.setScalar(1 - 0.6 * k);
    });
  },

  remove() {
    this.el.removeObject3D('mandala');
  },
});
