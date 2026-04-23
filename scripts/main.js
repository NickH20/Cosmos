/* =================================================================
   COSMOS — A Solar System Explorer
   Three.js r128 · Vanilla · Custom orbit controls · No build step
   ================================================================= */

// ---------- CONFIG -----------------------------------------------
const CONFIG = {
  sunRadius: 10,
  orbitScale: 1,          // global distance compression factor
  timeSpeed: 1.0,         // multiplier
  realistic: false,
  showOrbits: true,
  playing: true,
  starCount: 6000,
};

// Each planet: compressed distance, radius, axial tilt, orbit speed.
// Distances compressed logarithmically so Neptune stays viewable.
// Real AU is impractical here; these values tell the story of scale & speed.
const PLANET_DEFS = [
  { id: "mercury", radius: 1.2, dist:  22, tilt: 0.03, orbit: 4.15, rot:  0.02 },
  { id: "venus",   radius: 2.3, dist:  32, tilt: 177.4 * Math.PI / 180, orbit: 1.62, rot:  -0.008 },
  { id: "earth",   radius: 2.5, dist:  44, tilt: 23.44 * Math.PI / 180, orbit: 1.00, rot:  0.12 },
  { id: "mars",    radius: 1.7, dist:  56, tilt: 25.19 * Math.PI / 180, orbit: 0.53, rot:  0.11 },
  { id: "jupiter", radius: 6.0, dist:  78, tilt: 3.13  * Math.PI / 180, orbit: 0.084, rot: 0.30 },
  { id: "saturn",  radius: 5.2, dist: 104, tilt: 26.73 * Math.PI / 180, orbit: 0.034, rot: 0.28, rings: true },
  { id: "uranus",  radius: 3.6, dist: 128, tilt: 97.77 * Math.PI / 180, orbit: 0.012, rot: 0.18 },
  { id: "neptune", radius: 3.5, dist: 152, tilt: 28.32 * Math.PI / 180, orbit: 0.006, rot: 0.17 },
];

const TIME_STOPS = [0, 1, 5, 10];

// ---------- BOOT --------------------------------------------------
let scene, camera, renderer, clock;
let sunGroup, sun, coronaMeshes = [];
let planets = [];            // { def, group, mesh, orbitAngle, orbitLine, moonGroup? }
let starfield;
let raycaster, pointer;
let hoveredObject = null;
let selectedPlanet = null;
let cameraState = null;       // { anim, target, lookAt, from, to }
let orbitLinesVisible = true;
let PLANET_DATA = null;

const domLoader = document.getElementById("loader");
const domLoaderFill = document.getElementById("loaderFill");
const domLoaderStatus = document.getElementById("loaderStatus");

bootstrap().catch((err) => {
  console.error(err);
  domLoaderStatus.textContent = "Failed to initialize";
});

async function bootstrap() {
  setLoaderProgress(10, "Fetching NASA data");
  const res = await fetch("scripts/planet-data.json");
  PLANET_DATA = await res.json();

  setLoaderProgress(25, "Preparing instruments");
  initThree();

  setLoaderProgress(40, "Kindling the Sun");
  createSun();

  setLoaderProgress(55, "Charting orbits");
  createStarfield();

  setLoaderProgress(70, "Loading worlds");
  await createPlanets();

  setLoaderProgress(88, "Calibrating camera");
  initControls();
  initUI();

  setLoaderProgress(100, "Ready");
  requestAnimationFrame(start);
}

function start() {
  clock = new THREE.Clock();
  setTimeout(() => domLoader.classList.add("hidden"), 300);
  animate();
}

function setLoaderProgress(pct, label) {
  domLoaderFill.style.width = pct + "%";
  if (label) domLoaderStatus.textContent = label;
}

