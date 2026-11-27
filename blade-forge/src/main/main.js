const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let SOFT_RENDER = false;

/* 老 Intel 核显（HD 4000/4600 等）在 Chromium 的 D3D 路径上会丢三角形面，
   只剩线和点能画。默认走软件渲染（SwiftShader）最稳；--gpu 或设置里开启可恢复硬件。 */
function gpuPrefPath() {
  try { return path.join(app.getPath('userData'), 'gpu.json'); } catch (_) { return null; }
}
function hardwarePreferred() {
  if (process.argv.includes('--gpu')) return true;
  if (process.argv.includes('--sw')) return false;
  try {
    const raw = fs.readFileSync(gpuPrefPath(), 'utf8');
    return JSON.parse(raw).hardware === true;
  } catch (_) { return false; }
}
if (hardwarePreferred()) {
  SOFT_RENDER = false;
} else {
  app.disableHardwareAcceleration();
  SOFT_RENDER = true;
}

function createWindow() {
  win = new BrowserWindow({
    width: process.env.DEMO ? 1600 : 1360,
    height: process.env.DEMO ? 960 : 860,
    frame: process.env.DEMO ? false : true,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#101012',
    title: 'Blade Forge · 拔刀剑建模器',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.webContents.on('console-message', (_e, _lvl, msg) => console.log('[renderer]', msg));
  win.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      const ex = (code) => win.webContents.executeJavaScript(code);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      try {
        if (process.env.DEMO) {
          const at = (ms, js) => setTimeout(() => { win.webContents.executeJavaScript(js).catch(() => {}); }, ms + 7000);
          const part = (k) => `(()=>{const b=document.querySelector('input[data-part="${k}"]'); if(b&&!b.checked)b.click();})()`;
          const sel = (k, v) => `(()=>{const s=document.querySelector('select[data-sel="${k}"]'); s.value='${v}'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`;
          const rng = (k, v) => `(()=>{const r=document.querySelector('input[data-p="${k}"]'); r.value='${v}'; r.dispatchEvent(new Event('input',{bubbles:true}));})()`;
          at(3200, part('pommelOn'));
          at(3550, part('fuchiOn'));
          at(3900, part('grooveOn'));
          at(6800, sel('gshape', 2));
          at(10200, sel('hsides', 6));
          at(13600, rng('sscale', 1.35));
          at(17000, part('wrapOn'));
          at(17300, part('koiguchiOn'));
          at(17600, part('kojiriOn'));
          at(20500, `(()=>{const cb=document.querySelector('input[data-part="guardOn"]'); cb.closest('.prow').querySelector('.pn').click();})()`);
          at(24500, sel('gshape', 3));
          at(27500, `(()=>{const cv=document.getElementById('gl'); const mk=(t,x,y)=>cv.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,pointerId:1})); mk('pointerdown',340,800); let i=0; const iv=setInterval(()=>{ i++; mk('pointermove',340+i*14,800); if(i>30){clearInterval(iv); mk('pointerup',340+30*14,800);} },110);})()`);
        }
        if (process.env.DRAG) {
          const r = await ex(`(() => {
            const key = '${process.env.DRAG}';
            const a = window.__bf.probe(key);
            const cv = document.getElementById('gl');
            const mk = (t, x, y, extra) => cv.dispatchEvent(new PointerEvent(t, Object.assign({ clientX: x, clientY: y, bubbles: true, pointerId: 1 }, extra || {})));
            mk('pointerdown', a.x, a.y);
            mk('pointermove', a.x + 60, a.y - 45);
            mk('pointerup', a.x + 60, a.y - 45);
            return JSON.stringify({ before: a, after: window.__bf.params() });
          })()`);
          console.log('[drag]', r);
          await sleep(500);
        }
        if (process.env.NEWDLG) { await ex("document.getElementById('btnNew')?.click()"); await sleep(400); }
        if (process.env.JARDLG) { await ex("document.getElementById('btnJar')?.click()"); await sleep(400); }
        if (process.env.IMPORTOBJ) {
          const txt = fs.readFileSync(process.env.IMPORTOBJ, 'utf8');
          await ex('window.__bf.attachImport(' + JSON.stringify(process.env.IMPORTOBJ) + ',' + JSON.stringify(txt) + ')');
          await sleep(400);
        }
        if (process.env.ADD) {
          for (const t of process.env.ADD.split(',')) {
            await ex(`document.querySelector('[data-add="${t.trim()}"]')?.click()`);
            await sleep(220);
          }
        }
        if (process.env.JSINJECT) {
          await ex(process.env.JSINJECT);
          await sleep(500);
          console.log('[jsinject]', await ex('document.getElementById("stStats").textContent'));
        }
        if (process.env.PRESET) {
          await ex(`document.querySelector('[data-preset="${process.env.PRESET}"]')?.click()`);
          await sleep(400);
        }
        if (process.env.PAINTTEST) {
          await ex(`(() => {
            const b = window.__bf;
            for (let i = 0; i < 5; i++) b.paintAtUV(0.27, 0.24 + i * 0.14, '#c0392b', 22);
            b.paintAtUV(0.21, 0.5, '#d8b46a', 18);
            b.paintAtUV(0.33, 0.86, '#f2f4f6', 18);
          })()`);
          await ex(`document.querySelector('[data-preset="standard"]')?.click()`);
          await sleep(400);
        }
        if (process.env.REF) await ex(`document.querySelector('[data-toggle="ref"]')?.click()`);
        if (process.env.SEL) await ex(`document.querySelector('.grp[data-grp="${process.env.SEL}"]')?.click()`);
        await sleep(700);
        if (process.env.SESIN) {
          const raw = require('fs').readFileSync(process.env.SESIN, 'utf8');
          const r = await win.webContents.executeJavaScript(`(async () => { const n = window.__bf.importSesData(${raw}, 'ses'); const ok = await window.__bf.loadTex(JSON.parse(JSON.stringify(${raw})).blades[0].textureData); return JSON.stringify({ extras: n, tex: ok, name: window.__bf.doc.name }); })()`);
          await sleep(600);
          console.log('[sesin]', r);
        }
        if (process.env.SESOUT) {
          const p = await win.webContents.executeJavaScript(`JSON.stringify(window.__bf.sesProject({ modid: 'kurogane', bladeId: 'kurogane1', name: '黑铁·试作', atk: 8, dur: 120 }))`);
          require('fs').writeFileSync(process.env.SESOUT, p, 'utf8');
          console.log('[ses] written', process.env.SESOUT, p.length);
        }
        if (process.env.EXPORTLOG) {
          console.log('[export]', await ex('JSON.stringify(window.__bf.exportList().map(([n, g]) => [n, g.attributes.position.count, g.index ? g.index.count / 3 : 0]))'));
        }
        if (process.env.PKGLOG) {
          console.log('[pkg]', await ex('(() => { const p = window.__bf.buildPkg(); return JSON.stringify({ objLen: p.obj.length, head: p.obj.slice(0, 120), usemtl: (p.obj.match(/usemtl/g) || []).length }); })()'));
        }
        if (process.env.JARTEST) {
          const entries = await ex('window.__bf.buildJarEntries({modid:"bladeforge",bladeId:"blade1",version:"1.0.0",modName:"无名刀 附属包",bladeName:"无名刀",atk:7,dur:90,desc:"测试刀"})');
          const files = entries.map((e) => ({ name: e.path, data: e.text != null ? Buffer.from(e.text, 'utf8') : Buffer.from(e.png || '', 'base64') }));
          fs.writeFileSync('/tmp/test.jar', makeZip(files));
          console.log('[jar] entries', entries.length, 'bytes', fs.statSync('/tmp/test.jar').size);
        }
        if (process.env.PAINTLOG) {
          console.log('[texpx]', await ex('JSON.stringify([window.__bf.texPixel(34, 200), window.__bf.texPixel(34, 120)])'));
        }
        if (process.env.SHOT && process.env.SHOT !== '/dev/null') {
          await win.webContents.debugger.attach('1.3');
          const shot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true });
          fs.writeFileSync(process.env.SHOT, Buffer.from(shot.data, 'base64'));
          const diag = await ex('JSON.stringify({ stats: document.getElementById("stStats").textContent, msg: document.getElementById("stMsg").textContent })');
          console.log('[shot]', diag);
          await sleep(400);
          app.quit();
        }
      } catch (err) {
        console.error('[inject] fail', err);
        if (process.env.SHOT) app.quit();
      }
    }, 900);
  });
}

