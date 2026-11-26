// 拔刀剑建模器：参数化生成 8 组几何、对齐原版基准、导出 OBJ / 贴图
// 用法：createModeler(overlay, { getBlade, commit, close })
import * as THREE from './vendor/three.module.js';

const TEX_W = 128, TEX_H = 256;
const R_BLADE = [1, 2, 55, 253];
const R_HANDLE = [58, 2, 84, 158];
const R_GUARD = [87, 2, 126, 40];
const R_SHEATH = [87, 44, 126, 253];

export const DEFAULT_PARAMS = {
  len: 253,      // 刀身长度（单位）
  wid: 10.2,     // 刃宽
  thick: 3.0,    // 刀身厚度
  sori: 22,      // 上翘高度
  taper: 0.35,   // 头尾收窄
  tip: 0.42,     // 刀尖收窄
  seg: 26,       // 刀身分段
  hlen: 93,      // 柄长
  hr0: 4.2,      // 柄首半径
  hr1: 3.5,      // 柄尾半径
  gry: 11,       // 镡纵向半径
  grz: 7.4,      // 镡横向半径
  gthick: 2.6,   // 镡厚
  spad: 1.7,     // 鞘壁余量
  slen: 0.9,     // 鞘长占比
};

const GROUPS = [
  ['blade', '刀 + 镡 + 柄（第三人称）'],
  ['sheath', '刀鞘（第三人称）'],
  ['effect', 'SA 发光'],
  ['blade_damaged', '损坏的刀'],
  ['blade_fragment', '断片'],
  ['item_blade', '物品栏'],
  ['item_damaged', '物品栏（损坏）'],
  ['item_bladens', '物品栏（NS）'],
];

const COLOR = {
  blade: 0x93a3b8, sheath: 0x39424f, effect: 0x62e6d6,
  blade_damaged: 0x8a97a4, blade_fragment: 0x707d8a,
  item_blade: 0xc9dcef, item_damaged: 0x9fb2c4, item_bladens: 0x93a6b8,
};

const FIELDS = [
  ['len', '刀身长度', 60, 360, 1],
  ['wid', '刃宽', 4, 18, 0.2],
  ['thick', '刀身厚', 1, 6, 0.1],
  ['sori', '上翘（弯度）', 0, 110, 1],
  ['taper', '头尾收窄', 0, 0.7, 0.01],
  ['tip', '刀尖收窄', 0, 0.9, 0.01],
  ['seg', '刀身分段', 8, 40, 1],
  ['hlen', '柄长', 40, 170, 1],
  ['hr0', '柄首半径', 1.6, 6, 0.1],
  ['hr1', '柄尾半径', 1.6, 6, 0.1],
  ['gry', '镡纵向半径', 4, 16, 0.1],
  ['grz', '镡横向半径', 3, 16, 0.1],
  ['gthick', '镡厚', 1, 6, 0.1],
  ['spad', '鞘壁余量', 0.5, 4, 0.1],
  ['slen', '鞘长占比', 0.4, 1, 0.01],
];

const PRESETS = {
  standard: { len: 253, wid: 10.2, thick: 2.6, sori: 22, taper: 0.35, tip: 0.42, seg: 26, hlen: 93 },
  long: { len: 320, wid: 10.5, thick: 2.6, sori: 26, taper: 0.24, tip: 0.34, seg: 30, hlen: 96 },
  short: { len: 168, wid: 12, thick: 2.8, sori: 12, taper: 0.3, tip: 0.38, seg: 22, hlen: 74 },
  curve: { len: 320, wid: 10.5, thick: 2.6, sori: 96, taper: 0.24, tip: 0.34, seg: 30, hlen: 96 },
};

function finish(pos, uv, idx, group) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.group = group;
  return g;
}