// ---------- THREE SETUP ------------------------------------------
function initThree() {
  const canvas = document.getElementById("scene");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x0a0d12, 1);

  scene = new THREE.Scene();
  scene.fog = null;

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 4000);
  camera.position.set(0, 90, 240);
  camera.lookAt(0, 0, 0);

  // Lighting: sun point + soft ambient
  const sunLight = new THREE.PointLight(0xfff3dc, 2.2, 1800, 1.4);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  scene.add(new THREE.AmbientLight(0x1a1f2c, 0.55));

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  window.addEventListener("resize", onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------- SUN + CORONA -----------------------------------------
function createSun() {
  sunGroup = new THREE.Group();
  scene.add(sunGroup);

  const sunTex = new THREE.TextureLoader().load("images/sun-texture.jpg");
  sunTex.wrapS = sunTex.wrapT = THREE.RepeatWrapping;

  const sunGeo = new THREE.SphereGeometry(CONFIG.sunRadius, 64, 64);
  const sunMat = new THREE.MeshBasicMaterial({
    map: sunTex,
    color: 0xffd8a0,
  });
  sun = new THREE.Mesh(sunGeo, sunMat);
  sun.userData.kind = "sun";
  sunGroup.add(sun);

  // Corona: two additive outer spheres of decreasing opacity
  const coronaColors = [0xff9f55, 0xffb86b];
  const coronaRadii = [CONFIG.sunRadius * 1.12, CONFIG.sunRadius * 1.35];
  const coronaOpacity = [0.35, 0.12];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.SphereGeometry(coronaRadii[i], 48, 48);
    const m = new THREE.MeshBasicMaterial({
      color: coronaColors[i],
      transparent: true,
      opacity: coronaOpacity[i],
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, m);
    sunGroup.add(mesh);
    coronaMeshes.push(mesh);
  }

  // Lens-flare disk billboard for the outer glow
  const flareGeom = new THREE.PlaneGeometry(CONFIG.sunRadius * 5, CONFIG.sunRadius * 5);
  const flareMat = new THREE.MeshBasicMaterial({
    map: buildRadialGradient(256, "rgba(255,170,80,0.55)", "rgba(255,140,50,0.0)"),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const flare = new THREE.Mesh(flareGeom, flareMat);
  flare.userData.billboard = true;
  sunGroup.add(flare);
  sun.userData.flare = flare;
}

function buildRadialGradient(size, inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ---------- STARFIELD --------------------------------------------
function createStarfield() {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(CONFIG.starCount * 3);
  const colors = new Float32Array(CONFIG.starCount * 3);
  const sizes = new Float32Array(CONFIG.starCount);
  // Warm / cool / neutral variation for subtle chromatic richness
  const palette = [
    [1.0, 0.95, 0.85],
    [0.85, 0.9, 1.0],
    [0.95, 0.95, 1.0],
    [1.0, 0.85, 0.7],
    [0.8, 0.88, 0.95],
  ];

  for (let i = 0; i < CONFIG.starCount; i++) {
    const r = 1200 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i*3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3 + 2] = r * Math.cos(phi);
    const c = palette[Math.floor(Math.random() * palette.length)];
    const br = 0.4 + Math.random() * 0.6;
    colors[i*3]     = c[0] * br;
    colors[i*3 + 1] = c[1] * br;
    colors[i*3 + 2] = c[2] * br;
    sizes[i] = Math.random() * 1.5 + 0.5;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 1.1,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  starfield = new THREE.Points(geo, mat);
  scene.add(starfield);
}

// ---------- PLANETS ----------------------------------------------
async function createPlanets() {
  const loader = new THREE.TextureLoader();
  for (const def of PLANET_DEFS) {
    const group = new THREE.Group();
    scene.add(group);

    const tex = await loadTexture(loader, `images/${def.id}.jpg`);
    const geo = new THREE.SphereGeometry(def.radius, 48, 48);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.95,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = def.tilt;
    mesh.userData.kind = "planet";
    mesh.userData.id = def.id;
    group.add(mesh);

    const planetData = PLANET_DATA.planets.find((p) => p.id === def.id);

    const planet = {
      def,
      data: planetData,
      group,
      mesh,
      orbitAngle: Math.random() * Math.PI * 2,
      moonGroup: null,
      ringMesh: null,
    };

    if (def.rings) createRings(planet);
    if (def.id === "earth") createMoon(planet);

    const orbitLine = createOrbitLine(def.dist);
    scene.add(orbitLine);
    planet.orbitLine = orbitLine;

    planets.push(planet);
  }
}

function loadTexture(loader, url) {
  return new Promise((resolve) => {
    loader.load(url, (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      resolve(tex);
    }, undefined, () => resolve(null));
  });
}

function createRings(planet) {
  const inner = planet.def.radius * 1.25;
  const outer = planet.def.radius * 2.2;
  const geo = new THREE.RingGeometry(inner, outer, 128, 1);
  // Adjust UVs for radial gradient
  const pos = geo.attributes.position;
  const uv  = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const r = Math.sqrt(x*x + y*y);
    const t = (r - inner) / (outer - inner);
    uv.setXY(i, t, 0.5);
  }
  const ringTex = buildRingTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: ringTex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.rotation.y = planet.def.tilt;
  planet.mesh.add(ring);
  planet.ringMesh = ring;
}

function buildRingTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 16;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0.00, "rgba(210,180,130,0)");
  g.addColorStop(0.10, "rgba(210,180,130,0.55)");
  g.addColorStop(0.30, "rgba(230,200,150,0.85)");
  g.addColorStop(0.45, "rgba(245,220,170,0.95)");
  g.addColorStop(0.55, "rgba(180,155,115,0.4)");
  g.addColorStop(0.70, "rgba(220,195,145,0.85)");
  g.addColorStop(0.90, "rgba(200,175,130,0.4)");
  g.addColorStop(1.00, "rgba(200,175,130,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createMoon(planet) {
  const moonGroup = new THREE.Group();
  planet.group.add(moonGroup);
  const geo = new THREE.SphereGeometry(0.55, 24, 24);
  const mat = new THREE.MeshStandardMaterial({ color: 0xbfbaae, roughness: 0.9 });
  const moon = new THREE.Mesh(geo, mat);
  moon.position.set(planet.def.radius * 2, 0, 0);
  moonGroup.add(moon);
  planet.moonGroup = moonGroup;
  planet.moonMesh = moon;
}

function createOrbitLine(radius) {
  const segs = 256;
  const positions = new Float32Array((segs + 1) * 3);
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    positions[i*3]   = Math.cos(t) * radius;
    positions[i*3+1] = 0;
    positions[i*3+2] = Math.sin(t) * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xf5ecdf,
    transparent: true,
    opacity: 0.08,
  });
  return new THREE.LineLoop(geo, mat);
}

