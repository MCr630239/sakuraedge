// 附加件：镡纹章 / 柄穗 / 鞘挂饰 / 刀光 / 粒子火花
// 每个附件按刀身参数沿刀定位，最终并入 blade 或 effect 组一起导出
import * as THREE from './vendor/three.module.js';
import { uvIn, finish, mergeGeos, R_BLADE } from './geometry.js';

export const EXTRA_LIST = [
  { type: 'crest', label: '镡纹章', target: 'blade', color: 0xd8b46a, defT: 0.0, defK: 1.0, desc: '环箍纹章：位置=沿刀身滑动' },
  { type: 'tassel', label: '柄穗', target: 'blade', color: 0xc0392b, defT: 0.55, defK: 1.0, desc: '柄尾红穗：位置=穗长' },
  { type: 'hanger', label: '鞘挂饰', target: 'blade', color: 0x9aa7b3, defT: 0.88, defK: 1.0, desc: '鞘口双金属环：位置=沿刀身' },
  { type: 'glow', label: '刀光', target: 'effect', color: 0x6fe8da, defT: 0.35, defK: 1.0, desc: '刃口光带：位置=光带起点' },
  { type: 'sparks', label: '火花', target: 'effect', color: 0xffc061, defT: 0.45, defK: 1.0, desc: '光点：位置=分布起点' },
  { type: 'cube', label: '方块', target: 'blade', color: 0x8f979f, defT: 0.5, defK: 1.0, desc: '自由方块：位置/宽高厚/倾斜都能改，可当护手、挂件、血槽' },
];

function quadStrip(pos, uv, idx, path, wFn, vTag) {
  // path: [{x,y,z}] 中心线；wFn(i) 给半宽
  const rings = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i], w = wFn(i);
    const base = pos.length / 3;
    pos.push(p.x, p.y + w, p.z);
    pos.push(p.x, p.y - w, p.z);
    uv.push(...uvIn(R_BLADE, 0.95, vTag), ...uvIn(R_BLADE, 0.05, vTag));
    rings.push([base, base + 1]);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    idx.push(a[0], b[0], a[1], b[0], b[1], a[1]);
  }
}

function ringBand(pos, uv, idx, cx, cy, cz, ry, rz, w, seg, vTag) {
  const ringA = [], ringB = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const sy = Math.sin(a), sz = Math.cos(a);
    const r0 = pos.length / 3;
    pos.push(cx - w, cy + sy * ry, cz + sz * rz);
    pos.push(cx + w, cy + sy * ry, cz + sz * rz);
    const r1 = pos.length / 3;
    pos.push(cx - w, cy + sy * (ry * 0.72), cz + sz * (rz * 0.72));
    pos.push(cx + w, cy + sy * (ry * 0.72), cz + sz * (rz * 0.72));
    uv.push(...uvIn(R_BLADE, 0.95, vTag), ...uvIn(R_BLADE, 0.95, vTag));
    uv.push(...uvIn(R_BLADE, 0.05, vTag), ...uvIn(R_BLADE, 0.05, vTag));
    ringA.push([r0, r0 + 1]);
    ringB.push([r1, r1 + 1]);
  }
  for (let i = 0; i < seg; i++) {
    const a0 = ringA[i], a1 = ringA[i + 1], b0 = ringB[i], b1 = ringB[i + 1];
    idx.push(a0[0], a1[0], b0[0], a1[0], b1[0], b0[0]);
    idx.push(a0[1], b0[1], a1[1], a1[1], b0[1], b1[1]);
  }
}

function tube(pos, uv, idx, from, to, r, sides, seg, vTag) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const nrm = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
  if (nrm.lengthSq() < 1e-4) nrm.set(1, 0, 0);
  const bi = new THREE.Vector3().crossVectors(dir.normalize(), nrm).normalize();
  const rings = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const c = new THREE.Vector3().lerpVectors(from, to, t);
    const ring = [];
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      ring.push(pos.length / 3);
      pos.push(
        c.x + (Math.cos(a) * nrm.x + Math.sin(a) * bi.x) * r,
        c.y + (Math.cos(a) * nrm.y + Math.sin(a) * bi.y) * r,
        c.z + (Math.cos(a) * nrm.z + Math.sin(a) * bi.z) * r,
      );
      uv.push(...uvIn(R_BLADE, 0.5, vTag));
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
}

function bladePt(t, p) {
  const tt = Math.max(0, Math.min(1, t));
  return {
    x: p.len * tt,
    y: p.sori * tt * tt,
    hw: Math.max(0.4, (p.wid * (1 - p.taper * tt)) / 2),
  };
}

function buildCrest(p, t, k) {
  const pos = [], uv = [], idx = [];
  const at = bladePt(t, p);
  const near = t < 0.04;
  const ry = near ? p.gry * 1.18 * k : Math.max(1.6, at.hw * 1.32) * k;
  const rz = near ? p.grz * 1.2 * k : (p.thick * 1.35) * k;
  const w = (near ? p.gthick * 0.7 : p.thick * 0.8) * k;
  ringBand(pos, uv, idx, at.x, at.y, 0, ry, rz, w, 20, 0.9);
  return finish(pos, uv, idx, 'crest');
}

