// 拔刀剑几何核心：参数化生成 8 组、贴图与 OBJ 导出（Blade Forge 独立版）
import * as THREE from './vendor/three.module.js';

const TEX_W = 128, TEX_H = 256;
export const R_BLADE = [1, 2, 55, 253];
const R_HANDLE = [58, 2, 84, 158];
const R_GUARD = [87, 2, 126, 40];
const R_SHEATH = [87, 44, 126, 253];

export const TEX_REGIONS = { blade: R_BLADE, handle: R_HANDLE, guard: R_GUARD, sheath: R_SHEATH };

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
  slen: 1.0,     // 鞘长占比（1 = 与刃同长，可到 1.12 包住刃尖）
  // 部件增删：false = 这件不生成（直接省掉几何，不是隐藏）
  bladeOn: true,
  guardOn: true,
  handleOn: true,
  pommelOn: false,   // 柄头（柄末端金属件）
  fuchiOn: false,    // 柄口（柄与镡之间的环）
  grooveOn: false,   // 血槽（刃面凹槽）
  // 分件自定义
  gshape: 0,         // 镡形状：0 椭圆 / 1 正圆 / 2 方 / 3 十字
  hsides: 8,         // 柄棱数：6 / 8 / 10 / 12
  wrapOn: false,     // 柄卷（缠绕绳）
  wrapCount: 5,      // 缠绳圈数
  sscale: 1,         // 鞘粗细微调
  sshape: 0,         // 鞘截面：0 八棱 / 1 圆 / 2 六角 / 3 方
  kojiriOn: false,   // 鞘尾金属件
  koiguchiOn: false, // 鞘口环
};

/** 鞘截面：返回边数、起始角、纵向/横向半径（各截面共用，鞘本体和鞘口环/鞘尾跟着同一个形状走） */
export function sheathShape(p, scale) {
  const wob = (p.wid / 2 + p.spad) * (scale == null ? 1 : scale) * (p.sscale == null ? 1 : p.sscale);
  const hob = (p.thick / 2 + p.spad) * (scale == null ? 1 : scale) * (p.sscale == null ? 1 : p.sscale);
  const shape = Math.round(p.sshape == null ? 0 : p.sshape);
  if (shape === 1) return { sides: 20, phase: 0, wob, hob };                          // 圆鞘
  if (shape === 2) return { sides: 6, phase: 0, wob, hob };                           // 六角鞘
  if (shape === 3) {                                                                  // 方鞘：四点落在方角上
    return { sides: 4, phase: Math.PI / 4, wob: wob * Math.SQRT2, hob: hob * Math.SQRT2 };
  }
  return { sides: 8, phase: 0, wob, hob };                                            // 八棱（默认）
}

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
  ['slen', '鞘长占比', 0.4, 1.12, 0.01],
];

const PRESETS = {
  standard: { len: 253, wid: 10.2, thick: 2.6, sori: 22, taper: 0.35, tip: 0.42, seg: 26, hlen: 93 },
  long: { len: 320, wid: 10.5, thick: 2.6, sori: 26, taper: 0.24, tip: 0.34, seg: 30, hlen: 96 },
  short: { len: 168, wid: 12, thick: 2.8, sori: 12, taper: 0.3, tip: 0.38, seg: 22, hlen: 74 },
  curve: { len: 320, wid: 10.5, thick: 2.6, sori: 96, taper: 0.24, tip: 0.34, seg: 30, hlen: 96 },
};

export function finish(pos, uv, idx, group) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.group = group;
  return g;
}