// ---------- CAMERA (custom orbit controls) -----------------------
// Spherical-coordinate orbit camera that looks at `target`.
const camState = {
  target: new THREE.Vector3(0, 0, 0),
  radius: 260,
  theta: 0.0,   // azimuth
  phi:   1.1,   // polar (from +Y down)
  minR: 18, maxR: 900,
  minPhi: 0.15, maxPhi: Math.PI - 0.15,
  damping: 0.08,
  // targets for damping:
  tTheta: 0, tPhi: 1.1, tRadius: 260,
  tTarget: new THREE.Vector3(0, 0, 0),
  dragging: false,
  panning: false,
  lastX: 0, lastY: 0,
  autoTween: null,
};

function initControls() {
  // sync initial from camera
  const v = camera.position.clone();
  camState.radius = v.length();
  camState.theta = Math.atan2(v.x, v.z);
  camState.phi = Math.acos(v.y / camState.radius);
  camState.tTheta = camState.theta;
  camState.tPhi = camState.phi;
  camState.tRadius = camState.radius;

  const el = renderer.domElement;
  el.addEventListener("mousedown", onPointerDown);
  el.addEventListener("mousemove", onPointerMove);
  el.addEventListener("mouseup", onPointerUp);
  el.addEventListener("mouseleave", onPointerUp);
  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("click", onClick);
  el.addEventListener("contextmenu", (e) => e.preventDefault());

  // Touch
  el.addEventListener("touchstart", onTouchStart, { passive: false });
  el.addEventListener("touchmove", onTouchMove, { passive: false });
  el.addEventListener("touchend", onTouchEnd);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") deselectPlanet();
  });
}