function uvIn(region, u, v) {
  const a = region[0], b = region[1], c = region[2], d = region[3];
  return [(a + u * (c - a)) / TEX_W, 1 - (b + v * (d - b)) / TEX_H];
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

// 刀身中心线：t=0 镡侧，t=1 刀尖（x 朝负方向，出模型时统一翻转）
function bladeAt(t, p) {
  const tt = clamp01(t);
  const x = -p.len * tt;
  const y = p.sori * tt * tt;
  let w = p.wid * (1 - p.taper * tt);
  const pinch = Math.max(0, (tt - 0.88) / 0.12);
  w *= (1 - p.tip * Math.pow(Math.min(1, pinch), 1.25));
  return { x: x, y: y, hw: Math.max(0.35, w / 2) };
}

// 6 边截面：y 为刃宽方向（+y 是刃），z 为厚度方向
function bladeSection(hw, ht) {
  return [
    [hw, 0, 0.97],
    [hw - 0.9, -ht, 0.52],
    [-hw + 1.1, -ht, 0.46],
    [-hw, 0, 0.06],
    [-hw + 1.1, ht, 0.46],
    [hw - 0.9, ht, 0.52],
  ];
}

function buildBlade(p) {
  const pos = [], uv = [], idx = [];
  const ht = p.thick / 2;
  const seg = Math.max(6, Math.round(p.seg));
  const rings = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const at = bladeAt(t, p);
    const ring = [];
    for (const sec of bladeSection(at.hw, ht)) {
      ring.push(pos.length / 3);
      pos.push(at.x, at.y + sec[0], sec[1]);
      uv.push(uvIn(R_BLADE, sec[2], t)[0], uvIn(R_BLADE, sec[2], t)[1]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let k = 0; k < 6; k++) {
      const k2 = (k + 1) % 6;
      idx.push(a[k], a[k2], b[k], a[k2], b[k2], b[k]);
    }
  }
  const first = rings[0], last = rings[rings.length - 1];
  for (let k = 1; k < 5; k++) idx.push(first[0], first[k], first[k + 1]);
  for (let k = 1; k < 5; k++) idx.push(last[0], last[k + 1], last[k]);
  return finish(pos, uv, idx, 'blade');
}

function buildHandle(p) {
  const pos = [], uv = [], idx = [];
  const sides = 8, seg = Math.max(4, Math.round(p.hlen / 12));
  const rings = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const r = p.hr0 + (p.hr1 - p.hr0) * t;
    const x = 1.2 + t * p.hlen;
    const ring = [];
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      ring.push(pos.length / 3);
      pos.push(x, Math.sin(a) * r, Math.cos(a) * r * 0.82);
      const uvp = uvIn(R_HANDLE, s / sides, 1 - t);
      uv.push(uvp[0], uvp[1]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      idx.push(a[s], a[s2], b[s], a[s2], b[s2], b[s]);
    }
  }
  const head = rings[rings.length - 1], cIdx = pos.length / 3;
  pos.push(1.2 + p.hlen, 0, 0);
  const hp = uvIn(R_HANDLE, 0.5, 0);
  uv.push(hp[0], hp[1]);
  for (let s = 0; s < sides; s++) idx.push(head[s], head[(s + 1) % sides], cIdx);
  return finish(pos, uv, idx, 'handle');
}

function buildGuard(p) {
  const pos = [], uv = [], idx = [];
  const sides = 24, ht = p.gthick / 2;
  const rings = [];
  for (const sgn of [-1, 1]) {
    const ring = [];
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      ring.push(pos.length / 3);
      pos.push(0.9 + sgn * ht, Math.sin(a) * p.gry, Math.cos(a) * p.grz);
      const uvp = uvIn(R_GUARD, 0.5 + 0.45 * Math.cos(a), 0.5 + 0.45 * Math.sin(a));
      uv.push(uvp[0], uvp[1]);
    }
    rings.push(ring);
  }
  const a0 = rings[0], a1 = rings[1];
  for (let s = 0; s < sides; s++) {
    const s2 = (s + 1) % sides;
    idx.push(a0[s], a0[s2], a1[s], a0[s2], a1[s2], a1[s]);
  }
  for (let ri = 0; ri < 2; ri++) {
    const r = rings[ri], cIdx = pos.length / 3;
    pos.push(ri === 0 ? 0.9 - ht : 0.9 + ht, 0, 0);
    const cp = uvIn(R_GUARD, 0.5, 0.5);
    uv.push(cp[0], cp[1]);
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      if (ri === 0) idx.push(cIdx, r[s2], r[s]);
      else idx.push(cIdx, r[s], r[s2]);
    }
  }
  return finish(pos, uv, idx, 'guard');
}

