// Destination-charge calculator + 3D coin flow (three.js).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const money = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);

export function initMoney() {
  const priceIn = document.getElementById('price');
  const feeIn = document.getElementById('fee');
  if (!priceIn) return;
  const $ = (id) => document.getElementById(id);

  const calc = { price: 48, fee: 10 };
  function update() {
    calc.price = +priceIn.value;
    calc.fee = +feeIn.value;
    const feeAmt = Math.round(calc.price * calc.fee) / 100;
    const seller = calc.price - feeAmt;
    const stripeFee = Math.round((calc.price * 0.029 + 0.3) * 100) / 100;
    const net = feeAmt - stripeFee;
    $('priceOut').textContent = money(calc.price);
    $('feeOut').textContent = calc.fee + '%';
    $('lBuyer').textContent = money(calc.price);
    $('lSeller').textContent = money(seller);
    $('lFee').textContent = money(feeAmt);
    $('lStripe').textContent = money(-stripeFee);
    $('lNet').textContent = money(net);
    $('lNet').style.color = net < 0 ? 'var(--danger)' : '';
    $('tBuyer').textContent = money(calc.price);
    $('tPlatform').textContent = money(feeAmt);
    $('tSeller').textContent = money(seller);
    for (const el of [priceIn, feeIn]) {
      el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
    }
  }
  priceIn.addEventListener('input', update);
  feeIn.addEventListener('input', update);
  update();

  /* ---------------- 3D ---------------- */
  const canvas = $('moneyCanvas');
  const stage = canvas.parentElement;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    stage.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 3.4, 13.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.minAzimuthAngle = -0.7;
  controls.maxAzimuthAngle = 0.7;
  controls.target.set(0, 0.4, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;

  const key = new THREE.DirectionalLight(0xffe2b8, 2.2);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb4d9, 0.8);
  rim.position.set(-6, 3, -6);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  // Floor: soft disc of points
  {
    const N = 2600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(Math.random()) * 9;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -1.6;
      pos[i * 3 + 2] = Math.sin(a) * r * 0.7;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x6f6352, size: 0.03, transparent: true, opacity: 0.7 })));
  }

  // Dust
  const dustGeo = new THREE.BufferGeometry();
  const DUST = 380;
  const dpos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3] = (Math.random() - 0.5) * 16;
    dpos[i * 3 + 1] = Math.random() * 7 - 1.5;
    dpos[i * 3 + 2] = (Math.random() - 0.5) * 9;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe2c48f, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);

  // Nodes
  const NODES = {
    buyer: { pos: new THREE.Vector3(-4.3, -0.4, 0.4), color: 0xece6db },
    platform: { pos: new THREE.Vector3(0, 2.2, -1.6), color: 0xe2c48f },
    seller: { pos: new THREE.Vector3(4.3, -0.4, 0.4), color: 0x6cc59a },
  };
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.85, roughness: 0.35 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc8a46b, metalness: 1, roughness: 0.28 });
  for (const [name, n] of Object.entries(NODES)) {
    const g = new THREE.Group();
    g.position.copy(n.pos);
    const glass = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, 4),
      // Clearcoat glass look without transmission (transmission renders the scene twice per frame).
      new THREE.MeshPhysicalMaterial({ color: n.color, metalness: 0.1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.42, envMapIntensity: 1.6, depthWrite: false }),
    );
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 32), new THREE.MeshStandardMaterial({ color: n.color, emissive: n.color, emissiveIntensity: 1.4 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.012, 12, 128), brassMat);
    ring.rotation.x = Math.PI / 2.4;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.18, 64), pedestalMat);
    ped.position.y = name === 'platform' ? -1.35 : -1.25;
    const light = new THREE.PointLight(n.color, 3, 4, 2);
    g.add(glass, core, ring, ped, light);
    scene.add(g);
    Object.assign(n, { group: g, core, ring, pulse: 0, tag: document.querySelector(`.tag3d[data-node="${name}"]`) });
  }

  // Paths
  const split = new THREE.Vector3(0, 0.55, 1.0);
  const mainCurve = new THREE.CatmullRomCurve3([NODES.buyer.pos.clone(), new THREE.Vector3(-2.2, 0.9, 1.2), split, new THREE.Vector3(2.2, 0.9, 1.2), NODES.seller.pos.clone()]);
  const feeCurve = new THREE.CatmullRomCurve3([split.clone(), new THREE.Vector3(0, 1.6, 0.2), NODES.platform.pos.clone()]);
  const SPLIT_T = 0.5;
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xc8a46b, transparent: true, opacity: 0.22 });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(mainCurve, 160, 0.012, 8, false), tubeMat));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(feeCurve, 80, 0.012, 8, false), tubeMat));

  // Coins (instanced)
  const MAX = 90;
  const coinGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.05, 40);
  coinGeo.rotateX(Math.PI / 2);
  const coins = new THREE.InstancedMesh(coinGeo, brassMat, MAX);
  const feeCoins = new THREE.InstancedMesh(coinGeo, new THREE.MeshStandardMaterial({ color: 0xf3dcae, metalness: 1, roughness: 0.15, emissive: 0x3a2a10 }), MAX);
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Instances move far from the origin, so skip frustum culling on the instanced meshes.
  coins.frustumCulled = false;
  feeCoins.frustumCulled = false;
  feeCoins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(coins, feeCoins);
  const pool = [];
  let spawnAcc = 0;
  let feeAcc = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  function spawn() {
    if (pool.length >= MAX) return;
    feeAcc += calc.fee / 100;
    const isFee = feeAcc >= 1;
    if (isFee) feeAcc -= 1;
    pool.push({ t: 0, fee: isFee, spin: Math.random() * Math.PI * 2, wob: Math.random() * Math.PI * 2 });
  }

  // Mouse parallax on top of orbit
  const mouse = { x: 0, y: 0 };
  stage.addEventListener('pointermove', (ev) => {
    const r = stage.getBoundingClientRect();
    mouse.x = (ev.clientX - r.left) / r.width - 0.5;
    mouse.y = (ev.clientY - r.top) / r.height - 0.5;
  });
  controls.addEventListener('start', () => (controls.autoRotate = false));

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = 34;
    camera.updateProjectionMatrix();
    // Fit the three nodes horizontally whatever the stage shape.
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const d = Math.max(12.5, 6.4 / (half * camera.aspect));
    camera.position.set(0, d * 0.26, d);
    controls.update();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  let visible = false;
  new IntersectionObserver((entries) => {
    // Several entries can arrive in one batch; the last one is the current state.
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) clock.getDelta();
  }, { rootMargin: '100px' }).observe(stage);

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    // spawn rate grows with price
    spawnAcc += dt * (1.4 + calc.price / 70);
    while (spawnAcc > 1) {
      spawn();
      spawnAcc -= 1;
    }

    let ci = 0;
    let fi = 0;
    for (let i = pool.length - 1; i >= 0; i--) {
      const c = pool[i];
      c.t += dt * 0.32;
      c.spin += dt * 5;
      let done = false;
      if (c.fee && c.t > SPLIT_T) {
        const ft = (c.t - SPLIT_T) / 0.42;
        if (ft >= 1) { NODES.platform.pulse = 1; done = true; } else feeCurve.getPointAt(ft, p);
      } else {
        if (c.t >= 1) { NODES.seller.pulse = 1; done = true; } else mainCurve.getPointAt(c.t, p);
      }
      if (c.t < 0.03) NODES.buyer.pulse = Math.max(NODES.buyer.pulse, 0.6);
      if (done) { pool.splice(i, 1); continue; }
      p.y += Math.sin(time * 3 + c.wob) * 0.04;
      e.set(Math.sin(c.wob) * 0.4, c.spin, 0);
      q.setFromEuler(e);
      const s = Math.min(1, c.t * 12);
      sc.set(s, s, s);
      m4.compose(p, q, sc);
      if (c.fee && c.t > 0.2) feeCoins.setMatrixAt(fi++, m4);
      else coins.setMatrixAt(ci++, m4);
    }
    for (let i = ci; i < MAX; i++) coins.setMatrixAt(i, hidden);
    for (let i = fi; i < MAX; i++) feeCoins.setMatrixAt(i, hidden);
    coins.instanceMatrix.needsUpdate = true;
    feeCoins.instanceMatrix.needsUpdate = true;

    for (const n of Object.values(NODES)) {
      n.pulse *= 0.92;
      const s = 1 + n.pulse * 0.35;
      n.core.scale.setScalar(s);
      n.ring.rotation.z += dt * 0.4;
      n.group.position.y = n.pos.y + Math.sin(time * 0.9 + n.pos.x) * 0.08;
    }
    dust.rotation.y += dt * 0.02;

    controls.target.x += (mouse.x * 0.8 - controls.target.x) * 0.03;
    controls.update();
    renderer.render(scene, camera);

    // HTML labels
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    for (const n of Object.values(NODES)) {
      tmp.copy(n.group.position);
      tmp.y += 1.35;
      tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      n.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }
  frame();
}
