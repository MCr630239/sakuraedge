import * as THREE from './vendor/three.module.js';
import { buildGeometries, DEFAULT_PARAMS, makeTextureCanvas, geomsToObj, mergeGeos, uvIn, finish, R_BLADE, TEX_REGIONS, makeMtl } from './geometry.js';
import { buildExtras, mergeExtras, EXTRA_LIST, cubePos } from './extras.js';

const GROUPS = [
  ['blade', '刀 + 镡 + 柄', 0x8794a8],
  ['sheath', '刀鞘', 0x39424f],
  ['effect', 'SA 发光', 0x62e6d6],
  ['blade_damaged', '损坏的刀', 0x8a97a4],
  ['blade_fragment', '断片', 0x707d8a],
  ['item_blade', '物品栏图标', 0xc9dcef],
  ['item_damaged', '图标（损坏）', 0x9fb2c4],
  ['item_bladens', '图标（NS）', 0x93a6b8],
];

const FIELDS = [
  ['len', '刀身长度', 60, 360, 1],
  ['wid', '刃宽', 4, 18, 0.2],
  ['thick', '刀身厚', 1, 6, 0.1],
  ['sori', '上翘', 0, 110, 1],
  ['taper', '头尾收窄', 0, 0.7, 0.01],
  ['tip', '刀尖收窄', 0, 0.9, 0.01],
  ['seg', '分段', 8, 40, 1],
  ['hlen', '柄长', 40, 170, 1],
  ['hr0', '柄首半径', 1.6, 6, 0.1],
  ['hr1', '柄尾半径', 1.6, 6, 0.1],
  ['gry', '镡纵向半径', 4, 16, 0.1],
  ['grz', '镡横向半径', 3, 16, 0.1],
  ['gthick', '镡厚', 1, 6, 0.1],
  ['spad', '鞘壁余量', 0.5, 4, 0.1],
  ['slen', '鞘长占比', 0.4, 1.12, 0.01],
  ['gshape', '镡形状', 0, 3, 1],
  ['hsides', '柄棱数', 6, 12, 1],
  ['wrapCount', '缠绳圈数', 1, 12, 1],
  ['sscale', '鞘粗细', 0.6, 1.6, 0.01],
  ['sshape', '鞘截面', 0, 3, 1],
];

// 参数按部件分组显示，关掉哪件就把它那组灰掉
const FIELD_GROUPS = [
  ['刀身', 'bladeOn', ['len', 'wid', 'thick', 'sori', 'taper', 'tip', 'seg']],
  ['镡', 'guardOn', ['gry', 'grz', 'gthick', 'gshape']],
  ['柄', 'handleOn', ['hlen', 'hr0', 'hr1', 'hsides', 'wrapCount']],
  ['鞘', null, ['spad', 'slen', 'sscale', 'sshape']],
];

// 每件用哪块贴图区（改图时点部件名就能只亮这一块）
const PART_REGION = {
  bladeOn: 'blade', grooveOn: 'blade',
  guardOn: 'guard',
  handleOn: 'handle', pommelOn: 'handle', fuchiOn: 'handle', wrapOn: 'handle',
  koiguchiOn: 'sheath', kojiriOn: 'sheath',
};
const REGION_CN = { blade: '刃 / 刀身', handle: '柄', guard: '镡', sheath: '鞘' };
let partFocus = null;

function drawTexOverlay() {
  const cv = document.getElementById('texOverlay');
  if (!cv) return;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  const el = document.getElementById('texFocus');
  if (!partFocus) {
    if (el) el.textContent = '点部件名可高亮它的贴图区';
    return;
    }
  const reg = PART_REGION[partFocus];
  const r = reg ? TEX_REGIONS[reg] : null;
  if (!r) return;
  const [x1, y1, x2, y2] = r;
  c.fillStyle = 'rgba(6,8,12,0.74)';
  c.fillRect(0, 0, cv.width, cv.height);
  c.clearRect(x1, y1, x2 - x1, y2 - y1);
  c.fillStyle = 'rgba(236,72,153,0.16)';
  c.fillRect(x1, y1, x2 - x1, y2 - y1);
  c.strokeStyle = '#ec4899';
  c.lineWidth = 2;
  c.strokeRect(x1 + 1, y1 + 1, x2 - x1 - 2, y2 - y1 - 2);
  if (el) el.textContent = '正在编辑：' + (REGION_CN[reg] || reg) + ' 区（' + x1 + ',' + y1 + '）–（' + x2 + ',' + y2 + '）';
}

const SELECTS = {
  gshape: [['椭圆', 0], ['正圆', 1], ['方', 2], ['十字', 3]],
  hsides: [['六角', 6], ['八角', 8], ['十角', 10], ['十二角', 12]],
  sshape: [['八棱（默认）', 0], ['圆鞘', 1], ['六角鞘', 2], ['方鞘', 3]],
};

// 部件表：勾上就生成几何，取消就真的不做这一件
const PARTS = [
  ['bladeOn', '刀身', '刃本体，取消后只剩镡与柄'],
  ['guardOn', '镡', '护手圆盘，取消即无镡'],
  ['handleOn', '柄', '握柄本体'],
  ['pommelOn', '柄头', '柄末端金属盘（新增件）'],
  ['fuchiOn', '柄口', '柄与镡之间的金属环（新增件）'],
  ['grooveOn', '血槽', '刃面中线凹槽（新增件）'],
  ['wrapOn', '柄卷', '柄上缠绕的绳圈（新增件）'],
  ['koiguchiOn', '鞘口环', '鞘入口的金属环（新增件）'],
  ['kojiriOn', '鞘尾', '鞘末端的金属件（新增件）'],
];

const PRESETS = {
  standard: { label: '标准太刀', desc: '253 · 弯 22', params: { len: 253, wid: 10.2, thick: 3, sori: 22, taper: 0.35, tip: 0.42, seg: 26, hlen: 93 } },
  long: { label: '长太刀', desc: '320 · 弯 26', params: { len: 320, wid: 10.5, thick: 3, sori: 26, taper: 0.24, tip: 0.34, seg: 30, hlen: 96 } },
  short: { label: '短刀', desc: '168 · 弯 12', params: { len: 168, wid: 12, thick: 3.2, sori: 12, taper: 0.3, tip: 0.38, seg: 22, hlen: 74 } },
  curve: { label: '大弯刀', desc: '320 · 弯 96', params: { len: 320, wid: 10.5, thick: 3, sori: 96, taper: 0.24, tip: 0.34, seg: 30, hlen: 96 } },
  tang: { label: '唐刀（直刃）', desc: '253 · 弯 0', params: { len: 253, wid: 11, thick: 3.2, sori: 0, taper: 0.18, tip: 0.28, seg: 24, hlen: 88 } },
  claw: { label: '裂爪匕', desc: '180 · 深弯', params: { len: 180, wid: 9, thick: 3, sori: 62, taper: 0.3, tip: 0.5, seg: 22, hlen: 74 } },
  greatsword: { label: '巨剑', desc: '420 · 阔刃', params: { len: 420, wid: 17, thick: 4.4, sori: 12, taper: 0.12, tip: 0.3, seg: 34, hlen: 120 } },
  zweihand: { label: '双刃剑', desc: '230 · 双面刃', params: { len: 230, wid: 9.5, thick: 3.4, sori: 4, taper: 0.22, tip: 0.4, seg: 26, hlen: 104, edge: 1 } },
  odachi: { label: '斩马刀', desc: '340 · 宽刃', params: { len: 340, wid: 13, thick: 3.6, sori: 30, taper: 0.2, tip: 0.32, seg: 32, hlen: 112 } },
};

const DEFAULT_ALL = Object.assign({}, DEFAULT_PARAMS, { thick: 3, hr0: 4.2, hr1: 3.5, gry: 11, grz: 7.4 });

const doc = {
  name: '无名刀',
  extras: [],
  params: Object.assign({}, DEFAULT_ALL),
  visible: { blade: true, sheath: false, effect: true, blade_damaged: false, blade_fragment: false, item_blade: false, item_damaged: false, item_bladens: false },
  selected: 'blade',
};

const $ = (id) => document.getElementById(id);

// ---------- three ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x0b0d10, 1);
renderer.shadowMap.enabled = false;

/* GPU 信息：状态栏显示，软件渲染时自动关阴影，避免某些驱动上整片发黑 */
let gpuTag = '';
let softGL = false;
try {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const raw = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || ''));
  gpuTag = raw.replace(/ANGLE\s*\(|Direct3D11|vs_5_0|ps_5_0|\)|,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 42);
  softGL = /swiftshader|llvmpipe|software|basic render|warp/i.test(raw);
} catch (_) {}
if (softGL) renderer.shadowMap.enabled = false;
if (renderer.debug) {
  renderer.debug.onShaderError = function () {
    try { msg('着色器编译失败（显卡驱动兼容问题），可在「视图」菜单开兼容模式'); } catch (_) {}
  };
}

const scene = new THREE.Scene();
const root = new THREE.Group();
const refGroup = new THREE.Group();
scene.add(root, refGroup);

const cam = new THREE.PerspectiveCamera(32, 1, 1, 8000);
let camTheta = -0.55, camPhi = 1.22, camDist = 690;
const camTarget = new THREE.Vector3(88, 16, 0);

scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x171b24, 1.05));
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.position.set(300, 320, 260);
key.castShadow = false;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -320;
key.shadow.camera.right = 320;
key.shadow.camera.top = 220;
key.shadow.camera.bottom = -160;
key.shadow.camera.far = 1400;
scene.add(key);
const fill = new THREE.DirectionalLight(0x9fd0ff, 0.6);
fill.position.set(-260, 60, 260);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffe6cc, 0.22);
rim.position.set(-80, -220, -300);
scene.add(rim);

const grid = new THREE.GridHelper(300, 15, 0x1d2632, 0x151b23);
grid.position.y = -6;
scene.add(grid);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.4 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -5.9;
floor.receiveShadow = true;
scene.add(floor);

const texCanvas = makeTextureCanvas();
const defaultTexCanvas = makeTextureCanvas();
const tex = new THREE.CanvasTexture(texCanvas);
tex.colorSpace = THREE.SRGBColorSpace;
tex.magFilter = THREE.LinearFilter;
tex.minFilter = THREE.LinearFilter;
tex.generateMipmaps = false;
tex.anisotropy = 1;

const meshes = {};
const mats = {};
let compatMode = false;
let litMode = false;   // false = 基础材质（不依赖任何光照，最保险）

/* 参数兜底：任何一项变成 NaN/Infinity 都会让整个几何失效、整把刀消失 */
function sanitizeParams() {
  for (const k of Object.keys(doc.params)) {
    const v = doc.params[k];
    if (typeof v === 'number' && !Number.isFinite(v)) {
      doc.params[k] = (DEFAULT_ALL[k] !== undefined ? DEFAULT_ALL[k] : 0);
    }
  }
}

function matFor(name, color) {
  if (mats[name]) return mats[name];
  let m;
  if (name === 'effect') {
    m = new THREE.MeshBasicMaterial({ color: 0x62e6d6, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  } else if (compatMode) {
    m = new THREE.MeshBasicMaterial({ color: 0xa9c4dd, side: THREE.DoubleSide });
  } else if (litMode) {
    m = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff, emissive: 0x3a4757, side: THREE.DoubleSide });
  } else {
    m = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, side: THREE.DoubleSide });
  }
  mats[name] = m;
  return m;
}

let wire = false;
function applyWire() {
  for (const k of Object.keys(mats)) mats[k].wireframe = wire;
}

let selLine = null;
function paintSelection() {
  if (selLine) { root.remove(selLine); selLine.geometry.dispose(); selLine.material.dispose(); selLine = null; }
  const m = meshes[doc.selected];
  if (!m || !m.visible) return;
  const e = new THREE.EdgesGeometry(m.geometry, 32);
  selLine = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0x74d3c8, transparent: true, opacity: 0.32 }));
  root.add(selLine);
}