function onPointerDown(e) {
  camState.dragging = true;
  camState.panning = (e.button === 2);
  camState.lastX = e.clientX;
  camState.lastY = e.clientY;
  camState.downX = e.clientX;
  camState.downY = e.clientY;
  camState.didDrag = false;
  cancelAutoTween();
}
function onPointerMove(e) {
  // hover detection when not dragging
  if (!camState.dragging) {
    pointer.x = (e.clientX / window.innerWidth)  *  2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * -2 + 1;
    detectHover(e.clientX, e.clientY);
    return;
  }
  const dx = e.clientX - camState.lastX;
  const dy = e.clientY - camState.lastY;
  camState.lastX = e.clientX;
  camState.lastY = e.clientY;
  if (Math.hypot(e.clientX - camState.downX, e.clientY - camState.downY) > 4) camState.didDrag = true;
  if (camState.panning) pan(dx, dy);
  else orbit(dx, dy);
}
function onPointerUp() { camState.dragging = false; camState.panning = false; }
function onWheel(e) {
  e.preventDefault();
  cancelAutoTween();
  const factor = Math.exp(e.deltaY * 0.0012);
  camState.tRadius = clamp(camState.tRadius * factor, camState.minR, camState.maxR);
}
function onClick(e) {
  if (camState.didDrag) return;   // ignore drag-release clicks
  pointer.x = (e.clientX / window.innerWidth)  *  2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * -2 + 1;
  const hit = pickObject();
  if (hit && hit.userData.kind === "planet") {
    selectPlanet(hit.userData.id);
  } else if (!hit) {
    if (selectedPlanet) deselectPlanet();
  }
}