export function uvIn(region, u, v) {
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
function bladeSection(hw, ht, edge) {
  return [
    [hw, 0, 0.97],
    [hw - 0.9, -ht, 0.76],
    [-hw + 1.1, -ht, 0.46],
    [-hw, 0, edge ? 0.97 : 0.06],
    [-hw + 1.1, ht, 0.46],
    [hw - 0.9, ht, 0.76],
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
    for (const sec of bladeSection(at.hw, ht, p.edge)) {
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
  const sides = Math.max(4, Math.min(16, Math.round(p.hsides || 8)));
  const seg = Math.max(4, Math.round(p.hlen / 12));
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
  const handles = [finish(pos, uv, idx, 'handle')];
  if (p.wrapOn !== false) {
    const n = Math.max(1, Math.round(p.wrapCount));
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      handles.push(wrapRing(p, t, sides));
    }
  }
  return handles.length === 1 ? handles[0] : mergeGeos(handles);
}

/** 柄卷：柄表面一圈略微凸起的缠绳 */
function wrapRing(p, t, sides) {
  const pos = [], uv = [], idx = [];
  const r = (p.hr0 + (p.hr1 - p.hr0) * t) + 0.42;
  const x = 1.2 + t * p.hlen;
  const uvp = uvIn(R_HANDLE, 0.5, 0.05);
  const rings = [];
  for (const sgn of [-1, 1]) {
    const ring = [];
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      ring.push(pos.length / 3);
      pos.push(x + sgn * 0.85, Math.sin(a) * r, Math.cos(a) * r * 0.82);
      uv.push(uvp[0], uvp[1]);
    }
    rings.push(ring);
  }
  const a0 = rings[0], a1 = rings[1];
  for (let s = 0; s < sides; s++) {
    const s2 = (s + 1) % sides;
    idx.push(a0[s], a0[s2], a1[s], a0[s2], a1[s2], a1[s]);
  }
  return finish(pos, uv, idx, 'handle');
}

/** 环形金属件（柄头 / 柄口）：朝 X 轴的短圆环，两端封口。 */
function buildBand(p, cx, halfThick, r, ryRatio, urange) {
  const pos = [], uv = [], idx = [];
  const sides = 12;
  const uvp = uvIn(R_HANDLE, urange[0], urange[1]);
  const rings = [];
  for (const sgn of [-1, 1]) {
    const ring = [];
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      ring.push(pos.length / 3);
      pos.push(cx + sgn * halfThick, Math.sin(a) * r, Math.cos(a) * r * ryRatio);
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
    const r0 = rings[ri], c = pos.length / 3;
    pos.push(cx + (ri === 0 ? -halfThick : halfThick), 0, 0);
    uv.push(uvp[0], uvp[1]);
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      if (ri === 0) idx.push(c, r0[s2], r0[s]);
      else idx.push(c, r0[s], r0[s2]);
    }
  }
  return finish(pos, uv, idx, 'blade');
}

/** 柄头：柄末端的金属盘，半径比柄尾大一圈。 */
function buildPommel(p) {
  return buildBand(p, 1.2 + p.hlen + 0.8, 1.3, p.hr1 * 1.32, 0.82, [0.5, 0.12]);
}

/** 柄口：柄与镡之间的金属环，卡在靠近镡的一侧。 */
function buildFuchi(p) {
  return buildBand(p, 1.2 + 3.2, 1.4, p.hr0 * 1.16, 0.82, [0.5, 0.2]);
}