function clearMeshes() {
  for (const k of Object.keys(meshes)) { root.remove(meshes[k]); meshes[k].geometry.dispose(); delete meshes[k]; }
}

const exMats = {};
function extraMat(color, glow) {
  const key = color + (glow ? 'g' : '');
  if (!exMats[key]) {
    exMats[key] = glow
      ? new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
      : new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.3, side: THREE.DoubleSide });
  }
  return exMats[key];
}

let exMeshes = [];
function clearExtras() {
  for (const m of exMeshes) { root.remove(m); m.geometry.dispose(); }
  exMeshes = [];
}

function rebuild(opts) {
  const keepExtras = opts && opts.keepExtrasUI;
  sanitizeParams();
  clearMeshes();
  clearExtras();
  const list = buildGeometries(doc.params);
  for (const item of list) {
    const name = item[0], geo = item[1];
    const color = (GROUPS.find((g) => g[0] === name) || [name, '', 0x93a3b8])[2];
    const mesh = new THREE.Mesh(geo, matFor(name, color));
    mesh.name = name;
    mesh.visible = doc.visible[name] !== false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    root.add(mesh);
    meshes[name] = mesh;
  }
  const exList = buildExtras(doc.extras, doc.params);
  for (const e of exList) {
    const mesh = new THREE.Mesh(e.geo, extraMat(e.color, e.target === 'effect'));
    mesh.name = 'extra:' + e.type;
    mesh.castShadow = false;
    root.add(mesh);
    exMeshes.push(mesh);
  }
  for (const e of doc.extras) {
    if (e.type !== 'import') continue;
    const g = importCache.get(e.file);
    if (!g) continue;
    const mesh = new THREE.Mesh(placeImport(e, g), extraMat(e.color == null ? 0x9fd7ff : e.color, (e.slot || 'blade') === 'effect'));
    mesh.name = 'extra:import';
    root.add(mesh);
    exMeshes.push(mesh);
  }
  applyWire();
  paintSelection();
  if (!keepExtras) renderExtras();
  renderTree();
  renderInfo();
  drawTex();
  updateStatus();
  updateHandles();
  draw();
  checkViewSoon();
}

// ---------- 外部元素（OBJ 导入挂件）----------
const importCache = new Map(); // 文件路径 → 归一化几何
const IMPORT_SIZE = 30;        // 归一化后的最大边长（编辑器单位）

function geoFromObj(text) {
  const v = [];
  const pos = [], uv = [], idx = [];
  const toks = text.split(/\r?\n/);
  for (const ln of toks) {
    if (ln[0] === 'v' && ln[1] === ' ') {
      const p = ln.trim().split(/\s+/);
      v.push(+p[1], +p[2], +p[3]);
    }
  }
  for (const ln of toks) {
    if (ln[0] === 'f' && ln[1] === ' ') {
      const parts = ln.trim().split(/\s+/).slice(1);
      const ids = parts.map((tk) => {
        const n = parseInt(tk.split('/')[0], 10);
        if (!Number.isFinite(n)) return -1;
        return n < 0 ? v.length / 3 + n : n - 1;
      }).filter((n) => n >= 0 && n < v.length / 3);
      for (let i = 1; i + 1 < ids.length; i++) idx.push(ids[0], ids[i], ids[i + 1]);
    }
  }
  const nv = v.length / 3;
  if (!nv || !idx.length) return null;
  let minx = 1e9, miny = 1e9, minz = 1e9, maxx = -1e9, maxy = -1e9, maxz = -1e9;
  for (let i = 0; i < nv; i++) {
    const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
    if (z < minz) minz = z; if (z > maxz) maxz = z;
  }
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, cz = (minz + maxz) / 2;
  const dim = Math.max(maxx - minx, maxy - miny, maxz - minz) || 1;
  const k = IMPORT_SIZE / dim;
  for (let i = 0; i < nv; i++) {
    pos.push((v[i * 3] - cx) * k, (v[i * 3 + 1] - cy) * k, (v[i * 3 + 2] - cz) * k);
    uv.push(...uvIn(R_BLADE, 0.95, 0.5));
  }
  return finish(pos, uv, idx, 'import');
}

function bladeAtT(t) {
  const p = doc.params;
  const tt = Math.max(0, Math.min(1, t));
  return { x: p.len * tt, y: p.sori * tt * tt };
}

function placeImport(e, geo) {
  const at = bladeAtT(e.t);
  const k = e.scale == null ? 1 : e.scale;
  const m = new THREE.Matrix4().makeTranslation(at.x, at.y + (e.yOff || 0), 0)
    .multiply(new THREE.Matrix4().makeScale(k, k, k));
  return geo.clone().applyMatrix4(m);
}

function importGeos(target) {
  const out = [];
  for (const e of doc.extras) {
    if (e.type !== 'import' || (e.slot || 'blade') !== target) continue;
    const g = importCache.get(e.file);
    if (g) out.push(placeImport(e, g));
  }
  return out;
}

function exportList() {
  const base = buildGeometries(doc.params);
  const ex = buildExtras(doc.extras, doc.params);
  return base.map((it) => {
    if (it[0] === 'blade' || it[0] === 'effect') {
      const parts = [it[1]];
      const m = mergeExtras(ex, it[0]);
      if (m) parts.push(m);
      for (const g of importGeos(it[0])) parts.push(g);
      return [it[0], parts.length > 1 ? mergeGeos(parts) : it[1]];
    }
    return it;
  });
}

function renderTree() {
  const el = $('tree');
  el.innerHTML = GROUPS.map((g) => {
    const k = g[0], odd = g[1], color = g[2];
    const m = meshes[k];
    const tri = m && m.geometry.index ? Math.round(m.geometry.index.count / 3) : 0;
    return '<div class="grp' + (k === doc.selected ? ' on' : '') + (doc.visible[k] === false ? ' off' : '')
      + '" data-grp="' + k + '" title="' + odd + '">'
      + '<span class="eye">' + (doc.visible[k] === false ? '◌' : '●') + '</span>'
      + '<span class="sw" style="background:#' + color.toString(16).padStart(6, '0') + '"></span>'
      + '<span class="nm">' + k + '</span><span class="ct">' + tri + '</span></div>';
  }).join('');
}

function fieldRow(k) {
  const f = FIELDS.find((x) => x[0] === k);
  if (!f) return '';
  const label = f[1];
  if (SELECTS[k]) {
    const cur = Number(doc.params[k]);
    return '<div class="frow"><span>' + label + '</span>'
      + '<select data-sel="' + k + '">'
      + SELECTS[k].map(([n, v]) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + n + '</option>').join('')
      + '</select></div>';
  }
  const min = f[2], max = f[3], step = f[4];
  return '<div class="frow"><span>' + label + '</span>'
    + '<input type="range" data-p="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + doc.params[k] + '" />'
    + '<span class="val" data-v="' + k + '">' + doc.params[k] + '</span></div>';
}

function renderFields() {
  $('fields').innerHTML = FIELD_GROUPS.map(([title, flag, keys]) => {
    const off = flag && doc.params[flag] === false;
    return '<div class="fgroup' + (off ? ' off' : '') + '" data-group="' + title + '">'
      + '<div class="fgtitle">' + title + '</div>'
      + keys.map(fieldRow).join('') + '</div>';
  }).join('');
}

function renderParts() {
  const el = $('parts');
  if (!el) return;
  const onCount = PARTS.filter((x) => doc.params[x[0]] !== false).length;
  el.innerHTML = PARTS.map(([k, label, desc]) => {
    const on = doc.params[k] !== false;
    return '<label class="prow' + (on ? ' on' : '') + '" title="' + desc + '">'
      + '<input type="checkbox" data-part="' + k + '"' + (on ? ' checked' : '') + ' />'
      + '<span class="pn">' + label + '</span>'
      + '<span class="pd">' + desc + '</span></label>';
  }).join('') + '<div class="pnote">已启用 ' + onCount + ' / ' + PARTS.length + ' 件 · 取消勾选＝这件不生成几何</div>';
}

function syncFields() {
  for (const [k, v] of Object.entries(SELECTS)) {
    const sel = document.querySelector('select[data-sel="' + k + '"]');
    if (sel) sel.value = String(doc.params[k]);
    void v;
  }
  for (const [title, flag] of FIELD_GROUPS) {
    const g = document.querySelector('.fgroup[data-group="' + title + '"]');
    if (g) g.classList.toggle('off', !!(flag && doc.params[flag] === false));
  }
  for (const [k] of PARTS) {
    const cb = document.querySelector('input[data-part="' + k + '"]');
    if (cb) cb.checked = doc.params[k] !== false;
  }
  const el = $('parts');
  if (el) {
    for (const row of el.querySelectorAll('.prow')) {
      const cb = row.querySelector('input[data-part]');
      if (cb) row.classList.toggle('on', cb.checked);
    }
  }
  for (const f of FIELDS) {
    const k = f[0];
    const inp = document.querySelector('input[data-p="' + k + '"]');
    if (inp) inp.value = doc.params[k];
    const v = document.querySelector('[data-v="' + k + '"]');
    if (v) v.textContent = doc.params[k];
  }
}

function renderInfo() {
  let v = 0, t = 0, n = 0;
  for (const g of GROUPS) {
    const m = meshes[g[0]];
    if (!m) continue;
    n++;
    v += m.geometry.attributes.position.count;
    t += m.geometry.index ? m.geometry.index.count / 3 : 0;
  }
  $('info').innerHTML = [
    ['分组', n + ' / 8'],
    ['顶点', v],
    ['三角面', Math.round(t)],
    ['刀身', doc.params.len + ' 单位'],
    ['总长', Math.round(doc.params.len + doc.params.hlen) + ' / 377'],
    ['贴图', '128 × 256'],
  ].map((r) => '<div class="kv"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  $('stStats').textContent = v + ' 顶点 / ' + Math.round(t) + ' 面' + (gpuTag ? ' · ' + gpuTag + (softGL ? '（软件渲染）' : '') : '');
}

function drawTex() {
  const dst = $('tex');
  if (!dst) return;
  dst.src = texCanvas.toDataURL('image/png');
  drawTexOverlay();
  tex.needsUpdate = true;
}

let texLive = tex;
function refreshTex() {
  const t = new THREE.CanvasTexture(texCanvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.anisotropy = 1;
  const old = texLive;
  texLive = t;
  for (const k of Object.keys(mats)) {
    const m = mats[k];
    if (m && m.map) {
      m.map = t;
      if (m.emissiveMap) m.emissiveMap = t;
      m.needsUpdate = true;
    }
  }
  if (old && old !== t) old.dispose();
}

// ---------- 贴图手绘 ----------
const paint = { color: '#59e0d4', size: 10, eraser: false, down: false, last: null };
const SWATCHES = ['#59e0d4', '#c8f8f2', '#39424c', '#0f1114', '#d8b46a', '#c0392b', '#f2f4f6', '#000000'];

function texPoint(ev) {
  const dst = $('tex');
  const r = dst.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / Math.max(1, r.width)) * 128,
    y: ((ev.clientY - r.top) / Math.max(1, r.height)) * 256,
  };
}

function paintAtUV(u, v, color, size) {
  const c = texCanvas.getContext('2d');
  c.fillStyle = color;
  c.beginPath();
  c.arc(u * 128, (1 - v) * 256, size / 2, 0, Math.PI * 2);
  c.fill();
  refreshTex();
  drawTex();
  draw();
}

function paintDot(pt) {
  const c = texCanvas.getContext('2d');
  const r = paint.size / 2;
  if (paint.eraser) {
    c.save();
    c.beginPath(); c.arc(pt.x, pt.y, r, 0, Math.PI * 2); c.clip();
    c.drawImage(defaultTexCanvas, 0, 0);
    c.restore();
  } else {
    c.fillStyle = paint.color;
    c.beginPath(); c.arc(pt.x, pt.y, r, 0, Math.PI * 2); c.fill();
  }
  tex.needsUpdate = true;
}