function buildSheath(p) {
  const pos = [], uv = [], idx = [];
  const sides = 8, seg = Math.max(6, Math.round(p.seg * 0.9));
  const wob = p.wid / 2 + p.spad, hob = p.thick / 2 + p.spad;
  const rings = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * p.slen;
    const at = bladeAt(t, p);
    const ring = [];
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      ring.push(pos.length / 3);
      pos.push(at.x, at.y + Math.sin(a) * wob, Math.cos(a) * hob);
      const uvp = uvIn(R_SHEATH, s / sides, 1 - i / seg);
      uv.push(uvp[0], uvp[1]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      idx.push(a[s], a[s2], b[s], a[s2], b[s2], b[s]);
    }
  }
  const mouth = rings[0], cIdx = pos.length / 3;
  const mp = bladeAt(0, p);
  pos.push(mp.x, mp.y, 0);
  const muv = uvIn(R_SHEATH, 0.5, 1);
  uv.push(muv[0], muv[1]);
  for (let s = 0; s < sides; s++) idx.push(mouth[s], mouth[(s + 1) % sides], cIdx);
  return finish(pos, uv, idx, 'sheath');
}

function buildEffect(p) {
  const pos = [], uv = [], idx = [];
  const t0 = 0.8, n = 8;
  for (let i = 0; i <= n; i++) {
    const t = t0 + (1 - t0) * (i / n);
    const at = bladeAt(t, p);
    const k = 1 + 0.35 * Math.sin((i / n) * Math.PI);
    pos.push(at.x, at.y - at.hw * 0.55 * k, 0);
    const p1 = uvIn(R_BLADE, 0.95, 0.5);
    uv.push(p1[0], p1[1]);
    pos.push(at.x, at.y + at.hw * 0.55 * k, 0);
    uv.push(p1[0], p1[1]);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 2;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return finish(pos, uv, idx, 'effect');
}

function cloneGeo(geo, xf) {
  const p = geo.attributes.position.array.slice();
  const arr = [];
  for (let i = 0; i < p.length; i += 3) {
    const v = new THREE.Vector3(p[i], p[i + 1], p[i + 2]);
    xf(v);
    arr.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  g.setAttribute('uv', geo.attributes.uv.clone());
  g.setIndex(geo.index.clone());
  g.computeVertexNormals();
  return g;
}

function chip(v, len) {
  const t = -v.x / Math.max(1e-3, len);
  if (t > 0.18 && t < 0.46) v.y *= 0.82;
  return v;
}

function mergeGeos(geos) {
  const pos = [], uv = [], idx = [];
  let base = 0;
  for (const g of geos) {
    const p = g.attributes.position.array, t = g.attributes.uv.array, id = g.index.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let i = 0; i < t.length; i++) uv.push(t[i]);
    for (let i = 0; i < id.length; i++) idx.push(id[i] + base);
    base += p.length / 3;
  }
  return finish(pos, uv, idx, 'merged');
}

function iconOf(geos) {
  const rot = new THREE.Matrix4().makeRotationZ(Math.PI / 4);
  const rotGeos = geos.map(function (g) { return cloneGeo(g, function (v) { v.applyMatrix4(rot); }); });
  const box = new THREE.Box3();
  for (const g of rotGeos) box.expandByObject(new THREE.Mesh(g));
  const size = box.getSize(new THREE.Vector3());
  const k = 1.95 / Math.max(size.x, size.y, 0.001);
  const c = box.getCenter(new THREE.Vector3());
  return mergeGeos(rotGeos.map(function (g) {
    return cloneGeo(g, function (v) { v.sub(c).multiplyScalar(k); });
  }));
}

export function buildGeometries(params) {
  const p = Object.assign({}, DEFAULT_PARAMS, params);
  const blade = buildBlade(p);
  const handle = buildHandle(p);
  const guard = buildGuard(p);
  const sheath = buildSheath(p);
  const effect = buildEffect(p);
  const bladeFull = mergeGeos([blade, guard, handle]);
  const damagedRaw = mergeGeos([cloneGeo(blade, function (v) { chip(v, p.len); }), guard, handle]);
  const fragment = cloneGeo(blade, function (v) {
    v.x *= 0.5;
    v.y = v.y * 0.55 - p.len * 0.02;
  });
  const flip = new THREE.Matrix4().makeRotationY(Math.PI);
  const flipGeo = function (g) {
    return cloneGeo(g, function (v) { v.applyMatrix4(flip); });
  };
  const bladeF = flipGeo(bladeFull);
  const icon = iconOf([bladeF]);
  return [
    ['blade', bladeF],
    ['sheath', flipGeo(sheath)],
    ['effect', flipGeo(effect)],
    ['blade_damaged', flipGeo(damagedRaw)],
    ['blade_fragment', flipGeo(fragment)],
    ['item_blade', icon],
    ['item_damaged', cloneGeo(icon, function (v) { return v; })],
    ['item_bladens', cloneGeo(icon, function (v) { return v; })],
  ];
}

export function makeTextureCanvas() {
  const cv = document.createElement('canvas');
  cv.width = TEX_W; cv.height = TEX_H;
  const c = cv.getContext('2d');
  c.fillStyle = '#08090b'; c.fillRect(0, 0, TEX_W, TEX_H);

  const bw = R_BLADE[2] - R_BLADE[0];
  for (let x = R_BLADE[0]; x < R_BLADE[2]; x++) {
    const k = (x - R_BLADE[0]) / Math.max(1, bw - 1);
    let col = '#0b0c0e';
    if (k > 0.94) col = '#a8f0e8';
    else if (k > 0.86) col = '#3cd0c4';
    else if (k > 0.8) col = '#10404a';
    else if (k > 0.55) col = '#0f1114';
    else if (k > 0.35) col = '#1c2024';
    c.fillStyle = col;
    c.fillRect(x, R_BLADE[1], 1, R_BLADE[3] - R_BLADE[1]);
  }
  c.fillStyle = '#161b20';
  for (let y = R_BLADE[1]; y < R_BLADE[3]; y += 9) c.fillRect(R_BLADE[0], y, bw, 1);

  c.fillStyle = '#eeeeef';
  c.fillRect(R_HANDLE[0], R_HANDLE[1], R_HANDLE[2] - R_HANDLE[0], R_HANDLE[3] - R_HANDLE[1]);
  c.fillStyle = '#0c0d0f';
  for (let y = R_HANDLE[1]; y < R_HANDLE[3]; y++) {
    for (let x = R_HANDLE[0]; x < R_HANDLE[2]; x++) {
      if ((x + y) % 11 < 3) c.fillRect(x, y, 1, 1);
    }
  }

  const gx = (R_GUARD[0] + R_GUARD[2]) / 2, gy = (R_GUARD[1] + R_GUARD[3]) / 2;
  const gr = Math.min(R_GUARD[2] - R_GUARD[0], R_GUARD[3] - R_GUARD[1]) / 2;
  for (let y = R_GUARD[1]; y < R_GUARD[3]; y++) {
    for (let x = R_GUARD[0]; x < R_GUARD[2]; x++) {
      const d = Math.hypot(x - gx, y - gy) / gr;
      c.fillStyle = d > 0.94 ? '#5ec6bc' : d > 0.8 ? '#141a1c'
        : Math.abs(d - 0.52) < 0.06 ? '#469692' : '#222c2e';
      c.fillRect(x, y, 1, 1);
    }
  }

  for (let y = R_SHEATH[1]; y < R_SHEATH[3]; y++) {
    for (let x = R_SHEATH[0]; x < R_SHEATH[2]; x++) {
      const yy = y - R_SHEATH[1];
      let col = '#0b0d11';
      if (yy < 4) col = '#2b3742';
      else if (yy % 84 < 3) col = '#1c242c';
      if (x >= R_SHEATH[2] - 3) col = '#3cb4ac';
      c.fillStyle = col;
      c.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

export function geomsToObj(list) {
  const lines = ['# Sakura Edge Studio - 拔刀剑模型（8 组，刀尖朝 +X）', ''];
  const vs = [], ts = [], parts = [];
  let base = 0;
  for (const item of list) {
    const name = item[0], geo = item[1];
    const p = geo.attributes.position.array, t = geo.attributes.uv.array, id = geo.index.array;
    for (let i = 0; i < p.length; i += 3) {
      vs.push('v ' + p[i].toFixed(4) + ' ' + p[i + 1].toFixed(4) + ' ' + p[i + 2].toFixed(4));
    }
    for (let i = 0; i < t.length; i += 2) ts.push('vt ' + t[i].toFixed(5) + ' ' + t[i + 1].toFixed(5));
    const fs = [];
    for (let i = 0; i < id.length; i += 3) {
      const a = id[i] + base + 1, b = id[i + 1] + base + 1, c2 = id[i + 2] + base + 1;
      fs.push('f ' + a + '/' + a + ' ' + b + '/' + b + ' ' + c2 + '/' + c2);
    }
    parts.push([name, fs]);
    base += p.length / 3;
  }
  const out = [];
  for (const v of vs) out.push(v);
  out.push('');
  for (const t of ts) out.push(t);
  out.push('');
  for (const part of parts) {
    out.push('g ' + part[0]);
    for (const f of part[1]) out.push(f);
  }
  return out.join('\n') + '\n';
}

// ---------------- 建模器 UI ----------------

export function createModeler(overlay, opts) {
  const o = opts || {};
  overlay.innerHTML = [
    '<div class="mdl-wrap">',
    '  <header class="mdl-head">',
    '    <div class="mdl-title">拔刀剑建模器<span>参数化 · 8 组 · 对齐原版</span></div>',
    '    <div class="mdl-tools">',
    '      <button data-mdl="view-front">正视</button>',
    '      <button data-mdl="view-side">侧视</button>',
    '      <button data-mdl="view-top">俯视</button>',
    '      <span class="mdl-sep"></span>',
    '      <button data-mdl="ref">原版基准</button>',
    '      <button data-mdl="grid" class="on">网格</button>',
    '      <span class="mdl-sep"></span>',
    '      <button data-mdl="obj">导出 OBJ</button>',
    '      <button data-mdl="tex">导出贴图</button>',
    '      <button data-mdl="apply">写入这把刀</button>',
    '      <button data-mdl="close" class="ghost">关闭</button>',
    '    </div>',
    '  </header>',
    '  <div class="mdl-main">',
    '    <aside class="mdl-left">',
    '      <div class="mdl-h">模型分组</div>',
    '      <div id="mdlTree"></div>',
    '      <div class="mdl-h">统计</div>',
    '      <div class="mdl-stats" id="mdlStats"></div>',
    '      <div class="mdl-note">分组名与位置按 mcmod 教程 5202：8 组必须与原版重合，刀尖朝 +X。</div>',
    '    </aside>',
    '    <div class="mdl-stage"><canvas id="mdlCanvas"></canvas>',
    '      <div class="mdl-hint">拖动空白＝旋转视图 · 滚轮＝缩放 · 点部件＝选中</div>',
    '    </div>',
    '    <aside class="mdl-right">',
    '      <div class="mdl-h">刀模参数</div>',
    '      <div id="mdlFields"></div>',
    '      <div class="mdl-h">预设</div>',
    '      <div class="mdl-chips">',
    '        <span data-preset="standard">标准太刀</span>',
    '        <span data-preset="long">长太刀</span>',
    '        <span data-preset="short">短刀</span>',
    '        <span data-preset="curve">大弯刀</span>',
    '        <span data-preset="reset">重置</span>',
    '      </div>',
    '      <div class="mdl-note">参数只影响几何；分组、朝向和 UV 已按规范固定。想用外部模型就在主界面「模型 → 导入」。</div>',
    '    </aside>',
    '  </div>',
    '</div>',
  ].join('\n');

  const canvas = overlay.querySelector('#mdlCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0b0f14, 1);

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  const refGroup = new THREE.Group();
  scene.add(root, refGroup);

  const cam = new THREE.PerspectiveCamera(32, 1, 1, 6000);
  let camTheta = -0.34, camPhi = 1.30, camDist = 660;
  const camTarget = new THREE.Vector3(88, 20, 0);

  scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x171b24, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(300, 240, 240);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fd0ff, 0.6);
  fill.position.set(-260, 60, 260);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe6cc, 0.45);
  rim.position.set(-80, -220, -300);
  scene.add(rim);

  const grid = new THREE.GridHelper(360, 18, 0x26303d, 0x1b212a);
  grid.position.y = -6;
  scene.add(grid);

  const state = {
    params: Object.assign({}, DEFAULT_PARAMS, (o.getBlade && o.getBlade() || {}).modelParams || {}),
    visible: {
      blade: true, sheath: false, effect: true, blade_damaged: false,
      blade_fragment: false, item_blade: false, item_damaged: false, item_bladens: false,
    },
    selected: 'blade',
    showRef: false,
  };

  const meshes = {};
  const matCache = {};
  function matFor(name) {
    if (matCache[name]) return matCache[name];
    let mat;
    if (name === 'effect') {
      mat = new THREE.MeshBasicMaterial({ color: 0x62e6d6, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLOR[name] || 0x93a3b5),
        roughness: 0.42, metalness: 0.34, side: THREE.DoubleSide,
      });
    }
    matCache[name] = mat;
    return mat;
  }

  let selLine = null;

  function paintSelection() {
    if (selLine) {
      root.remove(selLine);
      selLine.geometry.dispose();
      selLine.material.dispose();
      selLine = null;
    }
    const m = meshes[state.selected];
    if (!m || !m.visible) return;
    const e = new THREE.EdgesGeometry(m.geometry, 32);
    selLine = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0x5ee0d0, transparent: true, opacity: 0.85 }));
    root.add(selLine);
  }

  function renderTree() {
    const el = overlay.querySelector('#mdlTree');
    el.innerHTML = GROUPS.map(function (grp) {
      const k = grp[0], desc = grp[1];
      const g = meshes[k];
      const tri = g && g.geometry.index ? Math.round(g.geometry.index.count / 3) : 0;
      const hex = (COLOR[k] || 0xffffff).toString(16).padStart(6, '0');
      return '<label class="mdl-grp' + (k === state.selected ? ' sel' : '') + (state.visible[k] === false ? ' off' : '')
        + '" data-grp="' + k + '" title="' + desc + '">'
        + '<input type="checkbox" ' + (state.visible[k] === false ? '' : 'checked') + ' data-vis="' + k + '" />'
        + '<span class="dot" style="background:#' + hex + '"></span>'
        + '<span class="nm">' + k + '</span><span class="ct">' + tri + '</span></label>';
    }).join('');
  }

  function renderStats() {
    let v = 0, f = 0, n = 0;
    for (const grp of GROUPS) {
      const m = meshes[grp[0]];
      if (!m) continue;
      n++;
      v += m.geometry.attributes.position.count;
      f += m.geometry.index ? m.geometry.index.count / 3 : 0;
    }
    overlay.querySelector('#mdlStats').innerHTML =
      '<div>顶点 <b>' + v + '</b></div><div>三角面 <b>' + Math.round(f) + '</b></div><div>组数 <b>' + n + '/8</b></div>';
  }

  function renderFields() {
    overlay.querySelector('#mdlFields').innerHTML = FIELDS.map(function (fd) {
      const k = fd[0], label = fd[1], min = fd[2], max = fd[3], step = fd[4];
      return '<div class="mdl-row"><span>' + label + '</span>'
        + '<input type="range" data-p="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + state.params[k] + '" />'
        + '<span class="val" data-v="' + k + '">' + state.params[k] + '</span></div>';
    }).join('');
  }

  function syncFields() {
    for (const fd of FIELDS) {
      const k = fd[0];
      const inp = overlay.querySelector('input[data-p="' + k + '"]');
      if (inp) inp.value = state.params[k];
      const v = overlay.querySelector('[data-v="' + k + '"]');
      if (v) v.textContent = state.params[k];
    }
  }

  function rebuild() {
    for (const k of Object.keys(meshes)) {
      const m = meshes[k];
      root.remove(m);
      m.geometry.dispose();
      delete meshes[k];
    }
    const list = buildGeometries(state.params);
    for (const item of list) {
      const name = item[0], geo = item[1];
      const mesh = new THREE.Mesh(geo, matFor(name));
      mesh.name = name;
      mesh.visible = state.visible[name] !== false;
      root.add(mesh);
      meshes[name] = mesh;
    }
    paintSelection();
    renderTree();
    renderStats();
    draw();
  }

  // 原版基准：固定原版尺寸（刀身 253 / 刃宽 10 / 上翘 22 / 柄 93）
  const REF = { len: 253, wid: 10, sori: 22, hlen: 93 };
  function buildRef() {
    function mkLine(pts, color, op) {
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: op, depthTest: false }));
      ln.renderOrder = 6;
      return ln;
    }
    const up = [], dn = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const x = REF.len * t;
      const y = REF.sori * t * t;
      const hw = REF.wid / 2 * (1 - 0.35 * t);
      up.push(new THREE.Vector3(x, y + hw, 0));
      dn.push(new THREE.Vector3(x, y - hw, 0));
    }
    refGroup.add(
      mkLine(up, 0x3fd8ca, 0.75),
      mkLine(dn, 0x3fd8ca, 0.75),
      mkLine([new THREE.Vector3(-REF.hlen, 0, 0), new THREE.Vector3(0, 0, 0)], 0x6a7c92, 0.7)
    );
    refGroup.visible = false;
  }

  function resize() {
    const host = canvas.parentElement;
    const w = (host && host.clientWidth) || 1;
    const h = (host && host.clientHeight) || 1;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    draw();
  }

  function updateCamera() {
    const sp = Math.sin(camPhi), cp = Math.cos(camPhi);
    cam.position.set(
      camTarget.x + camDist * sp * Math.sin(camTheta),
      camTarget.y + camDist * cp,
      camTarget.z + camDist * sp * Math.cos(camTheta)
    );
    cam.lookAt(camTarget);
  }

  function draw() { renderer.render(scene, cam); }

  let drag = null;
  canvas.addEventListener('pointerdown', function (ev) {
    drag = { x: ev.clientX, y: ev.clientY, theta: camTheta, phi: camPhi, moved: 0 };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    camTheta = drag.theta - dx * 0.006;
    camPhi = Math.min(Math.PI - 0.05, Math.max(0.05, drag.phi - dy * 0.006));
    updateCamera();
    draw();
  });
  canvas.addEventListener('pointerup', function (ev) {
    if (drag && drag.moved < 4) {
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cam);
      const hits = ray.intersectObjects(root.children, true).filter(function (h) {
        return h.object && h.object.isMesh && h.object.visible;
      });
      if (hits.length) {
        state.selected = hits[0].object.name;
        paintSelection();
        renderTree();
        draw();
      }
    }
    drag = null;
  });
  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    camDist = Math.min(1800, Math.max(90, camDist * (1 + Math.sign(ev.deltaY) * 0.12)));
    updateCamera();
    draw();
  }, { passive: false });

  overlay.addEventListener('click', function (ev) {
    const btn = ev.target.closest('button[data-mdl]');
    if (btn) {
      const act = btn.dataset.mdl;
      if (act === 'close') { if (o.close) o.close(); return; }
      if (act === 'view-front') { camTheta = -0.34; camPhi = 1.30; camDist = 660; camTarget.set(88, 20, 0); updateCamera(); draw(); }
      if (act === 'view-side') { camTheta = -1.05; camPhi = 1.24; camDist = 700; camTarget.set(88, 20, 0); updateCamera(); draw(); }
      if (act === 'view-top') { camTheta = 0; camPhi = 0.30; camDist = 760; camTarget.set(88, 20, 0); updateCamera(); draw(); }
      if (act === 'ref') {
        state.showRef = !state.showRef;
        refGroup.visible = state.showRef;
        btn.classList.toggle('on', state.showRef);
        draw();
      }
      if (act === 'grid') {
        grid.visible = !grid.visible;
        btn.classList.toggle('on', grid.visible);
        draw();
      }
      if (act === 'obj') {
        const text = geomsToObj(buildGeometries(state.params));
        if (window.api && window.api.saveObj) window.api.saveObj('拔刀剑模型.obj', text);
        else downloadText('拔刀剑模型.obj', text);
      }
      if (act === 'tex') {
        const url = makeTextureCanvas().toDataURL('image/png');
        if (window.api && window.api.savePng) window.api.savePng('拔刀剑贴图.png', url);
      }
      if (act === 'apply') {
        const obj = geomsToObj(buildGeometries(state.params));
        const png = makeTextureCanvas().toDataURL('image/png');
        if (o.commit) o.commit(obj, png, Object.assign({}, state.params));
        if (o.close) o.close();
      }
      return;
    }
    const chip = ev.target.closest('[data-preset]');
    if (chip) {
      const k = chip.dataset.preset;
      if (k === 'reset') state.params = Object.assign({}, DEFAULT_PARAMS);
      else state.params = Object.assign({}, DEFAULT_PARAMS, PRESETS[k] || {});
      syncFields();
      rebuild();
      return;
    }
    const row = ev.target.closest('[data-grp]');
    if (row) {
      const name = row.dataset.grp;
      if (ev.target.matches && ev.target.matches('input[type=checkbox]')) {
        state.visible[name] = ev.target.checked;
        if (meshes[name]) meshes[name].visible = ev.target.checked;
        renderTree();
        paintSelection();
        draw();
        return;
      }
      state.selected = name;
      if (state.visible[name] === false) {
        state.visible[name] = true;
        if (meshes[name]) meshes[name].visible = true;
      }
      renderTree();
      paintSelection();
      draw();
    }
  });

  overlay.addEventListener('input', function (ev) {
    const inp = ev.target.closest('input[data-p]');
    if (!inp) return;
    const k = inp.dataset.p;
    state.params[k] = Number(inp.value);
    const v = overlay.querySelector('[data-v="' + k + '"]');
    if (v) v.textContent = inp.value;
    rebuild();
  });

  function downloadText(name, text) {
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = name;
    a.click();
  }

  renderFields();
  buildRef();
  rebuild();
  updateCamera();
  resize();

  const ro = new ResizeObserver(function () { resize(); });
  ro.observe(canvas.parentElement);
  window.addEventListener('resize', resize);

  return {
    dispose: function () {
      try { ro.disconnect(); } catch (e) { /* ignore */ }
      window.removeEventListener('resize', resize);
      for (const k of Object.keys(meshes)) meshes[k].geometry.dispose();
      renderer.dispose();
    },
  };
}