/** 血槽：刃面中线两侧各压一条窄槽，正反两片。 */
function buildGroove(p) {
  const pos = [], uv = [], idx = [];
  const ht = p.thick / 2;
  const n = 14;
  const w = Math.max(0.45, p.wid * 0.085);
  const zOut = ht - Math.min(0.4, ht * 0.4);
  const uvp = uvIn(R_BLADE, 0.5, 0.5);
  for (const sgn of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const t = 0.06 + 0.82 * (i / n);
      const at = bladeAt(t, p);
      for (const dy of [-w, w]) {
        pos.push(at.x, at.y + dy, sgn * zOut);
        uv.push(uvp[0], uvp[1]);
      }
    }
    for (let i = 0; i < n; i++) {
      const a = base + i * 2;
      if (sgn > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return finish(pos, uv, idx, 'blade');
}

/** 镡轮廓（y 为纵向、z 为横向），按 gshape 生成 */
function guardProfile(shape, ry, rz) {
  const pts = [];
  if (shape === 2) {
    pts.push([ry, rz], [-ry, rz], [-ry, -rz], [ry, -rz]);
  } else if (shape === 3) {
    const a = 0.32;
    const w1 = ry * a, w2 = rz * a;
    pts.push([ry, w2], [w1, w2], [w1, rz], [-w1, rz], [-w1, w2], [-ry, w2],
      [-ry, -w2], [-w1, -w2], [-w1, -rz], [w1, -rz], [w1, -w2], [ry, -w2]);
  } else {
    const sides = 24;
    const R = Math.max(ry, rz);
    for (let i = 0; i < sides; i++) {
      const ang = (2 * Math.PI * i) / sides;
      if (shape === 1) pts.push([Math.sin(ang) * R, Math.cos(ang) * R]);
      else pts.push([Math.sin(ang) * ry, Math.cos(ang) * rz]);
    }
  }
  return pts;
}

function buildGuard(p) {
  const pos = [], uv = [], idx = [];
  const prof = guardProfile(p.gshape, p.gry, p.grz);
  const n = prof.length;
  const ht = p.gthick / 2;
  const uvOf = function (pt) {
    const u = 0.5 + 0.45 * (pt[0] / Math.max(0.001, p.gry));
    const v = 0.5 + 0.45 * (pt[1] / Math.max(0.001, p.grz));
    const q = uvIn(R_GUARD, u, v);
    return q;
  };
  const rings = [];
  for (const sgn of [-1, 1]) {
    const ring = [];
    for (const pt of prof) {
      ring.push(pos.length / 3);
      pos.push(0.9 + sgn * ht, pt[0], pt[1]);
      const q = uvOf(pt);
      uv.push(q[0], q[1]);
    }
    rings.push(ring);
  }
  const a0 = rings[0], a1 = rings[1];
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    idx.push(a0[i], a0[i2], a1[i], a0[i2], a1[i2], a1[i]);
  }
  // 两端扇形封口（轮廓都是关于中心的星形，可直接扇形三角化）
  for (let ri = 0; ri < 2; ri++) {
    const ring = rings[ri], c = pos.length / 3;
    pos.push(ri === 0 ? 0.9 - ht : 0.9 + ht, 0, 0);
    const cp = uvIn(R_GUARD, 0.5, 0.5);
    uv.push(cp[0], cp[1]);
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      if (ri === 0) idx.push(c, ring[i2], ring[i]);
      else idx.push(c, ring[i], ring[i2]);
    }
  }
  return finish(pos, uv, idx, 'guard');
}

/** 沿 X 轴的短环（鞘口 / 鞘尾这类金属件） */
function sheathBand(p, t, halfLen, scale, urange) {
  const pos = [], uv = [], idx = [];
  const sh = sheathShape(p, scale);
  const sides = sh.sides;
  const at = bladeAt(t, p);
  const wob = sh.wob, hob = sh.hob;
  const uvp = uvIn(R_SHEATH, urange[0], urange[1]);
  const rings = [];
  for (const sgn of [-1, 1]) {
    const ring = [];
    for (let s = 0; s < sides; s++) {
      const a = sh.phase + (2 * Math.PI * s) / sides;
      ring.push(pos.length / 3);
      pos.push(at.x + sgn * halfLen, at.y + Math.sin(a) * wob, Math.cos(a) * hob);
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
    const r0 = rings[ri], c = pos.length / 3;
    pos.push(at.x + (ri === 0 ? -halfLen : halfLen), at.y, 0);
    uv.push(uvp[0], uvp[1]);
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      if (ri === 0) idx.push(c, r0[s2], r0[s]);
      else idx.push(c, r0[s], r0[s2]);
    }
  }
  return finish(pos, uv, idx, 'sheath');
}