function paintStroke(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 1.5));
  for (let i = 0; i <= n; i++) paintDot({ x: from.x + (dx * i) / n, y: from.y + (dy * i) / n });
}

function buildSwatches() {
  const el = $('swatches');
  if (!el) return;
  el.innerHTML = SWATCHES.map((c) => '<span class="sw' + (c === paint.color ? ' on' : '') + '" data-col="' + c + '" style="background:' + c + '"></span>').join('');
}

function bindPaint() {
  const dst = $('tex');
  if (!dst) return;
  dst.addEventListener('pointerdown', (ev) => {
    paint.down = true;
    paint.last = texPoint(ev);
    dst.setPointerCapture(ev.pointerId);
    paintDot(paint.last);
    drawTex();
    draw();
  });
  dst.addEventListener('pointermove', (ev) => {
    if (!paint.down) return;
    const pt = texPoint(ev);
    paintStroke(paint.last, pt);
    paint.last = pt;
    drawTex();
    draw();
  });
  const up = () => {
    if (!paint.down) return;
    paint.down = false;
    paint.last = null;
    refreshTex();
    rebuild();
  };
  dst.addEventListener('pointerup', up);
  dst.addEventListener('pointercancel', up);
  dst.addEventListener('pointerleave', up);

  buildSwatches();
  $('swatches').addEventListener('click', (ev) => {
    const sw = ev.target.closest('[data-col]');
    if (!sw) return;
    paint.color = sw.dataset.col;
    paint.eraser = false;
    $('eraser').classList.remove('on');
    buildSwatches();
  });
  $('brush').addEventListener('input', (ev) => {
  paint.size = Number(ev.target.value);
  const bv = $('brushVal');
  if (bv) bv.textContent = ev.target.value;
});
  $('eraser').addEventListener('click', () => {
    paint.eraser = !paint.eraser;
    $('eraser').classList.toggle('on', paint.eraser);
  });
  $('texReset').addEventListener('click', () => {
    const c = texCanvas.getContext('2d');
    c.clearRect(0, 0, 128, 256);
    c.drawImage(defaultTexCanvas, 0, 0);
    tex.needsUpdate = true;
    drawTex();
    draw();
    msg('贴图已恢复到默认');
  });
}

bindPaint();

function updateStatus() {
  $('stName').textContent = doc.name;
  $('stSel').textContent = '选中：' + doc.selected;
}

function resize() {
  const host = canvas.parentElement;
  const w = host.clientWidth || 1, h = host.clientHeight || 1;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  draw();
}

function autoFrame() {
  const p = doc.params;
  camTarget.x = (p.len - p.hlen) * 0.5;
  camTarget.y = p.sori * 0.35 + 8;
  camDist = Math.max(680, (p.len + p.hlen) * 1.85);
  updateCamera();
  draw();
}

/* 视口平移：沿相机右向量/上向量移动观察中心（中键、右键、Shift+左键拖动） */
function panBy(dx, dy, dz) {
  const right = new THREE.Vector3();
  const upv = new THREE.Vector3();
  cam.matrixWorld.extractBasis(right, upv, new THREE.Vector3());
  const k = camDist * 0.0016;
  camTarget.addScaledVector(right, dx * k);
  camTarget.addScaledVector(upv, dy * k);
  if (dz) camTarget.y += dz * camDist * 0.06;
  const p = doc.params, lim = Math.max(300, (p.len + p.hlen) * 1.6);
  camTarget.x = Math.max(-lim, Math.min(lim * 2, camTarget.x));
  camTarget.y = Math.max(-lim, Math.min(lim, camTarget.y));
  camTarget.z = Math.max(-lim, Math.min(lim, camTarget.z));
  updateCamera(); draw();
}

function updateCamera() {
  const sp = Math.sin(camPhi), cp = Math.cos(camPhi);
  cam.position.set(
    camTarget.x + camDist * sp * Math.sin(camTheta),
    camTarget.y + camDist * cp,
    camTarget.z + camDist * sp * Math.cos(camTheta),
  );
  cam.lookAt(camTarget);
}

function draw() { renderer.render(scene, cam); }

/* 模型是否还在画面里：不在就提示「居中」，免得以为模型丢了 */
const _frustum = new THREE.Frustum();
const _projM = new THREE.Matrix4();
const _bbox = new THREE.Box3();
function modelInView() {
  if (!root.children.length) return true;
  cam.updateMatrixWorld();
  _projM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_projM);
  _bbox.setFromObject(root);
  if (_bbox.isEmpty()) return true;
  return _frustum.intersectsBox(_bbox);
}
let viewChkTimer = 0;
function checkViewSoon() {
  clearTimeout(viewChkTimer);
  viewChkTimer = setTimeout(() => {
    if (!modelInView()) msg('模型不在视野内 —— 点视图栏的「居中」或按 Home 键');
  }, 220);
}

// ---------- 原版基准 ----------
const REF = { len: 253, wid: 10, sori: 22, hlen: 93 };
function buildRef() {
  const mkLine = (pts, color, op) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthTest: false }));
    ln.renderOrder = 6;
    return ln;
  };
  const up = [], dn = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const x = REF.len * t, y = REF.sori * t * t, hw = REF.wid / 2 * (1 - 0.35 * t);
    up.push(new THREE.Vector3(x, y + hw, 0));
    dn.push(new THREE.Vector3(x, y - hw, 0));
  }
  refGroup.add(
    mkLine(up, 0x3fd8ca, 0.75),
    mkLine(dn, 0x3fd8ca, 0.75),
    mkLine([new THREE.Vector3(-REF.hlen, 0, 0), new THREE.Vector3(0, 0, 0)], 0x6a7c92, 0.7),
  );
  refGroup.visible = false;
}

// ---------- 视口手柄（直接拖形状，不用滑杆） ----------
const handleGroup = new THREE.Group();
scene.add(handleGroup);
const hMat = new THREE.MeshBasicMaterial({ color: 0xffc352, transparent: true, opacity: 0.92 });
const handleObjs = {};
const HANDLE_DEFS = [
  ['tip', 6.5, '刀尖：左右＝刀身长度，上下＝上翘'],
  ['mid', 6, '刀身中部：上下＝整体弯曲'],
  ['guard', 6, '镡：上下＝镡半径'],
  ['hend', 6, '柄尾：左右＝柄长'],
];
for (const d of HANDLE_DEFS) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(d[1], 14, 10), hMat);
  m.userData.key = d[0];
  m.userData.tip = d[2];
  handleGroup.add(m);
  handleObjs[d[0]] = m;
}

const cubeHandleMat = new THREE.MeshBasicMaterial({ color: 0x6fe8da, transparent: true, opacity: 0.95 });
const cubeHandles = [];
function setCubeAxis(i, axis, v) {
  const e = doc.extras[i];
  if (!e || e.type !== 'cube') return;
  if (e.px == null) {
    const pos = cubePos(doc.params, e);
    e.px = pos.x; e.py = pos.y; e.pz = pos.z;
  }
  if (axis === 0) e.px = v;
  else if (axis === 1) e.py = v;
  else e.pz = v;
}

function layoutCubeHandles(p) {
  const cubes = [];
  doc.extras.forEach((e, i) => { if (e.type === 'cube') cubes.push({ e: e, i: i }); });
  while (cubeHandles.length < cubes.length) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(5.2, 12, 9), cubeHandleMat);
    m.userData.key = 'cube';
    m.userData.tip = '方块：拖动＝沿刀移动 / 上下偏移';
    handleGroup.add(m);
    cubeHandles.push(m);
  }
  cubeHandles.forEach((m, k) => {
    if (k >= cubes.length) { m.visible = false; return; }
    const e = cubes[k].e;
    const at = cubePos(p, e);
    m.userData.idx = cubes[k].i;
    m.visible = handleGroup.visible !== false;
    m.position.set(at.x, at.y, at.z + ((e.d || 8) * 0.5 * (e.scale || 1)) + 4);
  });
}

function syncExtraSliders() {
  doc.extras.forEach((e, i) => {
    if (e.type !== 'cube') return;
    const at = cubePos(doc.params, e);
    [['epx', at.x], ['epy', at.y], ['epz', at.z]].forEach(([k, v]) => {
      const el = document.querySelector('[data-' + k + '="' + i + '"]');
      if (el) el.value = String(Math.round(v));
    });
  });
}

function updateHandles() {
  const p = doc.params;
  handleObjs.tip.visible = p.bladeOn !== false;
  handleObjs.mid.visible = p.bladeOn !== false;
  handleObjs.guard.visible = p.guardOn !== false;
  handleObjs.hend.visible = p.handleOn !== false;
  handleObjs.tip.position.set(p.len, p.sori, 8);
  handleObjs.mid.position.set(p.len * 0.5, p.sori * 0.25 + 4, 8);
  handleObjs.guard.position.set(0.9, p.gry, 8);
  handleObjs.hend.position.set(-p.hlen, 0, 8);
  layoutCubeHandles(p);
}

// ---------- 交互 ----------
let drag = null;
const pickRay = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -8);

function ndcOf(ev) {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((ev.clientX - r.left) / r.width) * 2 - 1,
    -((ev.clientY - r.top) / r.height) * 2 + 1,
  );
}

canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

canvas.addEventListener('pointerdown', function (ev) {
  canvas.setPointerCapture(ev.pointerId);
  const wantPan = ev.button === 1 || ev.button === 2 || (ev.button === 0 && ev.shiftKey);
  if (wantPan) {
    drag = { mode: 'pan', x: ev.clientX, y: ev.clientY };
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (ev.button !== 0) { drag = null; return; }
  pickRay.setFromCamera(ndcOf(ev), cam);
  const hit = handleGroup.visible ? pickRay.intersectObjects(handleGroup.children, false)[0] : null;
  if (hit) {
    drag = { mode: 'handle', key: hit.object.userData.key, idx: hit.object.userData.idx, tip: hit.object.userData.tip };
    msg(drag.tip);
    return;
  }
  drag = { mode: 'view', x: ev.clientX, y: ev.clientY, theta: camTheta, phi: camPhi, moved: 0 };
});

canvas.addEventListener('pointermove', function (ev) {
  if (!drag) return;
  if (drag.mode === 'pan') {
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.x = ev.clientX; drag.y = ev.clientY;
    panBy(-dx, dy, 0);
    return;
  }
  if (drag.mode === 'view') {
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    camTheta = drag.theta - dx * 0.006;
    camPhi = Math.min(Math.PI - 0.05, Math.max(0.05, drag.phi - dy * 0.006));
    if (drag.moved > 8) setViewLabel('自由视角');
    updateCamera(); draw();
    return;
  }
  pickRay.setFromCamera(ndcOf(ev), cam);
  const p = new THREE.Vector3();
  if (!pickRay.ray.intersectPlane(dragPlane, p)) return;
  const pa = doc.params;
  if (drag.key === 'cube') {
    const e = doc.extras[drag.idx];
    if (!e) return;
    if (e.px == null) { const at = cubePos(pa, e); e.px = at.x; e.py = at.y; e.pz = at.z; }
    e.px = Math.round(p.x);
    e.py = Math.round(p.y);
    syncExtraSliders();
    rebuild({ keepExtrasUI: true });
    histPush(false);
    return;
  }
  if (drag.key === 'tip') {
    pa.len = Math.min(360, Math.max(60, Math.round(p.x)));
    pa.sori = Math.min(110, Math.max(0, Math.round(p.y)));
  } else if (drag.key === 'mid') {
    pa.sori = Math.min(110, Math.max(0, Math.round((p.y - 4) * 4)));
  } else if (drag.key === 'guard') {
    pa.gry = Math.min(16, Math.max(4, Math.round(Math.abs(p.y) * 10) / 10));
    pa.grz = Math.min(16, Math.max(3, Math.round(Math.abs(p.y) * 6.7) / 10));
  } else if (drag.key === 'hend') {
    pa.hlen = Math.min(170, Math.max(40, Math.round(-p.x)));
  }
  syncFields();
  rebuild();
  histPush(false);
});

canvas.addEventListener('pointerup', function (ev) {
  canvas.style.cursor = '';
  if (drag && drag.mode === 'handle') { histPush(true); drag = null; return; }
  if (drag && drag.mode === 'view' && drag.moved < 4) {
    pickRay.setFromCamera(ndcOf(ev), cam);
    const hits = pickRay.intersectObjects(root.children, true).filter((h) => h.object && h.object.isMesh && h.object.visible);
    if (hits.length) {
      doc.selected = hits[0].object.name;
      paintSelection(); renderTree(); draw(); updateStatus();
    }
  }
  drag = null;
});

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  camDist = Math.min(2000, Math.max(90, camDist * (1 + Math.sign(ev.deltaY) * 0.12)));
  setZoomLabel();
  updateCamera(); draw();
}, { passive: false });