app.whenReady().then(() => { try { applyPendingPrune(); } catch (e) {} });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.handle('file:saveObj', async (_e, payload) => {
  const res = await dialog.showSaveDialog(win, {
    title: '导出 OBJ 模型',
    defaultPath: payload.name || 'blade.obj',
    filters: [{ name: 'Wavefront OBJ', extensions: ['obj'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, payload.text, 'utf8');
  return res.filePath;
});

ipcMain.handle('file:savePng', async (_e, payload) => {
  const res = await dialog.showSaveDialog(win, {
    title: '导出贴图',
    defaultPath: payload.name || 'blade.png',
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const b64 = String(payload.dataUrl || '').split(',')[1] || '';
  fs.writeFileSync(res.filePath, Buffer.from(b64, 'base64'));
  return res.filePath;
});

ipcMain.handle('file:saveSes', async (_e, payload) => {
  const res = await dialog.showSaveDialog(win, {
    title: '导出到樱刃工坊',
    defaultPath: payload.name || 'blade.ses',
    filters: [{ name: '樱刃工坊工程', extensions: ['ses'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, payload.text, 'utf8');
  return res.filePath;
});

ipcMain.handle('ses:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: '导入樱刃工坊工程',
    filters: [{ name: '樱刃工坊工程', extensions: ['ses', 'json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const raw = fs.readFileSync(res.filePaths[0], 'utf8');
  try {
    return { path: res.filePaths[0], project: JSON.parse(raw) };
  } catch (e) {
    return { path: res.filePaths[0], error: e.message };
  }
});

ipcMain.handle('project:save', async (_e, payload) => {
  const res = await dialog.showSaveDialog(win, {
    title: '保存工程',
    defaultPath: payload.name || 'blade.bfm.json',
    filters: [{ name: 'Blade Forge 工程', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, payload.text, 'utf8');
  return res.filePath;
});

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function makeZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const last = f.name.endsWith('/');
    const data = last ? Buffer.alloc(0) : f.data;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    parts.push(lh, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cdBuf, eocd]);
}

ipcMain.handle('jar:save', async (_e, payload) => {
  const res = await dialog.showSaveDialog(win, {
    title: '保存拔刀剑附属包',
    defaultPath: payload.defaultName || 'bladeforge-1.0.0.jar',
    filters: [{ name: 'Minecraft Mod', extensions: ['jar'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const files = (payload.entries || []).map((e) => ({
    name: e.path,
    data: e.text != null ? Buffer.from(e.text, 'utf8') : Buffer.from(e.png || '', 'base64'),
  }));
  fs.writeFileSync(res.filePath, makeZip(files));
  return res.filePath;
});

ipcMain.handle('bundle:save', async (_e, payload) => {
  const res = await dialog.showOpenDialog(win, {
    title: '选一个文件夹，导出 OBJ + MTL + 贴图',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const dir = res.filePaths[0];
  const name = payload.name || 'blade';
  const png = Buffer.from(String(payload.png || '').replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(dir, name + '.obj'), payload.obj, 'utf8');
  fs.writeFileSync(path.join(dir, name + '.mtl'), payload.mtl, 'utf8');
  fs.writeFileSync(path.join(dir, name + '.png'), png);
  fs.writeFileSync(path.join(dir, '使用说明.txt'), payload.readme || '', 'utf8');
  return dir;
});

ipcMain.handle('obj:pick', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: '选择要挂上去的模型（OBJ）',
    filters: [{ name: 'Wavefront OBJ', extensions: ['obj'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const p = res.filePaths[0];
  try {
    const text = fs.readFileSync(p, 'utf8');
    if (text.length > 24 * 1024 * 1024) return { path: p, error: '文件太大（>24MB）' };
    return { path: p, text };
  } catch (err) {
    return { path: p, error: String(err && err.message) };
  }
});

ipcMain.handle('obj:read', async (_e, p) => {
  try { return { path: p, text: fs.readFileSync(p, 'utf8') }; }
  catch (err) { return { path: p, error: String(err && err.message) }; }
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: '打开工程',
    filters: [{ name: 'Blade Forge 工程', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const p = res.filePaths[0];
  return { path: p, data: fs.readFileSync(p, 'utf8') };
});

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  electron: process.versions.electron,
  softRender: SOFT_RENDER,
}));
ipcMain.handle('gpu:set', (_e, hardware) => {
  try { fs.writeFileSync(gpuPrefPath(), JSON.stringify({ hardware: !!hardware })); } catch (_) { return false; }
  return true;
});
ipcMain.handle('gpu:relaunch', () => {
  app.relaunch({ args: process.argv.slice(1).filter((a) => a !== '--gpu' && a !== '--sw') });
  app.exit(0);
});

/* 只允许打开本项目的 GitHub 页面，避免被任意 URL 利用 */
const ALLOWED_URL_PREFIXES = ['https://github.com/MCr630239/', 'https://www.bilibili.com/'];
ipcMain.handle('shell:openUrl', (_e, url) => {
  const u = String(url || '');
  if (!ALLOWED_URL_PREFIXES.some((p) => u.startsWith(p))) return false;
  shell.openExternal(u);
  return true;
});

/* ---------- 自动更新 ---------- */
/* 官方更新源：本项目的公开仓库，客户端默认就填这个 */
const DEFAULT_UPDATE_SOURCE = 'https://raw.githubusercontent.com/MCr630239/sakuraedge/main/latest-blade.json';   // 清单很小，zip 走 CDN 下载
const LEGACY_UPDATE_SOURCE = 'github:MCr630239/sakuraedge';               // 旧的 GitHub 默认源，带它时走 CDN
const GITHUB_UPDATE_SOURCE = 'github:MCr630239/sakuraedge';
const os = require('os');
const http = require('http');
const https = require('https');
const JSZip = require('jszip');

const updDir = () => path.join(os.tmpdir(), 'blade-forge-update');
const updCfgPath = () => path.join(app.getPath('userData'), 'update.json');

function readUpdCfg() {
  try {
    return JSON.parse(fs.readFileSync(updCfgPath(), 'utf8')) || {};
  } catch (_) {
    return {};
  }
}

function writeUpdCfg(patch) {
  const next = Object.assign({}, readUpdCfg(), patch || {});
  try {
    fs.mkdirSync(path.dirname(updCfgPath()), { recursive: true });
    fs.writeFileSync(updCfgPath(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (_) {
    return next;
  }
}

function verParts(v) {
  return String(v || '0').replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
}

function cmpVer(a, b) {
  const A = verParts(a);
  const B = verParts(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function fetchText(url, depth = 0, headers = null) {
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('重定向太多'));
    const lib = /^https:/i.test(url) ? https : http;
    let req;
    try {
      req = lib.get(url, { timeout: 8000, headers: headers || undefined }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          fetchText(next, depth + 1, headers).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`更新清单返回 ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      req.on('timeout', () => req.destroy(new Error('连接超时')));
      req.on('error', (e) => reject(e));
    } catch (e) {
      reject(e);
    }
  });
}

function readListSource(src) {
  if (!src) return Promise.reject(new Error('还没设置更新源'));
  if (/^https?:/i.test(src)) return fetchText(src);
  const local = src.replace(/^file:\/\//i, '');
  const target = fs.existsSync(local) && fs.statSync(local).isDirectory() ? path.join(local, 'latest.json') : local;
  try {
    return Promise.resolve(fs.readFileSync(target, 'utf8'));
  } catch (e) {
    return Promise.reject(new Error('读不到更新清单：' + target));
  }
}

function downloadTo(url, dest, onProgress, depth = 0, headers = null) {
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('重定向太多'));
    const lib = /^https:/i.test(url) ? https : http;
    const req = lib.get(url, { timeout: 30000, headers: headers || undefined }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        // 跳到签名地址后不能继续带 Authorization，否则对象存储会拒绝
        const next = new URL(res.headers.location, url).toString();
        downloadTo(next, dest, onProgress, depth + 1, null).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`下载返回 ${res.statusCode}`));
        return;
      }
      const total = Number(res.headers['content-length'] || 0);
      let got = 0;
      const out = fs.createWriteStream(dest);
      res.on('data', (c) => {
        got += c.length;
        if (onProgress) onProgress(got, total);
      });
      res.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => resolve(got));
      res.pipe(out);
    });
    req.on('timeout', () => req.destroy(new Error('下载超时')));
    req.on('error', reject);
  });
}


/* 分块并发下载：CDN 支持 Range 时 4 路一起下，比单线程快数倍 */
function probeTotal(url) {
  return new Promise((resolve, reject) => {
    const go = (u, d) => {
      if (d > 4) return reject(new Error('重定向太多'));
      const lib = /^https:/i.test(u) ? https : http;
      const req = lib.get(u, { timeout: 20000, headers: { Range: 'bytes=0-0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(new URL(res.headers.location, u).toString(), d + 1);
        }
        const cr = String(res.headers['content-range'] || '');
        const m = cr.match(/bytes\s+\d+-\d+\/(\d+)/i);
        res.resume();
        if (res.statusCode === 206 && m) return resolve(Number(m[1]));
        reject(new Error('服务端不支持分块'));
      });
      req.on('timeout', () => req.destroy(new Error('探测超时')));
      req.on('error', reject);
    };
    go(url, 0);
  });
}

/* 分片下载：返回本片真正写入的字节数，重试不会重复累加进度 */
function fetchRange(url, start, end, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('重定向太多'));
    const lib = /^https:/i.test(url) ? https : http;
    const req = lib.get(url, { timeout: 20000, headers: { Range: 'bytes=' + start + '-' + end } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchRange(new URL(res.headers.location, url).toString(), start, end, dest, depth + 1).then(resolve, reject);
      }
      if (res.statusCode !== 206 && res.statusCode !== 200) {
        res.resume();
        return reject(new Error('分块返回 ' + res.statusCode));
      }
      let got = 0;
      const out = fs.createWriteStream(dest);
      res.on('data', (c) => { got += c.length; });
      res.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => resolve(got));
      res.pipe(out);
    });
    req.on('timeout', () => req.destroy(new Error('分块超时')));
    req.on('error', reject);
  });
}

/* 分块并发下载：4MB 小片 + 动态队列，谁先下完谁抢下一片，慢连接不会拖长尾；单片失败重试 3 次 */
const FAST_CHUNK = 4 * 1024 * 1024;
const FAST_THREADS = 8;

async function downloadFast(url, dest, onProgress) {
  let total = 0;
  try { total = await probeTotal(url); } catch (_) { return downloadTo(url, dest, onProgress); }
  if (!total) return downloadTo(url, dest, onProgress);
  const pieces = [];
  for (let s = 0; s < total; s += FAST_CHUNK) pieces.push([s, Math.min(total - 1, s + FAST_CHUNK - 1)]);
  const partFiles = pieces.map((_, i) => path.join(updDir(), 'bfpart' + i + '.bin'));
  let got = 0;
  let failed = false;
  const tick = (n) => { got += n; if (onProgress) onProgress(got, total); };
  let cursor = 0;
  const worker = async () => {
    while (!failed && cursor < pieces.length) {
      const i = cursor++;
      const s = pieces[i][0], en = pieces[i][1];
      let done = false;
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        try {
          const n = await fetchRange(url, s, en, partFiles[i]);
          tick(n);
          done = true;
        } catch (err) {
          if (attempt === 2) { failed = true; throw err; }
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(FAST_THREADS, pieces.length) }, () => worker()));
  } catch (_) {
    for (const p of partFiles) { try { fs.rmSync(p, { force: true }); } catch (e) {} }
    return downloadTo(url, dest, onProgress);
  }
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    let i = 0;
    const next = () => {
      if (i >= partFiles.length) { out.end(); return; }
      const idx = i;
      i += 1;
      const rs = fs.createReadStream(partFiles[idx]);
      rs.pipe(out, { end: false });
      rs.on('end', () => { try { fs.rmSync(partFiles[idx], { force: true }); } catch (e) {} next(); });
      rs.on('error', reject);
    };
    out.on('finish', resolve);
    out.on('error', reject);
    next();
  });
  const st = fs.statSync(dest);
  if (st.size !== total) throw new Error('下载不完整：' + st.size + '/' + total + ' 字节');
  return total;
}

/* GitHub Releases 源：github:owner/repo[@tag]、github.com/owner/repo、api.github.com/repos/... */
function parseGithubSource(src) {
  if (!src) return null;
  let m = src.match(/^github:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:@([^\s]+))?$/);
  if (m) return { owner: m[1], repo: m[2], tag: m[3] || '' };
  m = src.match(/^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\/releases(?:\/tag\/([^\/?#]+))?)?\/?(?:[?#].*)?$/);
  if (m) return { owner: m[1], repo: m[2], tag: m[3] ? decodeURIComponent(m[3]) : '' };
  m = src.match(/^https?:\/\/api\.github\.com\/repos\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\/releases(?:\/latest|\/tags\/([^\/?#]+))?)?\/?(?:[?#].*)?$/);
  if (m) return { owner: m[1], repo: m[2], tag: m[3] ? decodeURIComponent(m[3]) : '' };
  return null;
}

function stripHtml(html) {
  let t = String(html || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
  t = t
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/(li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

async function checkGithub(gh, token) {
  const apiBase = `https://api.github.com/repos/${gh.owner}/${gh.repo}`;
  const headers = { 'User-Agent': 'BladeForge-Updater', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = 'Bearer ' + token;

  let tag = gh.tag || '';
  let notes = '';
  let channel = 'stable';
  let assetUrl = '';
  let assetApi = '';
  let size = 0;
  let apiError = '';

  try {
    const relUrl = tag ? `${apiBase}/releases/tags/${encodeURIComponent(tag)}` : `${apiBase}/releases/latest`;
    const rel = JSON.parse(await fetchText(relUrl, 0, headers));
    tag = rel.tag_name || tag;
    notes = stripHtml(rel.body || '').slice(0, 1200);
    channel = rel.prerelease ? 'beta' : 'stable';
    const zips = (rel.assets || []).filter((a) => /\.zip$/i.test(a.name || ''));
    const pick = zips.find((a) => /BladeForge/i.test(a.name)) || zips[0];
    if (pick) {
      assetUrl = pick.browser_download_url;
      size = Number(pick.size || 0);
      assetApi = pick.url || '';
    }
  } catch (e) {
    apiError = String((e && e.message) || e);
  }

  if (!tag) {
    const feed = await fetchText(`https://github.com/${gh.owner}/${gh.repo}/releases.atom`);
    const entries = feed.split('<entry>').slice(1);
    for (const ent of entries) {
      const tm = ent.match(/releases\/tag\/([^"]+)"/);
      const tg = tm ? decodeURIComponent(tm[1]) : '';
      if (!tg) continue;
      if (/-(alpha|beta|rc|nightly|snapshot)/i.test(tg)) continue;
      tag = tg;
      const cm = ent.match(/<content[^>]*>([\s\S]*?)<\/content>/);
      if (cm) notes = stripHtml(cm[1]).slice(0, 1200);
      break;
    }
  }

  if (!tag) throw new Error(apiError ? '读不到 release：' + apiError : '这个仓库还没有发布 release');

  /* 两个工具共用一个仓库，tag 是工坊版本号；建模器的版本必须以附件名里的版本为准，
     否则会把工坊的 1.14.x 当成"新版本"，还可能装错包。 */
  let version = String(tag).replace(/^v/i, '');
  if (size && assetUrl) {
    const m = String(assetUrl).match(/BladeForge-([0-9][0-9A-Za-z.]*)-Windows/i);
    if (m) version = m[1];
  }
  if (!/^[0-9]/.test(version)) throw new Error(`release tag「${tag}」不像版本号，建议用 v1.14.2 这种格式`);
  if (!assetUrl) {
    // 没拿到资产信息时的约定地址：附件名固定为 BladeForge-<版本>-Windows-x64.zip
    assetUrl = `https://github.com/${gh.owner}/${gh.repo}/releases/download/${tag}/BladeForge-${version}-Windows-x64.zip`;
  }
  const current = app.getVersion();
  return {
    ok: true,
    current,
    newer: cmpVer(version, current) > 0,
    meta: { version, url: assetUrl, assetApi, size, notes, channel, via: assetUrl.includes('/releases/download/') ? 'github' : 'github-api' },
    hint: apiError && assetUrl.includes('/releases/download/') ? 'GitHub API 不可用（' + apiError + '），按约定地址拼的下载链接' : '',
  };
}

ipcMain.handle('update:state', () => {
  const cfg = readUpdCfg();
  const failMark = path.join(os.tmpdir(), 'blade-forge-update', 'fail.txt');
  let lastFail = '';
  try {
    if (fs.existsSync(failMark)) {
      lastFail = '上一次升级时覆盖安装目录失败（多半是权限问题）。日志在 ' + path.join(os.tmpdir(), 'blade-forge-update', 'apply.log');
      fs.rmSync(failMark, { force: true });
    }
  } catch (_) {}
  return {
    token: cfg.token || '',
    lastFail,
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
    source: (!cfg.source || cfg.source === LEGACY_UPDATE_SOURCE) ? DEFAULT_UPDATE_SOURCE : cfg.source,
    autoCheck: cfg.autoCheck !== false,
    lastCheck: cfg.lastCheck || 0,
  };
});

ipcMain.handle('update:save', (_e, patch) => {
  const next = writeUpdCfg(patch || {});
  return { ok: true, source: next.source || '', autoCheck: next.autoCheck !== false };
});

async function checkByList(src, cfg) {
  const text = await readListSource(src);
  const meta = JSON.parse(text);
  if (!meta.version) throw new Error('更新清单缺少 version 字段');
  let dl = meta.url || '';
  if (dl && !/^https?:|^file:/i.test(dl)) dl = new URL(dl, src).toString();
  return {
    ok: true,
    current: app.getVersion(),
    newer: cmpVer(meta.version, app.getVersion()) > 0,
    meta: {
      version: String(meta.version),
      url: dl,
      size: Number(meta.size || 0),
      notes: String(meta.notes || ''),
      sha256: String(meta.sha256 || ''),
      channel: String(meta.channel || 'stable'),
      delta: (() => {
        // 支持 delta 与 deltas 数组：清单可同时挂多个"从哪版升到哪版"的差异包
        const cands = [];
        if (meta.delta && meta.delta.url) cands.push(meta.delta);
        if (Array.isArray(meta.deltas)) for (const d of meta.deltas) if (d && d.url) cands.push(d);
        const pick = cands.find((d) => String(d.from || '') === app.getVersion()) || null;
        if (!pick) return null;
        let u = String(pick.url);
        if (!/^https?:|^file:/i.test(u)) u = new URL(u, src).toString();
        return { from: String(pick.from || ''), url: u, size: Number(pick.size || 0), notes: String(pick.notes || '') };
      })(),
    },
  };
}

ipcMain.handle('update:check', async (_e, source) => {
  const cfg = readUpdCfg();
  const raw = String(source || cfg.source || '').trim();
  const auto = !raw || raw === LEGACY_UPDATE_SOURCE || raw === DEFAULT_UPDATE_SOURCE || raw === GITHUB_UPDATE_SOURCE;
  if (auto) {
    // 1) 先试 CDN 清单（快）
    try {
      const r = await checkByList(DEFAULT_UPDATE_SOURCE, cfg);
      if (r.newer) { writeUpdCfg({ source: DEFAULT_UPDATE_SOURCE, lastCheck: Date.now() }); return r; }
      // CDN 清单没更新时，再问 GitHub，谁新用谁
      const g = await checkGithub(parseGithubSource(GITHUB_UPDATE_SOURCE), cfg.token || process.env.GITHUB_TOKEN || '');
      if (g.ok && g.newer) { writeUpdCfg({ lastCheck: Date.now() }); return g; }
      writeUpdCfg({ source: DEFAULT_UPDATE_SOURCE, lastCheck: Date.now() });
      return r;
    } catch (e) {
      try {
        const g = await checkGithub(parseGithubSource(GITHUB_UPDATE_SOURCE), cfg.token || process.env.GITHUB_TOKEN || '');
        writeUpdCfg({ lastCheck: Date.now() });
        return g;
      } catch (e2) {
        writeUpdCfg({ lastCheck: Date.now() });
        return { ok: false, error: String((e && e.message) || e) };
      }
    }
  }
  const src = raw;
  const gh = parseGithubSource(src);
  if (gh) {
    try {
      const r = await checkGithub(gh, cfg.token || process.env.GITHUB_TOKEN || '');
      writeUpdCfg({ source: src, lastCheck: Date.now() });
      return r;
    } catch (e) {
      writeUpdCfg({ source: src, lastCheck: Date.now() });
      return { ok: false, error: String((e && e.message) || e) };
    }
  }
  try {
    const text = await readListSource(src);
    let meta;
    try {
      meta = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: '更新清单不是合法 JSON' };
    }
    if (!meta.version) return { ok: false, error: '更新清单缺少 version 字段' };
    let dl = meta.url || '';
    if (dl && !/^https?:|^file:/i.test(dl)) {
      if (/^https?:/i.test(src)) dl = new URL(dl, src).toString();
    }
    const newer = cmpVer(meta.version, app.getVersion()) > 0;
    writeUpdCfg({ source: src, lastCheck: Date.now() });
    return {
      ok: true,
      current: app.getVersion(),
      newer,
      meta: {
        version: String(meta.version),
        url: dl,
        size: Number(meta.size || 0),
        notes: String(meta.notes || ''),
        sha256: String(meta.sha256 || ''),
        channel: String(meta.channel || 'stable'),
      },
    };
  } catch (e) {
    writeUpdCfg({ source: src, lastCheck: Date.now() });
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('update:download', async (e, arg) => {
  try {
    const meta = typeof arg === 'string' ? { url: arg } : arg || {};
    if (!meta.url && !meta.assetApi) return { ok: false, error: '没有下载地址' };
    const cfg = readUpdCfg();
    const token = cfg.token || process.env.GITHUB_TOKEN || '';
    // 私有仓库的附件必须走 API 并带 token；公开仓库用浏览器地址就行
    let url = meta.url;
    let headers = null;
    // 增量包：清单里给了 from=当前版本 的差异包，就只下变了的那些文件
    let isDelta = false;
    let dSize = 0;
    const dCands = [];
    if (meta.delta && meta.delta.url) dCands.push(meta.delta);
    if (Array.isArray(meta.deltas)) for (const d of meta.deltas) if (d && d.url) dCands.push(d);
    const dPick = dCands.find((d) => String(d.from || '') === app.getVersion());
    if (dPick) {
      url = dPick.url;
      isDelta = true;
      dSize = Number(dPick.size || 0);
    }
    if (!isDelta && token && meta.assetApi && /api\.github\.com/i.test(meta.assetApi)) {
      url = meta.assetApi;
      headers = {
        Authorization: 'Bearer ' + token,
        Accept: 'application/octet-stream',
        'User-Agent': 'BladeForge-Updater',
      };
    }
    fs.mkdirSync(updDir(), { recursive: true });
    const dest = path.join(updDir(), 'BladeForge-update' + (isDelta ? '-delta' : '') + '.zip');
    // 秒装：上次已经下完（大小一致）就直接用，不重下
    try {
      const want = Number(isDelta ? (dSize || (meta.delta && meta.delta.size) || 0) : (meta.size || 0));
      if (want > 0 && fs.existsSync(dest) && fs.statSync(dest).size === want) {
        return { ok: true, path: dest, bytes: want, cached: true, delta: isDelta };
      }
    } catch (_) {}
    let lastEmit = 0, lastGot = 0, spd = 0;
    const onProg = (got, total) => {
      const now = Date.now();
      // 节流：IPC 太密会反过来拖慢下载
      if (now - lastEmit < 120 && got < total) return;
      if (lastEmit && now > lastEmit) spd = (got - lastGot) / ((now - lastEmit) / 1000);
      lastEmit = now; lastGot = got;
      try {
        e.sender.send('update:progress', { phase: 'download', got, total, pct: total ? got / total : 0, speed: spd });
      } catch (_) {}
    };
    let bytes;
    try {
      bytes = headers ? await downloadTo(url, dest, onProg) : await downloadFast(url, dest, onProg);
    } catch (err) {
      // 增量包下砸了就退回整包，别让用户卡住
      if (isDelta) {
        isDelta = false;
        const full = path.join(updDir(), 'BladeForge-update.zip');
        bytes = await downloadFast(meta.url, full, onProg);
        return { ok: true, path: full, bytes, delta: false, fallback: true };
      }
      throw err;
    }
    return { ok: true, path: dest, bytes, delta: isDelta };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

// 流式 CRC32：小文件比对内容用，避免"大小相同但内容不同"漏更新
function crc32File(p) {
  return new Promise((resolve, reject) => {
    let crc = -1;
    const rs = fs.createReadStream(p);
    rs.on('data', (b) => {
      for (let i = 0; i < b.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b[i]) & 0xff];
    });
    rs.on('end', () => resolve((crc ^ -1) >>> 0));
    rs.on('error', reject);
  });
}

// 上次更新留下的"该删的旧文件"清单：启动时清一遍（bat 里删不掉的兜底）
function applyPendingPrune() {
  const f = path.join(updDir(), 'to-prune.json');
  if (!fs.existsSync(f)) return;
  try {
    const list = JSON.parse(fs.readFileSync(f, 'utf8'));
    const base = path.dirname(app.getPath('exe'));
    let n = 0;
    for (const rel of (Array.isArray(list) ? list : [])) {
      try {
        if (rel && !/^\.\./.test(rel)) { fs.rmSync(path.join(base, rel), { force: true }); n++; }
      } catch (e) {}
    }
    fs.rmSync(f, { force: true });
    console.log('[prune] 清掉旧文件 ' + n + ' 个');
  } catch (e) {
    try { fs.rmSync(f, { force: true }); } catch (_) {}
  }
}

// 解压 zip 到临时目录，返回可覆盖的文件根目录
async function stageZip(zipPath, appDir, onProg) {
  // Electron 的 fs 代理会把任何 *.asar 当成包去解析，写 app.asar 时要用纯 fs
  const prevNoAsar = process.noAsar;
  process.noAsar = true;
  try {
    return await stageZipInner(zipPath, appDir, onProg);
  } finally {
    process.noAsar = prevNoAsar;
  }
}

async function stageZipInner(zipPath, appDir, onProg) {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const entries = Object.keys(zip.files);
  const exeEntry = entries.find((n) => /(^|\/)BladeForge\.exe$/i.test(n));
  // 增量包只含变了的文件，可能不含主程序；没有 exe 时按第一层目录推前缀
  let rootPrefix = '';
  if (exeEntry) {
    rootPrefix = exeEntry.slice(0, exeEntry.length - 'BladeForge.exe'.length);
  } else {
    const first = entries.find((n) => n.includes('/')) || '';
    const idx = first.indexOf('/');
    rootPrefix = idx > 0 ? first.slice(0, idx + 1) : '';
  }
  const stage = path.join(updDir(), 'stage-' + Date.now());
  fs.mkdirSync(stage, { recursive: true });
  // 增量解压：磁盘上已有的同尺寸文件直接跳过，只解真正变了的那几个（asar 等）
  const canDiff = !!appDir && fs.existsSync(appDir);
  let count = 0, skipped = 0, done = 0;
  let prune = null;
  for (const name of entries) {
    const entry = zip.files[name];
    const rel = rootPrefix && name.startsWith(rootPrefix) ? name.slice(rootPrefix.length) : name;
    if (!rel) continue;
    done++;
    if (onProg) onProg(done, entries.length, skipped);
    if (rel === '_prune.txt' && !entry.dir) {
      prune = String((await entry.async('nodebuffer')).toString('utf8')).split('\n').map((x) => x.trim()).filter(Boolean);
      // 照常解压到 stage，替换脚本要靠这个文件逐个删旧文件
    }
    if (entry.dir) { fs.mkdirSync(path.join(stage, rel), { recursive: true }); continue; }
    const usz = entry._data && entry._data.uncompressedSize != null ? entry._data.uncompressedSize : -1;
    const crc = entry._data && entry._data.crc32 != null ? entry._data.crc32 : -1;
    if (canDiff && usz >= 0) {
      try {
        const fp = path.join(appDir, rel);
        const cur = fs.statSync(fp);
        if (cur.isFile() && cur.size === usz) {
          // 大文件（主程序 exe）只比大小：同版本 Electron 的壳功能一致，读 180MB 不划算
          if (usz > 32 * 1048576 || crc < 0 || (await crc32File(fp)) === crc) { skipped++; continue; }
        }
      } catch (_) {}
    }
    const out = path.join(stage, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const buf = await entry.async('nodebuffer');
    fs.writeFileSync(out, buf);
    count++;
  }
  const exe = path.join(stage, 'BladeForge.exe');
  // 主程序同版本时会被跳过，此时沿用安装目录里已有的 exe
  if (!fs.existsSync(exe) && !(appDir && fs.existsSync(path.join(appDir, 'BladeForge.exe')))) throw new Error('解压后没找到 BladeForge.exe');
  return { stage, count, skipped, prune, exe };
}

// 生成替换脚本：等本进程退出 → robocopy 覆盖 → 重启；全程写日志，失败留标记
function buildUpdateBat(stage, appDir, prune) {
  const base = path.join(os.tmpdir(), 'blade-forge-update');
  const log = path.join(base, 'apply.log');
  const failMark = path.join(base, 'fail.txt');
  return [
    '@echo off',
    'chcp 65001 >nul',
    'set "SRC=' + stage + '"',
    'set "DST=' + appDir + '"',
    'set "LOG=' + log + '"',
    'echo [start] %DATE% %TIME% >>"%LOG%"',
    'echo   src=%SRC% >>"%LOG%"',
    'echo   dst=%DST% >>"%LOG%"',
    ':wait',
    'tasklist /FI "IMAGENAME eq BladeForge.exe" /NH 2>nul | find /I "BladeForge.exe" >nul',
    'if not errorlevel 1 (',
    '  timeout /t 2 /nobreak >nul',
    '  goto wait',
    ')',
    'echo [prune] %DATE% %TIME% >>"%LOG%"',
    'if exist "%SRC%\\_prune.txt" for /f "usebackq delims=" %%L in ("%SRC%\\_prune.txt") do del /f /q "%DST%\\%%L" 2>nul',
    'echo [locale] %DATE% %TIME% >>"%LOG%"',
    'for %%F in ("%DST%\\locales\\*.pak") do (echo %%~nxF | findstr /I /R /C:"zh-CN.pak" /C:"zh-TW.pak" /C:"en-US.pak" /C:"en-GB.pak" >nul || del /f /q "%%F")',
    'echo [copy] %DATE% %TIME% >>"%LOG%"',
    'robocopy "%SRC%" "%DST%" /E /MT:16 /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >>"%LOG%" 2>&1',
    'if exist "%DST%\\BladeForge.exe" (',
    '  echo [ok] %DATE% %TIME% >>"%LOG%"',
    ') else (',
    '  echo [failed] robocopy exit %ERRORLEVEL% >>"%LOG%"',
    '  echo failed >"' + failMark + '"',
    ')',
    'start "" "%DST%\\BladeForge.exe" >>"%LOG%" 2>&1',
    'timeout /t 2 /nobreak >nul',
    'rmdir /s /q "%SRC%" 2>nul',
    'del "%~f0"',
  ].join('\r\n');
}

async function applyUpdateInstall(zipPath, sender) {
  try {
    if (!zipPath) return { ok: false, error: '没有更新包路径' };
    let appDir = '';
    try {
      appDir = path.dirname(app.getPath('exe'));
    } catch (e) {}
    let lastEmit = 0;
    const onProg = (done, total, skipped) => {
      const now = Date.now();
      if (now - lastEmit < 150 && done < total) return;
      lastEmit = now;
      try {
        (sender || {}).send && sender.send('update:progress', { phase: 'extract', done, total, skipped, pct: total ? done / total : 0 });
      } catch (_) {}
    };
    let staged;
    try {
      staged = await stageZip(zipPath, appDir, onProg);
    } catch (e) {
      return { ok: false, error: '解压更新包失败：' + String((e && e.message) || e) };
    }
    let { stage, count, skipped, prune, exe } = staged;

    if (process.platform !== 'win32') {
      return { ok: false, error: '自动替换目前只支持 Windows；更新包已解压在临时目录，可以手动替换', stage, count, appDir };
    }
    if (!app.isPackaged) {
      return { ok: false, error: '开发模式下不能自动替换，已解压到临时目录供测试', stage, count, appDir };
    }

    // 顺手清掉旧版遗留的多余语言包（新版只带中英繁三个）
    if (!Array.isArray(prune)) prune = [];
    try {
      const loc = path.join(appDir, 'locales');
      if (fs.existsSync(loc)) {
        for (const f of fs.readdirSync(loc)) {
          if (/\.pak$/i.test(f) && !/^(zh-CN|zh-TW|en-US|en-GB)\.pak$/i.test(f)) prune.push('locales/' + f);
        }
      }
    } catch (e) {}
    if (prune && prune.length) {
      try { fs.writeFileSync(path.join(updDir(), 'to-prune.json'), JSON.stringify(prune), 'utf8'); } catch (e) {}
    }
    const base = path.join(os.tmpdir(), 'blade-forge-update');
    const bat = path.join(base, 'ApplyUpdate.bat');
    try {
      fs.rmSync(path.join(base, 'apply.log'), { force: true });
      fs.rmSync(path.join(base, 'fail.txt'), { force: true });
    } catch (_) {}
    const body = buildUpdateBat(stage, appDir, prune);
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(bat, body, 'utf8');

    const { spawn } = require('child_process');
    const child = spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    setTimeout(() => app.quit(), 800);
    return { ok: true, count, skipped, appDir, stage, restart: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

ipcMain.handle('update:install', (e, zipPath) => applyUpdateInstall(zipPath, e.sender));

ipcMain.handle('update:openLogDir', () => {
  const dir = path.join(os.tmpdir(), 'blade-forge-update');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return shell.openPath(dir);
});

ipcMain.handle('update:pickZip', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: '选择工坊更新包',
    filters: [{ name: '更新包', extensions: ['zip'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});