let touchStartDist = 0;
function onTouchStart(e) {
  if (e.touches.length === 1) {
    camState.dragging = true;
    camState.panning = false;
    camState.lastX = e.touches[0].clientX;
    camState.lastY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    touchStartDist = touchDist(e);
  }
}
function onTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 1 && camState.dragging) {
    const dx = e.touches[0].clientX - camState.lastX;
    const dy = e.touches[0].clientY - camState.lastY;
    camState.lastX = e.touches[0].clientX;
    camState.lastY = e.touches[0].clientY;
    orbit(dx, dy);
  } else if (e.touches.length === 2) {
    const d = touchDist(e);
    const factor = touchStartDist / d;
    camState.tRadius = clamp(camState.tRadius * factor, camState.minR, camState.maxR);
    touchStartDist = d;
  }
}
function onTouchEnd() { camState.dragging = false; }
function touchDist(e) {
  const a = e.touches[0], b = e.touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function orbit(dx, dy) {
  camState.tTheta -= dx * 0.005;
  camState.tPhi = clamp(camState.tPhi - dy * 0.005, camState.minPhi, camState.maxPhi);
}
function pan(dx, dy) {
  // Pan in camera-local axes, preserving current radius
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3().subVectors(camState.target, camera.position).normalize();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  const actualUp = new THREE.Vector3().crossVectors(right, forward).normalize();
  const panScale = camState.tRadius * 0.0015;
  camState.tTarget.addScaledVector(right, -dx * panScale);
  camState.tTarget.addScaledVector(actualUp, dy * panScale);
}

function pickObject() {
  raycaster.setFromCamera(pointer, camera);
  const targets = planets.map((p) => p.mesh);
  const hits = raycaster.intersectObjects(targets, false);
  return hits.length ? hits[0].object : null;
}

function detectHover(x, y) {
  const hit = pickObject();
  const label = document.getElementById("hoverLabel");
  if (hit && hit !== hoveredObject) {
    hoveredObject = hit;
  }
  if (hit) {
    const p = PLANET_DATA.planets.find((pp) => pp.id === hit.userData.id);
    label.textContent = p ? p.name : "";
    label.style.left = x + "px";
    label.style.top = y + "px";
    label.classList.add("visible");
    document.body.style.cursor = "pointer";
  } else {
    label.classList.remove("visible");
    hoveredObject = null;
    document.body.style.cursor = "";
  }
}

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

// Animate camera smoothly to target
function tweenCameraTo(target, radius, theta, phi, duration = 2000) {
  cancelAutoTween();
  const start = performance.now();
  const fromTarget = camState.tTarget.clone();
  const fromR = camState.tRadius;
  const fromTh = camState.tTheta;
  const fromPh = camState.tPhi;
  camState.autoTween = {
    update(now) {
      const t = clamp((now - start) / duration, 0, 1);
      const e = easeOutExpo(t);
      camState.tTarget.lerpVectors(fromTarget, target, e);
      camState.tRadius = fromR + (radius - fromR) * e;
      camState.tTheta  = fromTh + shortestAngleDelta(fromTh, theta) * e;
      camState.tPhi    = fromPh + (phi - fromPh) * e;
      if (t >= 1) camState.autoTween = null;
    }
  };
}
function cancelAutoTween() { camState.autoTween = null; }
function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
function shortestAngleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---------- UI ----------------------------------------------------
function initUI() {
  // Planet list
  const list = document.getElementById("planetList");
  PLANET_DATA.planets.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "planet-list__item";
    li.dataset.id = p.id;
    const au = (p.distance_from_sun_km / 149597870).toFixed(2);
    li.innerHTML = `
      <span class="planet-list__num">${String(i + 1).padStart(2, "0")}</span>
      <span class="planet-list__name">${p.name}</span>
      <span class="planet-list__meta">${au}&nbsp;AU</span>
    `;
    li.addEventListener("click", () => selectPlanet(p.id));
    list.appendChild(li);
  });

  // Buttons
  document.getElementById("btnPlay").addEventListener("click", togglePlay);
  document.getElementById("btnReset").addEventListener("click", resetView);
  document.getElementById("btnOrbits").addEventListener("click", toggleOrbits);
  document.getElementById("btnRealistic").addEventListener("click", toggleRealistic);
  document.getElementById("panelClose").addEventListener("click", deselectPlanet);

  // Time slider
  const track = document.getElementById("timeTrack");
  let dragging = false;
  const handlePos = (clientX) => {
    const rect = track.getBoundingClientRect();
    const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
    setTimeSpeedFromPct(pct);
  };
  track.addEventListener("mousedown", (e) => { dragging = true; handlePos(e.clientX); });
  window.addEventListener("mousemove", (e) => { if (dragging) handlePos(e.clientX); });
  window.addEventListener("mouseup", () => dragging = false);
  track.addEventListener("touchstart", (e) => { handlePos(e.touches[0].clientX); });
  track.addEventListener("touchmove", (e) => { handlePos(e.touches[0].clientX); e.preventDefault(); }, { passive: false });

  // init slider
  setTimeSpeed(1.0);
}

function setTimeSpeedFromPct(pct) {
  // Map 0–1 to 0–10 with subtle ease so 1× sits near the middle
  const val = Math.round(pct * 100) / 10;  // 0.0..10.0
  setTimeSpeed(val);
}
function setTimeSpeed(val) {
  CONFIG.timeSpeed = val;
  const pct = clamp(val / 10, 0, 1);
  document.getElementById("timeFill").style.width = (pct * 100) + "%";
  document.getElementById("timeHandle").style.left = (pct * 100) + "%";
  document.getElementById("timeReadout").textContent =
    val === 0 ? "PAUSED" : `${val.toFixed(1)}× REALTIME`;
}