// 大纲点击 / 显隐
$('tree').addEventListener('click', (ev) => {
  const row = ev.target.closest('.grp');
  if (!row) return;
  const k = row.dataset.grp;
  if (ev.target.classList.contains('eye')) {
    doc.visible[k] = doc.visible[k] === false;
    if (meshes[k]) meshes[k].visible = doc.visible[k] !== false;
    renderTree(); paintSelection(); draw();
    return;
  }
  doc.selected = k;
  if (doc.visible[k] === false) {
    doc.visible[k] = true;
    if (meshes[k]) meshes[k].visible = true;
  }
  renderTree(); paintSelection(); draw(); updateStatus();
});

// 大纲：全部显示
const showAllBtn = $('btnShowAll');
if (showAllBtn) showAllBtn.addEventListener('click', () => {
  for (const g of GROUPS) {
    doc.visible[g[0]] = true;
    if (meshes[g[0]]) meshes[g[0]].visible = true;
  }
  renderTree(); paintSelection(); draw(); updateStatus();
});

// 参数滑杆
$('fields').addEventListener('input', (ev) => {
  const inp = ev.target.closest('input[data-p]');
  if (!inp) return;
  const k = inp.dataset.p;
  doc.params[k] = Number(inp.value);
  const v = document.querySelector('[data-v="' + k + '"]');
  if (v) v.textContent = inp.value;
  rebuild();
  histPush(false);   // 拖动滑杆时防抖记录，松手后才落一步
});

// 下拉参数（镡形状 / 柄棱数）
$('fields').addEventListener('change', (ev) => {
  const sel = ev.target.closest('select[data-sel]');
  if (!sel) return;
  doc.params[sel.dataset.sel] = Number(sel.value);
  rebuild();
  histPush(true);
});

// 部件勾选：增删元素
const partsEl = $('parts');
if (partsEl) {
  partsEl.addEventListener('click', (ev) => {
    const row = ev.target.closest('.prow');
    if (!row) return;
    if (ev.target.closest('input[data-part]')) return;   // 点勾选框 = 开关，不当高亮用
    ev.preventDefault();   // 别让外层 label 顺手把勾选框也切了
    const cb = row.querySelector('input[data-part]');
    if (!cb) return;
    partFocus = partFocus === cb.dataset.part ? null : cb.dataset.part;
    drawTexOverlay();
  });
  partsEl.addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[data-part]');
    if (!cb) return;
    const k = cb.dataset.part;
    const others = PARTS.filter((x) => x[0] !== k && doc.params[x[0]] !== false).length;
    if (!cb.checked && others === 0) {
      cb.checked = true;
      toast('至少要留一件部件，刀不能是空的');
      return;
    }
    doc.params[k] = cb.checked;
    renderParts();
    updateHandles();
    syncFields();
    rebuild();
    histPush(true);
  });
}

// 附加件 + 外部元素
function renderExtras() {
  const add = $('addRow');
  if (add) {
    add.innerHTML = EXTRA_LIST.map((e) => '<button data-add="' + e.type + '" title="' + e.desc + '">＋' + e.label + '</button>').join('')
      + '<button data-import="1" title="选一个外部 OBJ 挂到刀上">＋导入元素</button>'
      + '<button data-sesimport="1" title="把樱刃工坊工程里的刀模型与贴图导入，作为参考">＋工坊工程</button>';
  }
  const el = $('extraList');
  if (!el) return;
  if (!doc.extras.length) {
    el.innerHTML = '<div class="extrasempty">还没有附加件。上面的按钮加一件，或用「导入元素」挂自己的 OBJ。</div>';
    return;
  }
  el.innerHTML = doc.extras.map((e, i) => {
    if (e.type === 'import') {
      const name = e.name || String(e.file || '').split(/[\\/]/).pop() || '外部元素';
      const missing = !importCache.get(e.file);
      return '<div class="extrait"><div class="hd"><span class="sw" style="background:#9fd7ff"></span>外部：' + name
        + (missing ? ' <em class="miss">缺失</em>' : '') + '<span class="x" data-del="' + i + '">×</span></div>'
        + '<div class="sl"><span>位置</span><input type="range" data-et="' + i + '" min="0" max="1" step="0.01" value="' + (e.t == null ? 0.55 : e.t) + '" /></div>'
        + '<div class="sl"><span>大小</span><input type="range" data-es="' + i + '" min="0.15" max="3" step="0.05" value="' + (e.scale == null ? 1 : e.scale) + '" /></div>'
        + '<div class="sl"><span>高低</span><input type="range" data-ey="' + i + '" min="-70" max="70" step="1" value="' + (e.yOff == null ? 26 : e.yOff) + '" /></div>'
        + '<div class="sl"><span>分组</span><select data-eslot="' + i + '"><option value="blade"' + ((e.slot || 'blade') === 'blade' ? ' selected' : '')
        + '>blade</option><option value="effect"' + (e.slot === 'effect' ? ' selected' : '') + '>effect</option></select></div></div>';
    }
    if (e.type === 'cube') {
      const c = (e.color == null ? 0x8f979f : e.color).toString(16).padStart(6, '0');
      const pos = cubePos(doc.params, e);
      return '<div class="extrait"><div class="hd"><span class="sw" style="background:#' + c + '"></span>方块'
        + '<span class="x" data-del="' + i + '">×</span></div>'
        + '<div class="sl"><span>X</span><input type="range" data-epx="' + i + '" min="-320" max="420" step="1" value="' + Math.round(pos.x) + '" /></div>'
        + '<div class="sl"><span>Y</span><input type="range" data-epy="' + i + '" min="-160" max="220" step="1" value="' + Math.round(pos.y) + '" /></div>'
        + '<div class="sl"><span>Z</span><input type="range" data-epz="' + i + '" min="-120" max="120" step="1" value="' + Math.round(pos.z) + '" /></div>'
        + '<div class="sl"><span>宽</span><input type="range" data-ew="' + i + '" min="1" max="80" step="0.5" value="' + (e.w == null ? 12 : e.w) + '" /></div>'
        + '<div class="sl"><span>高</span><input type="range" data-eh="' + i + '" min="1" max="80" step="0.5" value="' + (e.h == null ? 10 : e.h) + '" /></div>'
        + '<div class="sl"><span>厚</span><input type="range" data-ed="' + i + '" min="1" max="40" step="0.5" value="' + (e.d == null ? 8 : e.d) + '" /></div>'
        + '<div class="sl"><span>倾斜</span><input type="range" data-ero="' + i + '" min="-1.3" max="1.3" step="0.02" value="' + (e.rot == null ? 0 : e.rot) + '" /></div>'
        + '<div class="sl"><span>分组</span><select data-eslot="' + i + '"><option value="blade"' + ((e.slot || 'blade') === 'blade' ? ' selected' : '')
        + '>blade</option><option value="effect"' + (e.slot === 'effect' ? ' selected' : '') + '>effect</option></select></div></div>';
    }
    const meta = EXTRA_LIST.find((x) => x.type === e.type) || { label: e.type, color: 0x888888 };
    const hex = (meta.color || 0x888888).toString(16).padStart(6, '0');
    return '<div class="extrait"><div class="hd"><span class="sw" style="background:#' + hex + '"></span>' + meta.label
      + '<span class="x" data-del="' + i + '">×</span></div>'
      + '<div class="sl"><span>位置</span><input type="range" data-et="' + i + '" min="0" max="1" step="0.01" value="' + (e.t == null ? 0.9 : e.t) + '" /></div>'
      + '<div class="sl"><span>大小</span><input type="range" data-es="' + i + '" min="0.4" max="2.2" step="0.05" value="' + (e.scale == null ? 1 : e.scale) + '" /></div></div>';
  }).join('');
}

function attachImport(path, text) {
  const geo = geoFromObj(text);
  if (!geo) { msg('这个 OBJ 里没有可用的三角面'); return false; }
  importCache.set(path, geo);
  const name = String(path).split(/[\\/]/).pop();
  doc.extras.push({ type: 'import', file: path, name: name, t: 0.55, scale: 1, yOff: 26, slot: 'blade', color: 0x9fd7ff });
  rebuild();
  histPush(true);
  msg('已挂上 ' + name + '（' + Math.round(geo.attributes.position.count) + ' 顶点）');
  return true;
}

async function addImport() {
  if (!window.api || !window.api.pickObj) { msg('当前环境不能选文件'); return; }
  const r = await window.api.pickObj();
  if (!r) return;
  if (r.error) { msg('读取失败：' + r.error); return; }
  attachImport(r.path, r.text);
}

function loadTexFromUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = texCanvas.getContext('2d');
      c.clearRect(0, 0, 128, 256);
      c.drawImage(img, 0, 0, 128, 256);
      tex.needsUpdate = true;
      drawTex();
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function importSes() {
  if (!window.api || !window.api.openSes) { msg('当前环境不能选文件'); return; }
  const res = await window.api.openSes();
  if (!res) return;
  if (res.error) { msg('工程读取失败：' + res.error); return; }
  const p = res.project || {};
  const b = (p.blades || [])[0];
  if (!b || !b.modelData) { msg('这个工程里没有可用的刀模型'); return; }
  doc.name = b.zh || b.en || b.id || doc.name;
  const tag = res.path + '#' + b.id;
  const geo = geoFromObj(b.modelData);
  if (!geo) { msg('这个工程里的模型解析失败'); return; }
  importCache.set(tag, geo);
  doc.extras.push({ type: 'import', file: tag, name: '工坊·' + (b.id || 'blade'), t: 0, scale: 1, yOff: 8, slot: 'blade', color: 0x5aa9ff });
  rebuild();
  let texOk = false;
  if (String(b.textureData || '').startsWith('data:image/png;base64,')) texOk = await loadTexFromUrl(b.textureData);
  msg('已导入「' + (b.zh || b.id) + '」：模型作为参考挂件，贴图已替换' + (texOk ? '' : '（贴图读取失败）'));
  histPush(true);
  if ($('nameInput')) $('nameInput').value = doc.name;
}