function buildTassel(p, t, k) {
  const pos = [], uv = [], idx = [];
  const x = -p.hlen - 2;
  const L = (12 + t * 40) * k;
  tube(pos, uv, idx, new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -L, 0), 1.5 * k, 6, 7, 0.5);
  tube(pos, uv, idx, new THREE.Vector3(x, -L, 0), new THREE.Vector3(x, -L - 8 * k, 0), 4.2 * k, 8, 3, 0.9);
  ringBand(pos, uv, idx, x, 0, 0, 2.2 * k, 2.2 * k, 1.2 * k, 10, 0.5);
  return finish(pos, uv, idx, 'tassel');
}

function buildHanger(p, t, k) {
  const pos = [], uv = [], idx = [];
  const at = bladePt(t, p);
  for (const sx of [-1, 1]) {
    ringBand(pos, uv, idx, at.x + sx * 6 * k, at.y, (p.thick / 2 + p.spad) * 1.1, 4.4 * k, 1.1 * k, 0.9 * k, 12, 0.7);
  }
  return finish(pos, uv, idx, 'hanger');
}

function buildGlow(p, t, k) {
  const pos = [], uv = [], idx = [];
  const path = [];
  const start = Math.min(0.85, Math.max(0.05, t));
  for (let i = 0; i <= 16; i++) {
    const tt = start + (1 - start) * (i / 16);
    const at = bladePt(tt, p);
    path.push({ x: at.x, y: at.y + at.hw + 1.2, z: 0 });
  }
  quadStrip(pos, uv, idx, path, (i) => 3.0 * k, 0.95);
  return finish(pos, uv, idx, 'glow');
}

function buildSparks(p, t, k) {
  const pos = [], uv = [], idx = [];
  const g = new THREE.OctahedronGeometry(5.2 * k, 0);
  const src = g.attributes.position.array;
  const gid = g.index ? g.index.array : null;
  const start = Math.min(0.8, Math.max(0.05, t));
  for (let n = 0; n < 9; n++) {
    const tt = start + (n / 9) * (1 - start);
    const at = bladePt(tt, p);
    const sx = at.x, sy = at.y + at.hw + 10 * k + Math.sin(n * 1.7) * 12 * k, sz = Math.cos(n * 2.1) * 6 * k;
    const base = pos.length / 3;
    for (let i = 0; i < src.length; i += 3) {
      pos.push(src[i] + sx, src[i + 1] + sy, src[i + 2] + sz);
      uv.push(...uvIn(R_BLADE, 0.95, 0.9));
    }
    if (gid) for (let i = 0; i < gid.length; i++) idx.push(gid[i] + base);
    else for (let i = 0; i < src.length / 3; i++) idx.push(base + i);
  }
  g.dispose();
  return finish(pos, uv, idx, 'sparks');
}

/* 方块位置：给了 px/py/pz 就用绝对坐标（随便放到哪），否则按沿刀 t 推导 */
export function cubePos(p, e) {
  if (e && e.px != null) return { x: e.px, y: e.py || 0, z: e.pz || 0 };
  const t = Math.max(0, Math.min(1.15, e && e.t != null ? e.t : 0.5));
  return {
    x: p.len * t + (e && e.ox ? e.ox : 0),
    y: p.sori * t * t + (e && e.oy ? e.oy : 0),
    z: e && e.oz ? e.oz : 0,
  };
}

/* 自由方块：中心贴在刀身 t 处，可上下偏移、可倾斜，尺寸可调 */
function buildCube(p, t, scale, e) {
  const pos = [], uv = [], idx = [];
  const hx = (e && e.w != null ? e.w : 12) * 0.5 * scale;
  const hy = (e && e.h != null ? e.h : 10) * 0.5 * scale;
  const hz = (e && e.d != null ? e.d : 8) * 0.5 * scale;
  const at = cubePos(p, e && e.px != null ? e : Object.assign({}, e, { t: t }));
  const cx = at.x, cy = at.y, cz = at.z;
  const rot = e && e.rot ? e.rot : 0;
  const c = Math.cos(rot), s = Math.sin(rot);
  const base = pos.length / 3;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * hx, y = sy * hy;
        pos.push(cx + x * c - y * s, cy + x * s + y * c, cz + sz * hz);
      }
    }
  }
  const quads = [
    [0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3],
  ];
  const corners = [[0.52, 0.42], [0.66, 0.42], [0.66, 0.55], [0.52, 0.55]];
  for (const q of quads) {
    idx.push(base + q[0], base + q[1], base + q[3], base + q[0], base + q[3], base + q[2]);
    for (const cIdx of q) {
      const cc = corners[q.indexOf(cIdx) % 4];
      uv.push(cc[0], cc[1]);
    }
  }
  return finish(pos, uv, idx, 'cube');
}

const BUILDERS = { cube: buildCube, crest: buildCrest, tassel: buildTassel, hanger: buildHanger, glow: buildGlow, sparks: buildSparks };

// extras: [{ type, t, scale }] → { blade: geo|null, effect: geo|null }
export function buildExtras(extras, params) {
  const out = [];
  for (const e of extras || []) {
    const meta = EXTRA_LIST.find((x) => x.type === e.type);
    const fn = BUILDERS[e.type];
    if (!meta || !fn) continue;
    out.push({
      type: e.type,
      target: meta.target,
      color: e.color == null ? meta.color : e.color,
      geo: fn(params, e.t == null ? 0.9 : e.t, e.scale == null ? 1 : e.scale, e),
    });
  }
  return out;
}

export function mergeExtras(list, target) {
  const geos = list.filter((e) => e.target === target).map((e) => e.geo);
  return geos.length ? mergeGeos(geos) : null;
}