function togglePlay() {
  CONFIG.playing = !CONFIG.playing;
  document.getElementById("btnPlay").setAttribute("aria-pressed", CONFIG.playing ? "true" : "false");
}
function toggleOrbits() {
  orbitLinesVisible = !orbitLinesVisible;
  planets.forEach((p) => p.orbitLine.visible = orbitLinesVisible);
  document.getElementById("btnOrbits").setAttribute("aria-pressed", orbitLinesVisible ? "true" : "false");
}
function toggleRealistic() {
  CONFIG.realistic = !CONFIG.realistic;
  const btn = document.getElementById("btnRealistic");
  btn.setAttribute("aria-pressed", CONFIG.realistic ? "true" : "false");
  // Realistic mode: stretch distances to highlight scale
  planets.forEach((p) => {
    const mul = CONFIG.realistic ? realisticMultiplier(p.def.id) : 1;
    p._distMul = mul;
    rebuildOrbitLine(p);
  });
}
function realisticMultiplier(id) {
  // A compressed but more proportional log-distance model
  const realAU = {
    mercury: 0.39, venus: 0.72, earth: 1.00, mars: 1.52,
    jupiter: 5.20, saturn: 9.54, uranus: 19.2, neptune: 30.1,
  };
  // default compressed radius at id=earth → realAU=1.0 → distMul=1
  const ref = PLANET_DEFS.find((d) => d.id === "earth");
  const thisDef = PLANET_DEFS.find((d) => d.id === id);
  // Want distance ∝ realAU with earth preserved at its current compressed pos
  const target = ref.dist * (realAU[id] / realAU.earth);
  return target / thisDef.dist;
}
function rebuildOrbitLine(planet) {
  scene.remove(planet.orbitLine);
  planet.orbitLine = createOrbitLine(planet.def.dist * (planet._distMul || 1));
  planet.orbitLine.visible = orbitLinesVisible;
  scene.add(planet.orbitLine);
}

function resetView() {
  deselectPlanet();
  tweenCameraTo(new THREE.Vector3(0, 0, 0), 260, 0, 1.1, 1800);
}

function selectPlanet(id) {
  const planet = planets.find((p) => p.def.id === id);
  if (!planet) return;
  selectedPlanet = planet;

  // Update planet list active state
  document.querySelectorAll(".planet-list__item").forEach((li) => {
    li.classList.toggle("is-active", li.dataset.id === id);
  });

  // Compute world position
  const worldPos = new THREE.Vector3();
  planet.mesh.getWorldPosition(worldPos);
  const viewRadius = Math.max(planet.def.radius * 7, 18);
  // keep current theta roughly, just pull closer
  tweenCameraTo(worldPos, viewRadius, camState.tTheta, camState.tPhi, 1800);

  // Render info panel
  renderInfoPanel(planet);
  document.getElementById("infoPanel").classList.add("open");
  document.getElementById("infoPanel").setAttribute("aria-hidden", "false");
}

function deselectPlanet() {
  selectedPlanet = null;
  document.querySelectorAll(".planet-list__item").forEach((li) => li.classList.remove("is-active"));
  document.getElementById("infoPanel").classList.remove("open");
  document.getElementById("infoPanel").setAttribute("aria-hidden", "true");
  tweenCameraTo(new THREE.Vector3(0, 0, 0), 260, camState.tTheta, camState.tPhi, 1800);
}