if ($('addRow')) {
  $('addRow').addEventListener('click', (ev) => {
    if (ev.target.closest('[data-sesimport]')) { importSes(); return; }
    if (ev.target.closest('[data-import]')) { addImport(); return; }
    const b = ev.target.closest('[data-add]');
    if (!b) return;
    const meta = EXTRA_LIST.find((x) => x.type === b.dataset.add) || {};
    const seed = { type: b.dataset.add, t: meta.defT == null ? 0.5 : meta.defT, scale: meta.defK == null ? 1 : meta.defK };
    if (b.dataset.add === 'cube') Object.assign(seed, { w: 12, h: 10, d: 8, oy: 6, rot: 0, slot: 'blade' });
    doc.extras.push(seed);
    rebuild();
    histPush(true);
    msg('已加 ' + (EXTRA_LIST.find((x) => x.type === b.dataset.add) || {}).label);
  });
  $('extraList').addEventListener('click', (ev) => {
    const d = ev.target.closest('[data-del]');
    if (!d) return;
    doc.extras.splice(Number(d.dataset.del), 1);
    rebuild();
    histPush(true);
  });
  $('extraList').addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.matches('[data-et]')) doc.extras[Number(t.dataset.et)].t = Number(t.value);
    else if (t.matches('[data-es]')) doc.extras[Number(t.dataset.es)].scale = Number(t.value);
    else if (t.matches('[data-ey]')) doc.extras[Number(t.dataset.ey)].yOff = Number(t.value);
    else if (t.matches('[data-ew]')) doc.extras[Number(t.dataset.ew)].w = Number(t.value);
    else if (t.matches('[data-eh]')) doc.extras[Number(t.dataset.eh)].h = Number(t.value);
    else if (t.matches('[data-ed]')) doc.extras[Number(t.dataset.ed)].d = Number(t.value);
    else if (t.matches('[data-eoy]')) doc.extras[Number(t.dataset.eoy)].oy = Number(t.value);
    else if (t.matches('[data-ero]')) doc.extras[Number(t.dataset.ero)].rot = Number(t.value);
    else if (t.matches('[data-epx]')) setCubeAxis(Number(t.dataset.epx), 0, Number(t.value));
    else if (t.matches('[data-epy]')) setCubeAxis(Number(t.dataset.epy), 1, Number(t.value));
    else if (t.matches('[data-epz]')) setCubeAxis(Number(t.dataset.epz), 2, Number(t.value));
    else return;
    rebuild({ keepExtrasUI: true });
    histPush(false);
  });
  $('extraList').addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-eslot]')) {
      doc.extras[Number(t.dataset.eslot)].slot = t.value;
      rebuild();
      histPush(true);
    }
  });
}

/* ---------------- 撤销 / 重做 ---------------- */
const HIST = { stack: [], idx: -1, lock: false, timer: 0 };
function histSnap() {
  return JSON.stringify({ params: doc.params, extras: doc.extras, name: doc.name });
}
function histApply(str) {
  const o = JSON.parse(str);
  HIST.lock = true;
  doc.params = Object.assign({}, DEFAULT_ALL, o.params);
  doc.extras = o.extras || [];
  doc.name = o.name || doc.name;
  renderFields(); renderParts(); renderExtras(); syncFields(); updateHandles(); rebuild();
  HIST.lock = false;
  histBtn();
}
function histPush(now) {
  if (HIST.lock) return;
  const run = () => {
    const snap = histSnap();
    if (HIST.stack[HIST.idx] === snap) return;
    HIST.stack = HIST.stack.slice(0, HIST.idx + 1);
    HIST.stack.push(snap);
    if (HIST.stack.length > 80) HIST.stack.shift();
    HIST.idx = HIST.stack.length - 1;
    histBtn();
  };
  clearTimeout(HIST.timer);
  if (now) run(); else HIST.timer = setTimeout(run, 450);
}
function histStep(d) {
  const t = HIST.idx + d;
  if (t < 0) { msg('已经是最早一步了'); return; }
  if (t >= HIST.stack.length) { msg('已经是最新一步了'); return; }
  HIST.idx = t;
  histApply(HIST.stack[t]);
  msg(d < 0 ? '已撤销' : '已重做');
}
function histBtn() {
  const u = $('btnUndo'), r = $('btnRedo');
  if (u) u.disabled = HIST.idx <= 0;
  if (r) r.disabled = HIST.idx >= HIST.stack.length - 1;
}
if ($('btnUndo')) $('btnUndo').addEventListener('click', () => histStep(-1));
if ($('btnRedo')) $('btnRedo').addEventListener('click', () => histStep(1));