function buildSheath(p) {
  const pos = [], uv = [], idx = [];
  const seg = Math.max(6, Math.round(p.seg * 0.9));
  const sh = sheathShape(p, 1);
  const sides = sh.sides, wob = sh.wob, hob = sh.hob;
  const rings = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * p.slen;
    const at = bladeAt(t, p);
    const ring = [];
    for (let s = 0; s < sides; s++) {
      const a = sh.phase + (2 * Math.PI * s) / sides;
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
  const sheaths = [finish(pos, uv, idx, 'sheath')];
  if (p.koiguchiOn !== false) sheaths.push(sheathBand(p, 0.015, 1.4, 1.06, [0.0, 1.0]));
  if (p.kojiriOn !== false) sheaths.push(sheathBand(p, p.slen * 0.985, 2.0, 1.12, [1.0, 1.0]));
  return sheaths.length === 1 ? sheaths[0] : mergeGeos(sheaths);
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

export function mergeGeos(geos) {
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

  // 按部件开关拼装：关掉的部件直接不生成几何
  const on = function (flag, geo) { return p[flag] === false ? null : geo; };
  const parts = [
    on('bladeOn', blade),
    on('guardOn', guard),
    on('handleOn', handle),
    on('pommelOn', buildPommel(p)),
    on('fuchiOn', buildFuchi(p)),
    on('grooveOn', buildGroove(p)),
  ].filter(Boolean);
  // 全关掉时用一个小方块占位，避免图标/合并崩溃（正常装配不会走到这里）
  const tiny = function () { return new THREE.BoxGeometry(0.5, 0.5, 0.5); };
  if (!parts.length) parts.push(tiny());
  const bladeFull = mergeGeos(parts);
  const dmgParts = [p.bladeOn === false ? null : cloneGeo(blade, function (v) { chip(v, p.len); }),
      on('guardOn', guard), on('handleOn', handle),
      on('pommelOn', buildPommel(p)), on('fuchiOn', buildFuchi(p)), on('grooveOn', buildGroove(p))].filter(Boolean);
  const damagedRaw = dmgParts.length ? mergeGeos(dmgParts) : tiny();
  const fragment = p.bladeOn === false ? tiny() : cloneGeo(blade, function (v) {
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

export function makeMtl(pngName) {
  return [
    '# Blade Forge material',
    'newmtl blade_tex',
    'Ka 1.000 1.000 1.000',
    'Kd 1.000 1.000 1.000',
    'Ks 0.100 0.100 0.100',
    'Ns 10.0',
    'd 1.0',
    'illum 2',
    'map_Kd ' + pngName,
    '',
  ].join('\n');
}

export function makeTextureCanvas() {
  const cv = document.createElement('canvas');
  cv.width = TEX_W; cv.height = TEX_H;
  const c = cv.getContext('2d');
  c.fillStyle = '#08090b'; c.fillRect(0, 0, TEX_W, TEX_H);

  const bw = R_BLADE[2] - R_BLADE[0];
  for (let x = R_BLADE[0]; x < R_BLADE[2]; x++) {
    const k = (x - R_BLADE[0]) / Math.max(1, bw - 1);
    let col = '#141a1f';
    if (k > 0.93) col = '#c8f8f2';
    else if (k > 0.88) col = '#59e0d4';
    else if (k > 0.82) col = '#2b7f86';
    else if (k > 0.28) {
      const j = (Math.min(k, 0.82) - 0.28) / 0.54;
      const lerp = (a, b) => Math.round(a + (b - a) * j).toString(16).padStart(2, '0');
      col = '#' + lerp(0x52, 0x1b) + lerp(0x5f, 0x21) + lerp(0x6c, 0x28);
    }
    c.fillStyle = col;
    c.fillRect(x, R_BLADE[1], 1, R_BLADE[3] - R_BLADE[1]);
  }
  c.fillStyle = '#3a424b';
  c.fillRect(R_HANDLE[0], R_HANDLE[1], R_HANDLE[2] - R_HANDLE[0], R_HANDLE[3] - R_HANDLE[1]);
  c.fillStyle = '#161a1f';
  for (let y = R_HANDLE[1]; y < R_HANDLE[3]; y++) {
    for (let x = R_HANDLE[0]; x < R_HANDLE[2]; x++) {
      if ((x + y) % 9 < 3) c.fillRect(x, y, 1, 1);
    }
  }
  c.fillStyle = '#6a727c';
  for (let y = R_HANDLE[1] + 3; y < R_HANDLE[3]; y += 26) c.fillRect(R_HANDLE[0], y, R_HANDLE[2] - R_HANDLE[0], 3);

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

export function geomsToObj(list, mtlName) {
  const lines = ['# Blade Forge - 拔刀剑模型（8 组，刀尖朝 +X）', ''];
  if (mtlName) { lines.push('mtllib ' + mtlName, ''); }
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
  const out = lines.slice();
  for (const v of vs) out.push(v);
  out.push('');
  for (const t of ts) out.push(t);
  out.push('');
  for (const part of parts) {
    out.push('g ' + part[0]);
    out.push('usemtl blade_tex');
    for (const f of part[1]) out.push(f);
  }
  return out.join('\n') + '\n';
}