function renderInfoPanel(planet) {
  const p = planet.data;
  const eyebrows = {
    mercury: "THE SWIFT MESSENGER",
    venus: "THE VEILED WORLD",
    earth: "THE BLUE MARBLE",
    mars: "THE RED PLANET",
    jupiter: "THE GAS GIANT",
    saturn: "THE RINGED JEWEL",
    uranus: "THE ICE GIANT ON ITS SIDE",
    neptune: "THE WINDSWEPT DEEP",
  };
  const data = [
    ["DIAMETER",     fmt(p.diameter_km, "km")],
    ["MASS",         p.mass_kg + " kg"],
    ["GRAVITY",      p.gravity_ms2 + " m/s²"],
    ["DAY LENGTH",   p.day_length],
    ["YEAR LENGTH",  p.year_length],
    ["DISTANCE",     fmt(p.distance_from_sun_km, "km")],
    ["TEMPERATURE",  p.average_temperature_c + " °C"],
    ["MOONS",        String(p.number_of_moons)],
  ];
  const html = `
    <div class="panel-counter">${String(p.order).padStart(2, "0")} / 08</div>
    <h1 class="panel-title">${p.name}</h1>
    <div class="panel-eyebrow">${eyebrows[p.id] || ""}</div>
    <div class="panel-divider"></div>
    <div class="panel-data">
      ${data.map(([l, v]) => `
        <div class="panel-data__row">
          <div class="panel-data__label">${l}</div>
          <div class="panel-data__value">${v}</div>
        </div>
      `).join("")}
      <div class="panel-data__row" style="grid-column: 1 / -1;">
        <div class="panel-data__label">ATMOSPHERE</div>
        <div class="panel-data__value" style="white-space: normal; font-size: 12px; line-height: 1.5;">
          ${p.atmosphere}
        </div>
      </div>
    </div>
    <div class="panel-divider"></div>
    <div class="panel-fact__label">FIELD&nbsp;NOTE</div>
    <p class="panel-fact__body">"${p.funFact}"</p>
    <div class="panel-source">SOURCE &nbsp;·&nbsp; NASA</div>
  `;
  document.getElementById("infoPanelInner").innerHTML = html;
}
function fmt(n, unit) {
  if (n == null) return "—";
  return n.toLocaleString("en-US") + " " + unit;
}

// ---------- ANIMATE ----------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const speed = CONFIG.playing ? CONFIG.timeSpeed : 0;

  // Sun rotation + corona pulse
  sun.rotation.y += 0.0008 * (1 + speed * 0.3);
  coronaMeshes.forEach((m, i) => {
    m.rotation.y -= 0.0003 * (i + 1);
  });
  // Billboard sun flare
  if (sun.userData.flare) {
    sun.userData.flare.quaternion.copy(camera.quaternion);
  }

  // Planets
  planets.forEach((p) => {
    const mul = p._distMul || 1;
    p.orbitAngle += p.def.orbit * speed * dt * 0.12;
    const r = p.def.dist * mul;
    p.group.position.set(
      Math.cos(p.orbitAngle) * r,
      0,
      Math.sin(p.orbitAngle) * r
    );
    p.mesh.rotation.y += p.def.rot * speed * dt * 1.2;
    if (p.moonGroup) {
      p.moonGroup.rotation.y += 0.8 * speed * dt;
    }
  });

  // Starfield subtle drift
  starfield.rotation.y += 0.00002;

  // Camera tween
  if (camState.autoTween) camState.autoTween.update(performance.now());

  // Smooth damp camera state
  camState.theta  += (camState.tTheta  - camState.theta)  * camState.damping;
  camState.phi    += (camState.tPhi    - camState.phi)    * camState.damping;
  camState.radius += (camState.tRadius - camState.radius) * camState.damping;
  camState.target.lerp(camState.tTarget, camState.damping);

  // Apply spherical → cartesian
  const sinPhi = Math.sin(camState.phi);
  camera.position.set(
    camState.target.x + camState.radius * sinPhi * Math.sin(camState.theta),
    camState.target.y + camState.radius * Math.cos(camState.phi),
    camState.target.z + camState.radius * sinPhi * Math.cos(camState.theta)
  );
  camera.lookAt(camState.target);

  // If planet is selected, follow it
  if (selectedPlanet) {
    const wp = new THREE.Vector3();
    selectedPlanet.mesh.getWorldPosition(wp);
    camState.tTarget.copy(wp);
  }

  renderer.render(scene, camera);
}