/* ---------------- 我的预设（存在本机） ---------------- */
const MYPRE_KEY = 'bf.mypresets.v1';
function myPresets() {
  try {
    const v = JSON.parse(localStorage.getItem(MYPRE_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function saveMyPresets(list) {
  try { localStorage.setItem(MYPRE_KEY, JSON.stringify(list)); } catch (e) { /* 存不了就只在本次生效 */ }
}
function applyPreset(params, label) {
  doc.params = Object.assign({}, DEFAULT_ALL, params);
  syncFields(); renderFields(); renderParts(); updateHandles(); rebuild();
  autoFrame();
  histPush(true);
  msg('已套用' + label);
}
function renderPresets() {
  const el = $('presets');
  if (!el) return;
  const mine = myPresets();
  el.innerHTML = Object.keys(PRESETS).map((k) =>
    '<button data-preset="' + k + '">' + PRESETS[k].label + '</button>').join('')
    + mine.map((m, i) => '<button class="mine" data-mine="' + i + '" title="我的预设">' + escapeHtml(m.name)
      + '<span class="mx" data-delmine="' + i + '" title="删除这个预设">×</span></button>').join('')
    + '<button data-preset="reset">重置</button>';
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
renderPresets();
$('presets').addEventListener('click', (ev) => {
  const del = ev.target.closest('[data-delmine]');
  if (del) {
    const i = Number(del.dataset.delmine);
    const list = myPresets();
    const gone = list.splice(i, 1)[0];
    saveMyPresets(list);
    renderPresets();
    msg('已删除预设' + (gone ? '「' + gone.name + '」' : ''));
    return;
  }
  const mine = ev.target.closest('[data-mine]');
  if (mine) {
    const p = myPresets()[Number(mine.dataset.mine)];
    if (!p) return;
    applyPreset(p.params, '「' + p.name + '」');
    return;
  }
  const b = ev.target.closest('[data-preset]');
  if (!b) return;
  const k = b.dataset.preset;
  if (k === 'reset') applyPreset({}, '默认尺寸');
  else applyPreset(PRESETS[k].params, PRESETS[k].label);
});

// 存当前参数为预设
if ($('btnSavePre')) {
  $('btnSavePre').addEventListener('click', () => {
    const name = ($('preName').value || '').trim() || ('我的刀 ' + (myPresets().length + 1));
    const keep = {};
    for (const k of Object.keys(DEFAULT_ALL)) {
      if (k.endsWith('On')) continue;
      keep[k] = doc.params[k];
    }
    const parts = {};
    for (const [k] of PARTS) parts[k] = doc.params[k] !== false;
    const list = myPresets();
    const exist = list.findIndex((x) => x.name === name);
    const item = { name, params: Object.assign({}, keep, parts) };
    if (exist >= 0) list[exist] = item; else list.push(item);
    saveMyPresets(list);
    renderPresets();
    $('preName').value = '';
    msg('预设「' + name + '」已保存（存在本机）');
  });
}

// 视角 / 开关
document.querySelector('.vbar').addEventListener('click', (ev) => {
  const v = ev.target.closest('[data-view]');
  if (v) {
    const k = v.dataset.view;
    if (k === 'frame') {
      autoFrame();
      setViewLabel('透视视图');
      setZoomLabel();
      document.querySelectorAll('.vbar [data-view]').forEach((el) => el.classList.toggle('on', el === v));
      msg('已把模型拉回视野中央');
      return;
    }
    if (k === 'front') { camTheta = 0; camPhi = Math.PI / 2 - 0.04; autoFrame(); setViewLabel('正视图'); setZoomLabel(); }
    if (k === 'side') { camTheta = -1.05; camPhi = 1.24; camDist = 700; }
    if (k === 'top') { camTheta = 0; camPhi = 0.30; camDist = 780; }
    camTarget.set(88, 16, 0);
    document.querySelectorAll('.vbar [data-view]').forEach((el) => el.classList.toggle('on', el === v));
    updateCamera(); draw();
    return;
  }
  const t = ev.target.closest('[data-toggle]');
  if (t) {
    const k = t.dataset.toggle;
    if (k === 'ref') { refGroup.visible = !refGroup.visible; t.classList.toggle('on', refGroup.visible); }
    if (k === 'grid') { grid.visible = !grid.visible; t.classList.toggle('on', grid.visible); }
    if (k === 'wire') { wire = !wire; applyWire(); t.classList.toggle('on', wire); }
    if (k === 'handles') { handleGroup.visible = !handleGroup.visible; t.classList.toggle('on', handleGroup.visible); }
    draw();
  }
});

// 顶部动作
$('btnObj').addEventListener('click', () => {
  const text = geomsToObj(exportList());
  if (window.api) window.api.saveObj(doc.name + '.obj', text);
  msg('已导出 OBJ');
});
$('btnTex').addEventListener('click', () => {
  const url = texCanvas.toDataURL('image/png');
  if (window.api) window.api.savePng(doc.name + '.png', url);
  msg('已导出贴图');
});
const PKG_README = [
  'Blade Forge 导出的资源三件套',
  '',
  'name.obj  —— 8 组模型（组名固定，位置已对齐原版基准）',
  'name.mtl  —— 单材质 blade_tex，指向同目录的 name.png',
  'name.png  —— 128×256 贴图（刃青 / 刀身钢 / 柄缠 / 镡盘 / 鞘）',
  '',
  '放进 Minecraft：',
  '1) name.png  → assets/<你的modid>/textures/',
  '2) name.obj 与 name.mtl → assets/<你的modid>/models/',
  '3) Java 侧加载 obj 时材质名用 blade_tex，贴图指向上面的 png',
  '',
  '8 组：blade / sheath / effect / blade_damaged / blade_fragment',
  '      item_blade / item_damaged / item_bladens',
  '原点在镡，刀尖朝 +X，刃面在 XY 平面，厚度沿 Z。',
].join('\n');

$('btnPkg').addEventListener('click', async () => {
  if (!window.api || !window.api.saveBundle) { msg('当前环境不支持导出文件夹'); return; }
  const obj = geomsToObj(exportList(), doc.name + '.mtl');
  const mtl = makeMtl(doc.name + '.png');
  const png = texCanvas.toDataURL('image/png');
  const dir = await window.api.saveBundle({
    name: doc.name,
    obj: obj,
    mtl: mtl,
    png: png,
    readme: PKG_README.replace(/name/g, doc.name),
  });
  if (dir) msg('资源包已导出到 ' + dir);
});

// ---------- 一键生成附属包 ----------
function slugify(name) {
  const s = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || 'blade';
}

function buildJarEntries(opt) {
  const modid = opt.modid;
  const blade = opt.bladeId;
  const ver = opt.version;
  const base = modid + '_' + blade;
  const objText = geomsToObj(exportList()).replace(/^usemtl .*$/gm, '').replace(/^mtllib .*$/gm, '');
  const png = texCanvas.toDataURL('image/png').split(',')[1];

  const toml = [
    'modLoader="lowcodefml"',
    'loaderVersion="[47,)"',
    'license="All Rights Reserved"',
    '',
    '[[mods]]',
    'modId="' + modid + '"',
    'version="' + ver + '"',
    'displayName="' + opt.modName + '"',
    'authors="Blade Forge"',
    "description='''" + opt.desc + "'''",
    'displayTest="IGNORE_SERVER_VERSION"',
    '',
    '[[dependencies.' + modid + ']]',
    'modId="forge"',
    'mandatory=true',
    'versionRange="[47,)"',
    'ordering="NONE"',
    'side="BOTH"',
    '',
    '[[dependencies.' + modid + ']]',
    'modId="minecraft"',
    'mandatory=true',
    'versionRange="[1.20.1,1.21)"',
    'ordering="NONE"',
    'side="BOTH"',
    '',
    '[[dependencies.' + modid + ']]',
    'modId="slashblade"',
    'mandatory=true',
    'versionRange="[1.9.65,)"',
    'ordering="AFTER"',
    'side="BOTH"',
    '',
  ].join('\n');

  const bladeJson = JSON.stringify({
    name: modid + ':' + blade,
    properties: {
      attack_base: opt.atk,
      max_damage: opt.dur,
      slash_art: 'slashblade:void_slash',
      root_combo: 'slashblade:standby',
    },
    render: {
      model: modid + ':model/named/' + base + '.obj',
      texture: modid + ':model/named/' + base + '.png',
      summon_sword_color: 4292448468,
      carry_type: 'ninja',
    },
    creativeGroup: 'slashblade:slashblade',
  }, null, 2);

  const recipeJson = JSON.stringify({
    type: 'slashblade:shaped_blade',
    blade: modid + ':' + blade,
    category: 'equipment',
    key: {
      B: { type: 'slashblade:blade', item: 'slashblade:slashblade', request: { name: 'slashblade:none' } },
      S: { item: 'slashblade:proudsoul_crystal' },
      C: { item: 'slashblade:proudsoul_trapezohedron' },
    },
    pattern: ['SSS', 'SBS', 'SSC'],
    result: { item: 'slashblade:slashblade' },
    show_notification: true,
  }, null, 2);

  const mcmeta = JSON.stringify({ pack: { pack_format: 15, description: opt.modName } }, null, 2);
  const langZh = JSON.stringify(Object.assign({ 'itemGroup.slashblade': '拔刀剑' }, { ['item.' + modid + '.' + blade]: opt.bladeName }), null, 2);
  const langEn = JSON.stringify({ ['item.' + modid + '.' + blade]: opt.bladeId }, null, 2);

  const readme = [
    opt.modName + ' —— Blade Forge 生成',
    '=====================================',
    '',
    '命名空间: ' + modid,
    '版本: ' + ver,
    '刀: ' + modid + ':' + blade + '（' + opt.bladeName + '）',
    '本包只含模型与贴图；SA / SE / 剑型 / 附魔请在 Sakura Edge Studio 里设置。',
    '',
    '安装',
    '1) mods 文件夹里要有 SlashBlade: Resharped（1.20.1 / Forge 47+）',
    '2) 把本 jar 放进 mods，启动游戏',
    '3) 刀出现在「拔刀剑」创造模式标签页，或用拔刀剑+耀魂合成',
    '',
    'SA / SE 说明',
    'SA 与 SE 都是模组里已注册的条目，数据包只能「引用」不能新增逻辑。',
    '1.20.1 的 Resharped 只注册了 8 个 SA 与 1 个 SE（slashblade:wither_edge）。',
    '在「自定义 SE」里填写的其它名字，需要对应附属模组先注册才会生效，否则被忽略。',
    'SA 若写成不存在的名字，刀会在加载时报错，请优先用下拉里的官方名。',
    '',
    '安装',
    '1) mods 文件夹里要有 SlashBlade: Resharped（1.20.1 / Forge 47+）',
    '2) 把本 jar 放进 mods，启动游戏',
    '3) 刀出现在「拔刀剑」创造模式标签页，或用拔刀剑+耀魂合成',
    '',
    '内容',
    'data/' + modid + '/slashblade/named_blades/' + blade + '.json   刀定义',
    'assets/' + modid + '/model/named/' + base + '.obj|png         模型与贴图',
    'data/' + modid + '/recipes/' + blade + '.json                 合成配方',
    '',
    '本包是纯数据模组（modLoader=lowcodefml），不含 Java 代码。',
    'OBJ 里保留 item_blade 与 blade 两个组即可被 SlashBlade 识别。',
  ].join('\n');

  return [
    { path: 'META-INF/mods.toml', text: toml },
    { path: 'pack.mcmeta', text: mcmeta },
    { path: 'LICENSE.txt', text: 'All Rights Reserved\nGenerated by Blade Forge\n' },
    { path: 'README.txt', text: readme },
    { path: 'data/' + modid + '/slashblade/named_blades/' + blade + '.json', text: bladeJson },
    { path: 'data/' + modid + '/recipes/' + blade + '.json', text: recipeJson },
    { path: 'assets/' + modid + '/model/named/' + base + '.obj', text: objText },
    { path: 'assets/' + modid + '/model/named/' + base + '.png', png: png },
    { path: 'assets/' + modid + '/lang/zh_cn.json', text: langZh },
    { path: 'assets/' + modid + '/lang/en_us.json', text: langEn },
  ];
}

function openJar() {
  $('jarName').value = doc.name;
  $('jarBladeId').value = slugify(doc.name) === 'blade' ? 'blade1' : slugify(doc.name);
  $('jarModid').value = 'bladeforge';
  $('jarModal').hidden = false;
}

$('btnJar').addEventListener('click', openJar);
$('jarCancel').addEventListener('click', () => { $('jarModal').hidden = true; });
$('jarOk').addEventListener('click', async () => {
  const modid = $('jarModid').value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(modid)) { msg('模组 ID 只能用小写字母/数字/下划线，且字母开头'); return; }
  const bladeId = slugify($('jarBladeId').value).replace(/^_+/, '') || 'blade1';
  const ver = ($('jarVer').value || '1.0.0').trim();
  const entries = buildJarEntries({
    modid: modid,
    bladeId: bladeId,
    version: ver,
    modName: ($('jarName').value || doc.name) + ' 附属包',
    bladeName: $('jarName').value || doc.name,
    atk: Number($('jarAtk').value) || 7,
    dur: Number($('jarDur').value) || 90,
    desc: 'Blade Forge 导出的拔刀剑：' + ($('jarName').value || doc.name),
  });
  if (!window.api || !window.api.saveJar) { msg('当前环境不能写文件'); return; }
  const p = await window.api.saveJar({ defaultName: modid + '-' + ver + '.jar', entries: entries });
  if (p) {
    $('jarModal').hidden = true;
    msg('已生成 ' + p);
  }
});

$('btnSave').addEventListener('click', async () => {
  if (!window.api) return;
  const payload = JSON.stringify({ version: 3, name: doc.name, params: doc.params, extras: doc.extras, tex: texCanvas.toDataURL('image/png') }, null, 2);
  const p = await window.api.saveProject(doc.name + '.bfm.json', payload);
  if (p) msg('已保存到 ' + p);
});
// 送去工坊：把模型 + 贴图打包成樱刃工坊的 .ses 工程
function buildSesProject(o) {
  const opts = o || {};
  const modid = String(opts.modid || 'blademod').toLowerCase();
  const bladeId = String(opts.bladeId || 'blade1');
  const name = String(opts.name || doc.name || '无名刀');
  const atk = Number(opts.atk) || 7;
  const dur = Number(opts.dur) || 90;
  const objText = geomsToObj(exportList()).replace(/^usemtl .*$/gm, '').replace(/^mtllib .*$/gm, '');
  const texUrl = texCanvas.toDataURL('image/png');
  return {
    format: 'sakura-edge-project/1',
    namespace: modid,
    pack: { name: name + ' 刀包', version: '1.0.0', authors: '', description: '由 Blade Forge 从模型导出' },
    blades: [{
      id: bladeId,
      zh: name,
      en: name,
      itemRef: 'slashblade:slashblade',
      creative: 'slashblade:slashblade',
      attack: atk,
      dur: dur,
      unbreakable: false,
      slashArt: 'slashblade:judgement_cut',
      rootCombo: 'slashblade:standby',
      types: [],
      effects: [],
      enchants: [],
      summonColor: '#3a3aff',
      colorInverse: false,
      carry: 'PSO2',
      modelName: bladeId + '.obj',
      textureName: bladeId + '.png',
      modelBase: 'forge',
      modelBaseData: objText,
      modelData: objText,
      tune: { len: 1, wid: 1, sori: 0, hilt: 1 },
      textureData: texUrl,
      recipe: { type: 'create', material: 'slashblade:proudsoul', core: 'slashblade:proudsoul_sphere', source: '', kill: 0, refine: 0, proud: 0 },
    }],
  };
}

$('btnSes').addEventListener('click', () => {
  const el = $('sesModal');
  if (!el) return;
  $('sesName').value = doc.name || '无名刀';
  $('sesBladeId').value = (doc.name || 'blade1').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'blade1';
  el.hidden = false;
});
$('sesCancel').addEventListener('click', () => { $('sesModal').hidden = true; });
$('sesOk').addEventListener('click', async () => {
  const modid = $('sesModid').value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(modid)) { msg('模组 ID 只能用小写字母/数字/下划线，且字母开头'); return; }
  const bladeId = slugify($('sesBladeId').value).replace(/^_+/, '') || 'blade1';
  const project = buildSesProject({
    modid,
    bladeId,
    name: $('sesName').value || doc.name,
    atk: Number($('sesAtk').value) || 7,
    dur: Number($('sesDur').value) || 90,
  });
  if (!window.api || !window.api.saveSes) { msg('当前环境不能写文件'); return; }
  const p = await window.api.saveSes(bladeId + '.ses', JSON.stringify(project, null, 2));
  if (p) {
    $('sesModal').hidden = true;
    msg('已导出工坊工程：' + p);
  }
});

$('btnOpen').addEventListener('click', async () => {
  if (!window.api) return;
  const res = await window.api.openProject();
  if (!res) return;
  try {
    const obj = JSON.parse(res.data);
    doc.name = obj.name || '无名刀';
    doc.params = Object.assign({}, DEFAULT_ALL, obj.params || {});
    doc.extras = Array.isArray(obj.extras) ? obj.extras : [];
    if (obj.tex) {
      const img = new Image();
      img.onload = () => {
        const c = texCanvas.getContext('2d');
        c.clearRect(0, 0, 128, 256);
        c.drawImage(img, 0, 0, 128, 256);
        tex.needsUpdate = true;
        drawTex();
      };
      img.src = obj.tex;
    }
    const need = doc.extras.filter((e) => e.type === 'import' && !importCache.get(e.file));
    if (need.length && window.api && window.api.readObj) {
      await Promise.all(need.map(async (e) => {
        const r = await window.api.readObj(e.file);
        if (r && r.text) { const g = geoFromObj(r.text); if (g) importCache.set(e.file, g); }
      }));
    }
    syncFields(); rebuild();
    autoFrame();
    const miss = doc.extras.filter((e) => e.type === 'import' && !importCache.get(e.file));
    if (miss.length) msg('有 ' + miss.length + ' 个外部元素找不到原文件');
    msg('已打开 ' + res.path);
  } catch (e) {
    msg('这个文件不是 Blade Forge 工程');
  }
});

// 新建对话框
let pickKey = 'standard';
function openNew() {
  $('newGrid').innerHTML = Object.keys(PRESETS).map((k) =>
    '<div class="pick' + (k === pickKey ? ' on' : '') + '" data-pick="' + k + '"><b>' + PRESETS[k].label + '</b><span>' + PRESETS[k].desc + '</span></div>').join('');
  $('modal').hidden = false;
  $('newName').value = '无名刀';
  setTimeout(() => $('newName').focus(), 60);
}
$('btnNew').addEventListener('click', openNew);
$('newGrid').addEventListener('click', (ev) => {
  const p = ev.target.closest('[data-pick]');
  if (!p) return;
  pickKey = p.dataset.pick;
  $('newGrid').querySelectorAll('.pick').forEach((el) => el.classList.toggle('on', el === p));
});
$('newCancel').addEventListener('click', () => { $('modal').hidden = true; });
$('newOk').addEventListener('click', () => {
  doc.name = $('newName').value.trim() || '无名刀';
  doc.params = Object.assign({}, DEFAULT_ALL, PRESETS[pickKey].params);
  doc.extras = [];
  syncFields(); rebuild();
  autoFrame();
  $('modal').hidden = true;
  msg('已新建 ' + doc.name);
});

// 菜单
/* 顶栏菜单：点按钮弹出下拉，不用去记每个按钮干什么 */
let menuPop = null;
const MENU_DEF = {
  file: [['新建', 'new'], ['打开工程', 'open'], ['保存工程', 'save'], ['导出 OBJ', 'obj'], ['导出贴图', 'tex'], ['导出资源包', 'pkg'], ['生成附属包', 'jar'], ['送去工坊', 'ses']],
  edit: [['撤销', 'undo'], ['重做', 'redo'], ['按当前参数重建几何', 'rebuild'], ['清空附加件', 'clearx']],
  view: [['正视', 'front'], ['侧视', 'side'], ['俯视', 'top'], ['重置视角', 'reset'], ['全部显示组', 'showall'], ['重置参数', 'resetparams'], ['基础材质（最保险）', 'basic'], ['立体光照材质', 'lit'], ['纯色诊断模式', 'compat'], ['原版基准', 'ref'], ['网格', 'grid'], ['线框', 'wire'], ['手柄', 'handles']],
  help: [['软件渲染（最稳，重启生效）', 'gpu-soft'], ['硬件加速（可能有驱动问题，重启生效）', 'gpu-hw'], ['快捷键', 'keys'], ['反馈 / 提建议', 'fb'], ['GitHub 仓库', 'repo']],
};
function closeMenu() { if (menuPop) { menuPop.remove(); menuPop = null; } }
document.querySelector('.menu').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  ev.stopPropagation();
  if (menuPop) { closeMenu(); return; }
  const rect = b.getBoundingClientRect();
  menuPop = document.createElement('div');
  menuPop.className = 'menu-pop';
  menuPop.style.left = rect.left + 'px';
  menuPop.style.top = (rect.bottom + 6) + 'px';
  menuPop.innerHTML = (MENU_DEF[b.dataset.menu] || []).map(([label, act]) => '<button data-act="' + act + '">' + label + '</button>').join('');
  document.body.appendChild(menuPop);
});
document.addEventListener('click', (ev) => {
  if (!menuPop) return;
  const it = ev.target.closest('.menu-pop button');
  if (!it) { closeMenu(); return; }
  const act = it.dataset.act;
  closeMenu();
  const clickId = (id) => { const el = $(id); if (el) el.click(); };
  const toggle = (name) => { const el = document.querySelector('[data-toggle="' + name + '"]'); if (el) el.click(); };
  if (act === 'new') return clickId('btnNew');
  if (act === 'open') return clickId('btnOpen');
  if (act === 'save') return clickId('btnSave');
  if (act === 'obj') return clickId('btnObj');
  if (act === 'tex') return clickId('btnTex');
  if (act === 'pkg') return clickId('btnPkg');
  if (act === 'jar') return clickId('btnJar');
  if (act === 'ses') return clickId('btnSes');
  if (act === 'undo') return clickId('btnUndo');
  if (act === 'redo') return clickId('btnRedo');
  if (act === 'rebuild') { syncFields(); rebuild(); msg('已按当前参数重建'); return; }
  if (act === 'clearx') { doc.extras.length = 0; rebuild(); histPush(true); toast('已清空附加件'); return; }
  if (act === 'front' || act === 'side' || act === 'top') {
    const el = document.querySelector('.vbar [data-view="' + act + '"]');
    if (el) el.click();
    return;
  }
  if (act === 'reset') { camTheta = -0.34; camPhi = 1.30; camDist = 610; camTarget.set(88, 16, 0); updateCamera(); draw(); return; }
  if (act === 'showall') {
    for (const g of GROUPS) { doc.visible[g[0]] = true; if (meshes[g[0]]) meshes[g[0]].visible = true; }
    renderTree(); paintSelection(); draw(); updateStatus(); toast('已显示全部 8 组');
    return;
  }
  if (act === 'resetparams') {
    doc.params = Object.assign({}, DEFAULT_ALL);
    rebuild(); syncFields(); histPush(true); toast('参数已重置为默认');
    return;
  }
  if (act === 'basic' || act === 'lit' || act === 'compat') {
    if (act === 'basic') { litMode = false; compatMode = false; }
    if (act === 'lit') { litMode = true; compatMode = false; }
    if (act === 'compat') compatMode = true;
    for (const k of Object.keys(mats)) { mats[k].dispose(); delete mats[k]; }
    for (const k of Object.keys(exMats)) { exMats[k].dispose(); delete exMats[k]; }
    rebuild();
    toast(act === 'lit' ? '已切换立体光照材质（如果变黑，用「基础材质」）'
      : act === 'compat' ? '纯色诊断模式：只显示形状，用于判断是不是材质问题'
      : '基础材质：不受光照影响，最保险');
    return;
  }
  if (act === 'ref' || act === 'grid' || act === 'wire' || act === 'handles') return toggle(act);
  if (act === 'keys') { msg('快捷键：F 正视 / S 侧视 / T 俯视 / G 网格 / R 基准 / W 线框'); return; }
  if (act === 'gpu-soft' || act === 'gpu-hw') {
    if (window.api && window.api.setGpu) {
      window.api.setGpu(act === 'gpu-hw');
      toast('已设置，正在重启…');
      setTimeout(() => { if (window.api.relaunch) window.api.relaunch(); }, 700);
    } else toast('当前环境不支持切换');
    return;
  }
  if (act === 'fb') { openFeedback(); return; }
  if (act === 'repo') { if (window.api && window.api.openUrl) window.api.openUrl(FEEDBACK_REPO + '/releases'); return; }
});

// 快捷键
window.addEventListener('keydown', (ev) => {
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (ev.target && ev.target.isContentEditable)) return;
  const k = ev.key.toLowerCase();
  if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); histStep(ev.shiftKey ? 1 : -1); return; }
  if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); histStep(1); return; }
  const btn = { f: 'front', s: 'side', t: 'top' }[k];
  if (btn) {
    document.querySelector('.vbar [data-view="' + btn + '"]').click();
    return;
  }
  if (k === 'home') {
    ev.preventDefault();
    autoFrame();
    setViewLabel('透视视图');
    setZoomLabel();
    msg('已把模型拉回视野中央');
    return;
  }
  const panKeys = {
    arrowleft: [-1, 0, 0], a: [-1, 0, 0], arrowright: [1, 0, 0], d: [1, 0, 0],
    arrowup: [0, 1, 0], q: [0, 1, 0], arrowdown: [0, -1, 0], e: [0, -1, 0],
    pageup: [0, 0, 1], pagedown: [0, 0, -1],
  };
  if (panKeys[k]) {
    ev.preventDefault();
    panBy(panKeys[k][0] * 60, panKeys[k][1] * 60, panKeys[k][2]);
    return;
  }
  if (k === 'g') document.querySelector('[data-toggle="grid"]').click();
  if (k === 'r') document.querySelector('[data-toggle="ref"]').click();
  if (k === 'w') document.querySelector('[data-toggle="wire"]').click();
});

