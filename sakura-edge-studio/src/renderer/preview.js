import * as THREE from './vendor/three.module.js';
import { OBJLoader } from './vendor/OBJLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

export function createPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(2.5, 3.5, 3);
  const rim = new THREE.DirectionalLight(0x9fb2ff, 1.6);
  rim.position.set(-3, 1.5, -2.5);
  const fill = new THREE.DirectionalLight(0xff9bb4, 0.7);
  fill.position.set(-1.5, -2, 2);
  scene.add(key, rim, fill, new THREE.HemisphereLight(0xbfd0ff, 0x11131a, 0.55));

  const pivot = new THREE.Group();
  scene.add(pivot);
  window.__carryScene = pivot;

  const texCache = new Map();
  const loader = new OBJLoader();
  let parsedObj = null;
  let parsedKey = null;
  let currentRoot = null;
  let lastBlade = null;

  let yaw = -0.55;
  let pitch = 0.18;
  let dist = 4.4;
  let autoSpin = true;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function texture(url) {
    if (texCache.has(url)) return texCache.get(url);
    const t = new THREE.TextureLoader().load(url, () => render());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    texCache.set(url, t);
    return t;
  }

  function pickGroup(root, mode) {
    const wanted = mode === 'hand' ? ['blade', 'handle', 'sheath'] : ['item_blade'];
    const children = [];
    root.traverse((o) => {
      if (o.isMesh && o.name) children.push(o);
    });
    const picked = [];
    for (const name of wanted) {
      for (const m of children.filter((c) => c.name === name)) picked.push(m);
    }
    if (picked.length) {
      const g = new THREE.Group();
      for (const m of picked) g.add(m.clone());
      return g;
    }
    // 没有分组信息时整体显示
    return root.clone(true);
  }

  let baseYaw = -0.55;
  let baseDist = 5.4;

  function frame(root, opts = {}) {
    root.position.set(0, 0, 0);
    root.scale.setScalar(1);
    pivot.clear();
    pivot.add(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const target = opts.target || 2.5;
    const scale = target / maxDim;
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    baseYaw = opts.yaw != null ? opts.yaw : -0.55;
    baseDist = opts.dist || 5.4;
    resetCamera();
  }

  // ---- 携带姿态（carry_type）----
  // 原版 LayerSlashBlade.renderBack 的挂点：颈部锚点 + 肩侧 x、身后 z，scale .075 × .095≈1/140。
  // 原版刀模枢轴在刀身中部，我们的 katana.obj 在 38% 处，所以这里按包围盒中心对齐挂点，
  // 避免整把刀偏出身体轮廓；最终位置/角度都能被滑杆覆盖。
  const CARRY_LEN = 1.45; // 挂到角色身上时，刀身统一按 1.45 格长显示

  // center：刀身包围盒中心（y 从脚底量起），rot：绕 X/Y/Z 的角度（度）
  const ORIG_CARRY = {
    DEFAULT: { center: [0.02, 1.10, -0.34], rot: [0, 0, 16] },   // 横背：横贴后背，略斜
    KATANA: { center: [0.0, 0.86, -0.30], rot: [0, 0, 6] },    // 腰间：竖挂后腰
    NINJA: { center: [0.0, 1.08, -0.36], rot: [0, 0, -30] },     // 斜背：左肩斜到右腰
    RNINJA: { center: [0.0, 1.14, -0.36], rot: [0, 0, 30] },
    PSO2: { center: [0.02, 1.10, -0.34], rot: [0, 0, 16] },
  };

  function buildSwordNative(names, material) {
    const g = new THREE.Group();
    parsedObj.traverse((o) => {
      if (o.isMesh && names.includes(o.name)) g.add(o.clone());
    });
    g.traverse((o) => {
      if (o.isMesh) { o.material = material; o.frustumCulled = false; }
    });
    // 把包围盒中心挪到原点，挂点即"刀身中心"
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    g.position.set(-c.x, -c.y, -c.z);
    return g;
  }

  function buildCarried(blade, material) {
    const cfg = ORIG_CARRY[String((blade && blade.carry) || 'PSO2').toUpperCase()];
    if (!cfg) return null;
    const wrap = new THREE.Group();
    wrap.name = 'carry';
    wrap.position.set(cfg.center[0], cfg.center[1], cfg.center[2]);
    const mount = new THREE.Group();
    mount.rotation.set(cfg.rot[0] * Math.PI / 180, cfg.rot[1] * Math.PI / 180, cfg.rot[2] * Math.PI / 180);
    const sword = buildSwordNative(['blade', 'handle', 'sheath'], material);
    // 不同刀模长度差很多（我们的 katana 310、原版 agito 377、无尾 395 单位），
    // 按刀身长度归一，背在身上都差不多 1.45 格长，才不会被吐槽"过长"
    const bb = new THREE.Box3().setFromObject(sword);
    const len = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, 1);
    mount.scale.setScalar(CARRY_LEN / len);
    mount.add(sword);
    wrap.add(mount);
    return wrap;
  }

  function boxMesh(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 })
    );
    m.position.set(x, y, z);
    m.frustumCulled = false;
    return m;
  }

  // 简化的史蒂夫比例小人（1 格 = 16 像素，身高 1.8 格），站立面向 +Z
  function buildPlayer() {
    const g = new THREE.Group();
    const SKIN = 0xd7a077, SHIRT = 0x2f7d8f, PANTS = 0x3b4a8c, HAIR = 0x2a1d14;
    g.add(boxMesh(0.5, 0.5, 0.5, SKIN, 0, 1.55, 0));            // 头
    g.add(boxMesh(0.52, 0.14, 0.52, HAIR, 0, 1.79, 0));         // 头发
    g.add(boxMesh(0.06, 0.06, 0.02, 0x1a1a20, -0.11, 1.58, 0.26)); // 左眼
    g.add(boxMesh(0.06, 0.06, 0.02, 0x1a1a20, 0.11, 1.58, 0.26));  // 右眼
    g.add(boxMesh(0.5, 0.74, 0.26, SHIRT, 0, 1.02, 0));          // 躯干
    g.add(boxMesh(0.22, 0.72, 0.22, SKIN, -0.36, 1.02, 0));      // 左臂
    g.add(boxMesh(0.22, 0.72, 0.22, SKIN, 0.36, 1.02, 0));       // 右臂
    g.add(boxMesh(0.24, 0.72, 0.24, PANTS, -0.13, 0.36, 0));     // 左腿
    g.add(boxMesh(0.24, 0.72, 0.24, PANTS, 0.13, 0.36, 0));      // 右腿
    return g;
  }

  // 从 OBJ 里挑若干组，居中后缩放到「格」单位
  function buildSwordParts(names, material) {
    const inner = new THREE.Group();
    parsedObj.traverse((o) => {
      if (o.isMesh && names.includes(o.name)) inner.add(o.clone());
    });
    if (!inner.children.length) return null;
    inner.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(inner);
    const c = b.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -c.y, -c.z); // 以模型中心为旋转点
    inner.traverse((o) => {
      if (o.isMesh) {
        o.material = material;
        o.frustumCulled = false;
      }
    });
    const holder = new THREE.Group();
    holder.scale.setScalar(1 / 320); // 原版拔刀剑：320 模型单位 = 1 格
    holder.add(inner);
    return holder;
  }

  function buildCharacter(blade, material) {
    const g = new THREE.Group();
    g.add(buildPlayer());
    const carried = buildCarried(blade, material);
    if (carried) {
      // 用户的微调作为外层偏移组，叠在原版挂点之上
      const off = (blade && blade.pose) || {};
      const tweak = new THREE.Group();
      tweak.position.set(Number(off.x) || 0, Number(off.y) || 0, Number(off.z) || 0);
      tweak.rotation.set(
        (Number(off.rx) || 0) * Math.PI / 180,
        (Number(off.ry) || 0) * Math.PI / 180,
        (Number(off.rz) || 0) * Math.PI / 180
      );
      const sc = Number(off.scale);
      tweak.scale.setScalar(Number.isFinite(sc) && sc > 0 ? sc : 1);
      tweak.add(carried);
      g.add(tweak);
    }
    return g;
  }

  window.__dbgBox = () => {
    const box = new THREE.Box3();
    const scene = (window.__carryScene || null);
    if (!scene) return 'no scene';
    scene.updateMatrixWorld(true);
    const out = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      out.push(`${o.name||o.parent.name}: x[${b.min.x.toFixed(2)},${b.max.x.toFixed(2)}] y[${b.min.y.toFixed(2)},${b.max.y.toFixed(2)}] z[${b.min.z.toFixed(2)},${b.max.z.toFixed(2)}]`);
    });
    console.log('DBG_BBOX\n' + out.join('\n'));
    return 'ok';
  };

  function resetCamera() {
    yaw = baseYaw;
    pitch = 0.18;
    dist = baseDist;
    render();
  }

  function updateCamera() {
    const r = dist;
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * r,
      Math.sin(pitch) * r,
      Math.cos(yaw) * Math.cos(pitch) * r
    );
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }

  function render() {
    updateCamera();
    renderer.render(scene, camera);
  }

  let raf = null;
  function loop() {
    if (autoSpin && !dragging) {
      pivot.rotation.y += 0.004;
    }
    render();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - lastY) * 0.006));
    lastX = e.clientX;
    lastY = e.clientY;
    render();
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    if (e.pointerId !== undefined) canvas.releasePointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    dist = Math.max(1.6, Math.min(12, dist + Math.sign(e.deltaY) * 0.28));
    render();
  }, { passive: false });

  new ResizeObserver(resize).observe(canvas);

  function diag() {
    return {
      canvas: [canvas.clientWidth, canvas.clientHeight, canvas.width, canvas.height],
      children: currentRoot ? currentRoot.children.map((c) => c.name || c.type) : null,
      pivotKids: pivot.children.length,
      gl: renderer.getContext() ? renderer.getContext().getParameter(renderer.getContext().VERSION) : 'no-ctx',
      bbox: currentRoot ? (() => { const b = new THREE.Box3().setFromObject(currentRoot); const sz = b.getSize(new THREE.Vector3()); return [sz.x.toFixed(2), sz.y.toFixed(2), sz.z.toFixed(2)]; })() : null,
      scale: currentRoot ? currentRoot.scale.x.toFixed(4) : null,
      info: { calls: renderer.info.render.calls, tris: renderer.info.render.triangles },
      ndc: (() => {
        const b = new THREE.Box3().setFromObject(pivot);
        const cs = [b.min, b.max, new THREE.Vector3(b.min.x,b.min.y,b.max.z), new THREE.Vector3(b.max.x,b.max.y,b.min.z)];
        updateCamera();
        camera.updateMatrixWorld(true);
        const out = cs.map(v => { const q = v.clone().project(camera); return [q.x.toFixed(2), q.y.toFixed(2), q.z.toFixed(2)]; });
        const o = new THREE.Vector3(0,0,0).project(camera);
        return { corners: out, origin: [o.x.toFixed(2), o.y.toFixed(2)], world: [b.min.toArray().map(n=>+n.toFixed(2)), b.max.toArray().map(n=>+n.toFixed(2))] };
      })(),
      posStats: (() => {
        const m = []; pivot.traverse(o => { if (o.isMesh) {
          const a = o.geometry.getAttribute('position'); let nan = 0, min = Infinity, max = -Infinity;
          for (let i = 0; i < a.array.length; i++) { const v = a.array[i]; if (!Number.isFinite(v)) nan++; else { min = Math.min(min, v); max = Math.max(max, v); } }
          m.push({ count: a.count, nan, min: +min.toFixed(1), max: +max.toFixed(1), idx: o.geometry.index ? o.geometry.index.count : null, drawRange: [o.geometry.drawRange.start, o.geometry.drawRange.count] });
        }}); return m;
      })(),
      meshes: (() => { const a = []; pivot.traverse(o => { if (o.isMesh) a.push({ n: o.name, pos: o.geometry.getAttribute('position')?.count, mat: o.material?.type, map: !!o.material?.map?.image, visible: o.visible }); }); return a; })(),
      pos: currentRoot ? [currentRoot.position.x.toFixed(2), currentRoot.position.y.toFixed(2)] : null,
      cam: [camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2)],
    };
  }

  function snapshot() {
    render();
    const gl = renderer.getContext();
    const w = Math.floor(canvas.width * 0.5);
    const h = Math.floor(canvas.height * 0.5);
    renderer.setSize(w, h, false);
    const bg = scene.background;
    scene.background = new THREE.Color(0x1b2231);
    render();
    scene.background = bg;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const c2 = document.createElement('canvas');
    c2.width = w; c2.height = h;
    const ctx = c2.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = ((h - 1 - y) * w + x) * 4;
        const dst = (y * w + x) * 4;
        img.data[dst] = px[src];
        img.data[dst + 1] = px[src + 1];
        img.data[dst + 2] = px[src + 2];
        img.data[dst + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    resize();
    return c2.toDataURL('image/png');
  }

  function clearRoot() {
    if (currentRoot) {
      currentRoot.traverse((o) => {
        if (o.isMesh) {
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          if (o.material && o.material.dispose && o.material !== sharedMaterial) o.material.dispose();
        }
      });
    }
    pivot.clear();
  }

  let sharedMaterial = null;
  function bladeMaterial(blade) {
    if (sharedMaterial) sharedMaterial.dispose();
    // 像素材质：近邻取样，128 像素贴图放大后也不会糊成一片
    const map = texture(blade.textureData || '');
    if (map) {
      map.magFilter = THREE.NearestFilter;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.anisotropy = 4;
      map.needsUpdate = true;
    }
    sharedMaterial = new THREE.MeshStandardMaterial({
      map: map,
      metalness: 0.42,
      roughness: 0.34,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    });
    return sharedMaterial;
  }

  function rebuild(mode) {
    if (!lastBlade) return;
    const blade = lastBlade;
    const modelText = blade.modelData || '';
    const key = modelText.length + ':' + modelText.slice(0, 120) + ':' + modelText.slice(-80);
    if (key !== parsedKey) {
      try {
        parsedObj = loader.parse(modelText);
        parsedKey = key;
      } catch (err) {
        parsedObj = null;
        parsedKey = null;
        console.error('OBJ 解析失败', err);
      }
    }
    if (!parsedObj) {
      clearRoot();
      currentRoot = null;
      return;
    }
    const rot = pivot.rotation.y;
    const material = bladeMaterial(blade);
    clearRoot();

    let root;
    if (mode === 'back') {
      root = buildCharacter(blade, material);
    } else {
      root = pickGroup(parsedObj, mode);
      root.traverse((o) => {
        if (o.isMesh) {
          o.material = material;
          o.frustumCulled = false;
        }
      });
    }
    currentRoot = root;
    if (mode === 'back') {
      frame(root, { target: 2.2, dist: 7.0, yaw: 2.35 });
    } else {
      // 细长刀斜放时按 maxDim 归一化会把两端顶出画面，留一点余量
      frame(root, { target: mode === 'icon' ? 1.95 : 2.5 });
    }
    pivot.rotation.y = rot;
    render();
  }

  function setBlade(blade, mode) {
    lastBlade = blade;
    pivot.rotation.y = 0;
    rebuild(mode);
    if (!raf) loop();
  }

  function setMode(mode) {
    rebuild(mode);
  }

  function setSpin(on) {
    autoSpin = on;
    if (on && !raf) loop();
  }

  resize();
  loop();

  return { setBlade, setMode, setSpin, resetCamera, resize, diag, snapshot };
}