function msg(text) { $('stMsg').textContent = text; }

// 轻量浮层提示（状态栏之外的醒目提示）
let toastTimer = 0;
function toast(text) {
  let el = document.getElementById('toastbox');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastbox';
    el.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:#1b2430;'
      + 'color:#ffd479;border:1px solid #43536b;padding:9px 16px;border-radius:8px;font-size:14px;'
      + 'z-index:999;opacity:0;transition:opacity .18s;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.45)';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

// fps
let frames = 0, last = performance.now();
function tick() {
  frames++;
  const now = performance.now();
  if (now - last > 700) {
    $('stFps').textContent = Math.round((frames * 1000) / (now - last)) + ' fps';
    frames = 0; last = now;
  }
  requestAnimationFrame(tick);
}

// 启动
renderFields();
renderParts();
buildRef();
rebuild();
histPush(true);
histBtn();
updateCamera();
/* ---------- Blockbench 风格面板交互 ---------- */
const BASE_DIST = 690;
function setViewLabel(t) { const el = $('vLabel'); if (el) el.textContent = t; }
function setZoomLabel() { const el = $('vZoom'); if (el) el.textContent = Math.round(BASE_DIST / camDist * 100) + '%'; }

document.querySelectorAll('.tabs button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    const k = b.dataset.tab;
    document.querySelectorAll('.tabpage').forEach((pg) => { pg.hidden = pg.dataset.page !== k; });
    if (k === 'shape') setTimeout(resize, 30);
  });
});

document.querySelectorAll('.pcol').forEach((btn) => {
  btn.addEventListener('click', () => {
    const pane = btn.closest('.pane');
    const folded = pane.classList.toggle('collapsed');
    btn.textContent = folded ? '⌄' : '⌃';
    setTimeout(resize, 60);
  });
});

document.querySelectorAll('.splitter').forEach((sp) => {
  sp.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const side = sp.dataset.side;
    const body = document.querySelector('.bb-body');
    try { sp.setPointerCapture(ev.pointerId); } catch (_) {}
    const move = (e) => {
      const r = body.getBoundingClientRect();
      if (side === 'left') body.style.setProperty('--leftw', Math.min(430, Math.max(180, e.clientX - r.left)) + 'px');
      else body.style.setProperty('--rightw', Math.min(470, Math.max(220, r.right - e.clientX)) + 'px');
      resize();
    };
    const up = () => {
      sp.removeEventListener('pointermove', move);
      sp.removeEventListener('pointerup', up);
      sp.removeEventListener('pointercancel', up);
    };
    sp.addEventListener('pointermove', move);
    sp.addEventListener('pointerup', up);
    sp.addEventListener('pointercancel', up);
  });
});

document.querySelector('.vbar').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-view]');
  const lbl = { front: '正视图', side: '侧视图', top: '俯视图' }[b && b.dataset.view];
  if (lbl) setViewLabel(lbl);
});

const treeSearch = $('treeSearch');
if (treeSearch) {
  treeSearch.addEventListener('input', () => {
    const q = treeSearch.value.trim().toLowerCase();
    document.querySelectorAll('#tree .grp').forEach((r) => {
      const hit = !q || (r.textContent || '').toLowerCase().indexOf(q) >= 0;
      r.style.display = hit ? '' : 'none';
    });
  });
}

resize();
new ResizeObserver(() => resize()).observe(canvas.parentElement);
window.addEventListener('resize', resize);
requestAnimationFrame(tick);

window.__bf = {
  sesProject: buildSesProject,
  loadTex: loadTexFromUrl,
  importSesData: (project, path) => {
    const b = project.blades[0];
    doc.name = b.zh || b.id;
    const tag = (path || 'ses') + '#' + b.id;
    const geo = geoFromObj(b.modelData);
    if (geo) { importCache.set(tag, geo); doc.extras.push({ type: 'import', file: tag, name: '工坊·' + b.id, t: 0, scale: 1, yOff: 8, slot: 'blade', color: 0x5aa9ff }); rebuild(); }
    return doc.extras.length;
  },
  attachImport,
  buildJarEntries,
  openJar,
  tint: (hex) => { for (const k of Object.keys(mats)) if (mats[k] && mats[k].color) mats[k].color.setHex(hex); draw(); },
  paintAtUV,
  texData: () => texCanvas.toDataURL('image/png'),
  texPixel: (x, y) => Array.from(texCanvas.getContext('2d').getImageData(x, y, 1, 1).data),
  mapInfo: () => ({ sameImg: mats.blade.map ? mats.blade.map.image === texCanvas : false, ver: mats.blade.map ? mats.blade.map.version : -1 }),
  forceRed: () => { mats.blade.color.setHex(0xff0000); mats.blade.map = null; mats.blade.emissiveMap = null; mats.blade.needsUpdate = true; rebuild(); },
  buildPkg: () => ({ obj: geomsToObj(exportList(), doc.name + '.mtl'), mtl: makeMtl(doc.name + '.png') }),
  extrasInfo: () => exMeshes.map((m) => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return [m.name, m.visible, +b.min.x.toFixed(1), +b.max.x.toFixed(1), +b.min.y.toFixed(1), +b.max.y.toFixed(1), +b.min.z.toFixed(1), +b.max.z.toFixed(1)]; }),
  exportList,
  doc,
  probe(key) {
    const o = handleObjs[key];
    const v = o.position.clone().project(cam);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  },
  params() { return Object.assign({}, doc.params); },
  setParams(p) { doc.params = Object.assign({}, DEFAULT_ALL, p); syncFields(); rebuild(); },
  shot() { return canvas.toDataURL('image/png'); },
};

/* ---------------- 自动更新 ---------------- */
const UPD = {
  info: null,
  source: '',
  token: '',
  autoCheck: true,
  checking: false,
  result: null,
  downloading: false,
  pct: 0,
  got: 0,
  total: 0,
  speed: 0,
  lastT: 0,
  lastGot: 0,
  installing: false,
  installed: null,
};

function updBytes(n) {
  const v = Number(n) || 0;
  if (!v) return '大小未知';
  if (v >= 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + ' MB';
  return Math.round(v / 1024) + ' KB';
}

const FEEDBACK_REPO = 'https://github.com/MCr630239/sakuraedge';

function feedbackIssueUrl() {
  const info = UPD.info || {};
  const body = [
    '**问题 / 建议**',
    '',
    '',
    '**复现步骤（如果是 bug）**',
    '1. ',
    '',
    '**环境**',
    `- Blade Forge v${info.version || '未知'}`,
    `- 平台：${info.platform || '未知'}${info.packaged === false ? '（开发模式）' : ''}`,
    '',
    '**截图 / 日志 / 工程文件**',
    '（可以直接拖进这个输入框）',
  ].join('\n');
  return `${FEEDBACK_REPO}/issues/new?title=${encodeURIComponent('【反馈】')}&body=${encodeURIComponent(body)}`;
}

function openFeedback() {
  if (!window.api || !window.api.openUrl) { toast('当前环境不支持外链', true); return; }
  window.api.openUrl(feedbackIssueUrl());
}

function updHtml() {
  const info = UPD.info || {};
  const res = UPD.result;
  const meta = res && res.ok ? res.meta : null;

  let status = '<div class="note" style="margin:8px 0">还没检查过。填好更新源后点「立即检查」。</div>';
  if (UPD.checking) status = '<div class="note">正在读取更新源…</div>';
  else if (UPD.downloading) {
    const pct = Math.round((UPD.pct || 0) * 100);
    const mb = (n) => (n / 1048576).toFixed(1);
    let line = '正在下载更新包… ' + pct + '%';
    if (UPD.total) line += ' · ' + mb(UPD.got) + ' / ' + mb(UPD.total) + ' MB';
    if (UPD.speed) line += ' · ' + (UPD.speed / 1048576).toFixed(2) + ' MB/s';
    status = '<div class="note">' + line + '</div>'
      + '<div style="height:6px;background:#15171b;border:1px solid #2a3340;border-radius:3px;overflow:hidden;margin:6px 0 10px">'
      + '<div style="height:6px;width:' + pct + '%;background:#3cd0c4"></div></div>';
  } else if (UPD.installing) status = '<div class="note">正在解压更新包…</div>';
  else if (UPD.installed) {
    const r = UPD.installed;
    status = r.ok
      ? '<div class="note" style="color:#8bd89a">已解压 ' + r.count + ' 个文件，' + (r.restart ? '建模器会自动退出并替换，然后重新启动' : '请手动替换') + '。目标目录：' + escapeHtml(r.appDir || '') + '</div>'
      : '<div class="note" style="color:#e8a07a">' + escapeHtml(r.error || '安装失败') + '</div>'
        + (r.stage ? '<div class="note">已解压到：' + escapeHtml(r.stage) + '</div>' : '');
  } else if (res) {
    if (!res.ok) status = '<div class="note" style="color:#e88484">检查失败：' + escapeHtml(res.error || '未知错误') + '</div>';
    else if (res.newer) {
      status = '<div style="color:#8bd89a;font-weight:600;margin:8px 0 4px">发现新版本 v' + escapeHtml(meta.version) + '（当前 v' + escapeHtml(res.current) + '）</div>'
        + '<div class="note">更新包：' + updBytes(meta.size) + (meta.channel ? ' · ' + escapeHtml(meta.channel) : '') + (meta.via === 'github' ? ' · GitHub' : '') + '</div>'
        + (meta.notes ? '<div class="note" style="white-space:pre-wrap;max-height:180px;overflow:auto;border:1px solid #2a3340;border-radius:4px;padding:6px 8px;margin:6px 0">' + escapeHtml(meta.notes) + '</div>' : '')
        + '<div class="row" style="display:flex;gap:8px;margin:8px 0">'
        + '<button class="primary" data-upd="download">下载并安装</button>'
        + '<button class="ghost" data-upd="downloadonly">只下载</button></div>';
    } else {
      status = '<div style="color:#8bd89a;margin:8px 0">已是最新版本 v' + escapeHtml(res.current) + '</div>';
    }
  }

  return ''
    + '<div class="jrow"><label>当前版本</label><div style="flex:1;color:#9fb0c4">v' + escapeHtml(info.version || '—') + ' · ' + escapeHtml(info.platform || '') + (info.packaged === false ? '（开发模式）' : '') + '</div></div>'
    + '<div class="jrow"><label>更新源</label><input id="updSource" spellcheck="false" placeholder="github:名字/仓库 或 latest.json 地址 或 D:\\update" value="' + escapeHtml(UPD.source) + '" /></div>'
    + '<div class="jrow"><label>Token</label><input id="updToken" type="password" spellcheck="false" placeholder="私有仓库或限流时填，公开仓库留空" value="' + escapeHtml(UPD.token) + '" /></div>'
    + '<div class="row" style="display:flex;gap:8px;margin:10px 0">'
    + '<button class="ghost" data-upd="save">保存</button>'
    + '<button class="primary" data-upd="check">立即检查</button>'
    + '<button class="ghost" data-upd="zip">从 zip 安装…</button>'
    + '<button class="ghost" data-upd="logdir">日志</button>'
    + '<button class="ghost" data-upd="feedback">反馈 / 提建议</button>'
    + '<label style="display:flex;gap:6px;align-items:center;margin-left:auto;color:#9fb0c4"><input type="checkbox" data-upd-auto="1" ' + (UPD.autoCheck ? 'checked' : '') + ' /> 启动自动检查</label>'
    + '</div>'
    + '<div class="note">GitHub 源写法 <b>github:名字/仓库</b>，固定某个版本用 <b>github:名字/仓库@v0.18.1</b>。发版约定：tag 用 v0.18.1，附件名 <b>BladeForge-0.18.1-Windows-x64.zip</b>。</div>'
    + '<div style="margin-top:10px;border-top:1px solid #2a3340;padding-top:8px">' + status + '</div>';
}

function renderUpd() {
  const el = $('updBody');
  if (el) el.innerHTML = updHtml();
}

async function initUpd(silent) {
  if (!window.api || !window.api.updateState) return;
  try {
    const st = await window.api.updateState();
    UPD.info = st;
    UPD.source = st.source || '';
    UPD.token = st.token || '';
    UPD.autoCheck = st.autoCheck !== false;
    const bv = $('brandVer');
    if (bv && st.version) bv.textContent = st.version;
    msg('Blade Forge v' + (st.version || '') + ' · 就绪');
    if (window.api.onUpdateProgress) {
      window.api.onUpdateProgress((p) => {
        if (!p || p.phase !== 'download') return;
        const now = Date.now();
        if (UPD.lastT && now - UPD.lastT > 250) {
          UPD.speed = (p.got - UPD.lastGot) / ((now - UPD.lastT) / 1000);
          UPD.lastT = now;
          UPD.lastGot = p.got;
        } else if (!UPD.lastT) {
          UPD.lastT = now;
          UPD.lastGot = p.got;
        }
        UPD.got = p.got;
        UPD.total = p.total;
        UPD.pct = p.pct || 0;
        if (UPD.downloading && !$('updModal').hidden) renderUpd();
      });
    }
    if (st.lastFail) toast(st.lastFail);
    if (UPD.autoCheck && UPD.source && Date.now() - Number(st.lastCheck || 0) > 12 * 3600 * 1000) {
      runUpdCheck(true);
    }
  } catch (e) {
    console.error('[upd]', e);
  }
}

async function runUpdCheck(silent) {
  const srcEl = $('updSource');
  const tokEl = $('updToken');
  if (srcEl) UPD.source = String(srcEl.value || '').trim();
  if (tokEl) UPD.token = String(tokEl.value || '').trim();
  if (!UPD.source) {
    UPD.result = { ok: false, error: '先填一个更新源地址' };
    renderUpd();
    return;
  }
  if (UPD.token !== ((UPD.info && UPD.info.token) || '')) {
    await window.api.updateSave({ source: UPD.source, token: UPD.token });
  }
  UPD.checking = true;
  UPD.installed = null;
  renderUpd();
  const r = await window.api.updateCheck(UPD.source);
  UPD.checking = false;
  UPD.result = r;
  if (r && r.ok && r.newer && silent) toast('建模器有新版本 v' + r.meta.version + '，点右上「更新」');
  renderUpd();
}

async function runUpdDownload(install) {
  const meta = UPD.result && UPD.result.ok ? UPD.result.meta : null;
  if (!meta || !meta.url) { toast('更新清单里没有下载地址'); return; }
  UPD.downloading = true;
  UPD.pct = 0; UPD.got = 0; UPD.total = 0; UPD.speed = 0; UPD.lastT = 0; UPD.lastGot = 0;
  renderUpd();
  const dl = await window.api.updateDownload({ url: meta.url, assetApi: meta.assetApi || '' });
  UPD.downloading = false;
  if (!dl.ok) {
    UPD.result = { ok: false, error: '下载失败：' + dl.error };
    renderUpd();
    return;
  }
  toast('已下载 ' + updBytes(dl.bytes));
  if (!install) {
    UPD.installed = { ok: false, error: '只下载完成，文件在 ' + dl.path + '，可点「从 zip 安装…」选它' };
    renderUpd();
    return;
  }
  await runUpdInstall(dl.path);
}

async function runUpdInstall(zipPath) {
  if (!zipPath) return;
  UPD.installing = true;
  UPD.installed = null;
  renderUpd();
  const r = await window.api.updateInstall(zipPath);
  UPD.installing = false;
  UPD.installed = r;
  renderUpd();
}

$('btnUpd').addEventListener('click', async () => {
  $('updModal').hidden = false;
  if (!UPD.info) await initUpd(false);
  renderUpd();
});

$('btnFb').addEventListener('click', async () => {
  if (!UPD.info) await initUpd(false);
  openFeedback();
});
$('updClose').addEventListener('click', () => { $('updModal').hidden = true; });

$('updBody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-upd]');
  if (!btn) return;
  const how = btn.dataset.upd;
  if (how === 'save') {
    const srcEl = $('updSource');
    const tokEl = $('updToken');
    UPD.source = srcEl ? srcEl.value.trim() : UPD.source;
    UPD.token = tokEl ? tokEl.value.trim() : UPD.token;
    await window.api.updateSave({ source: UPD.source, token: UPD.token, autoCheck: UPD.autoCheck });
    toast('更新源已保存');
    return;
  }
  if (how === 'check') { runUpdCheck(false); return; }
  if (how === 'zip') {
    const p = await window.api.updatePickZip();
    if (p) runUpdInstall(p);
    return;
  }
  if (how === 'download') { runUpdDownload(true); return; }
  if (how === 'downloadonly') { runUpdDownload(false); return; }
  if (how === 'logdir') { window.api.updateOpenLogDir(); return; }
  if (how === 'feedback') { openFeedback(); return; }
  if (how === 'issues') { if (window.api.openUrl) window.api.openUrl(FEEDBACK_REPO + '/issues'); return; }
});

$('updBody').addEventListener('change', async (e) => {
  if (!e.target.dataset || e.target.dataset.updAuto === undefined) return;
  UPD.autoCheck = e.target.checked;
  await window.api.updateSave({ source: UPD.source, token: UPD.token, autoCheck: UPD.autoCheck });
});

initUpd(true);
