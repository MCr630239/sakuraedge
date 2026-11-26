const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const exporter = require('./exporter');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: process.env.DEMO ? 1600 : 1560,
    height: process.env.DEMO ? 1000 : 980,
    frame: process.env.DEMO ? false : true,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#0d0f15',
    title: '樱刃工坊 · Sakura Edge Studio',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('render-process-gone', (_e, details) => console.log('[renderer gone]', details));
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  if (process.env.LOG) win.webContents.on('console-message', (_e, _l, m) => console.log('[r]', m));

  if (process.env.DEMO) {
    win.webContents.on('did-finish-load', () => {
      const at = (ms, js) => setTimeout(() => { win.webContents.executeJavaScript(js).catch(() => {}); }, ms + 7000);
      const tab = (t) => `document.querySelector('#tabs button[data-tab="${t}"]')?.click()`;
      at(1400, tab('stats'));
      at(4200, `document.querySelector('[data-arts="sakura"]')?.click()`);
      at(9200, `document.querySelector('[data-ench-set="soul"]')?.click()`);
      at(14500, tab('doc'));
      at(15600, `document.querySelector('.doc-sec:nth-child(5)')?.scrollIntoView({block:'start'})`);
      at(22000, tab('stats'));
      at(23000, `document.querySelector('[data-type="FIERCEREDGE"]')?.click()`);
      at(27500, tab('base'));
      at(32000, tab('stats'));
    });
  }

  // 调试用：SHOT=路径 启动时截一张图后退出
  if (process.env.SHOT) {
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          if (process.env.SAMPLEJAR) {
            const project = await win.webContents.executeJavaScript('window.__serialize()');
            const { buffer } = await require('./exporter').buildModJar(project);
            require('fs').writeFileSync(process.env.SAMPLEJAR, buffer);
            console.log('[sample] written', process.env.SAMPLEJAR);
          }
          if (process.env.JSINJECT) {
            try {
              const r = await win.webContents.executeJavaScript(process.env.JSINJECT);
              console.log('[jsinject]', typeof r === 'string' ? r : JSON.stringify(r));
            } catch (err) {
              console.log('[jsinject error]', String(err && err.message || err));
            }
            await new Promise((r) => setTimeout(r, 400));
          }
          if (process.env.MODE) {
            await win.webContents.executeJavaScript(`document.querySelector('#modeGroup button[data-mode="${process.env.MODE}"]')?.click()`);
            await new Promise((r) => setTimeout(r, 500));
          }
          if (process.env.SELECT) {
            await win.webContents.executeJavaScript(`document.querySelector('.blade-item[data-id="${process.env.SELECT}"]')?.click()`);
            await new Promise((r) => setTimeout(r, 300));
          }
          if (process.env.MODELER) {
            await win.webContents.executeJavaScript(`document.querySelector('#btnModeler')?.click()`);
          }
          if (process.env.MODELER && process.env.MDLDIAG) {
            const j = await win.webContents.executeJavaScript(`JSON.stringify((window.__mdlScene||{children:[]}).children.map(o=>({t:o.type,n:o.name,v:o.visible,k:o.children.length,opa:o.material&&o.material.opacity,geo:o.geometry?o.geometry.attributes.position.count:0})))`);
            console.log('[mdl]', j);
          }
          if (process.env.MDLPRESET) {
            await win.webContents.executeJavaScript(`document.querySelector('.mdl-chips [data-preset="${process.env.MDLPRESET}"]')?.click()`);
          }
          if (process.env.MDLACT) {
            for (const a of process.env.MDLACT.split(',')) {
              await win.webContents.executeJavaScript(`document.querySelector('button[data-mdl="${a.trim()}"]')?.click()`);
              await new Promise((r) => setTimeout(r, 400));
            }
          }
          if (process.env.SATEST) {
            await win.webContents.executeJavaScript(`(() => {
              document.querySelector('#tabs button[data-tab="stats"]')?.click();
              const mode = '${process.env.SATEST}';
              const sel = document.querySelector('[data-sa]');
              if (sel) {
                if (mode === 'empty') { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
                else { sel.value = 'custom'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
              }
              const inp = document.querySelector('[data-sa-custom]');
              if (inp && mode !== 'empty') { inp.value = 'slb:ex_sa'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
              return JSON.stringify({ sa: (window.__serialize().blades[0] || {}).slashArt });
            })()`).then((r) => console.log('[satest]', r)).catch((e) => console.log('[satest] fail', e.message));
            await new Promise((r) => setTimeout(r, 300));
          }
          if (process.env.ARTSTEST) {
            const r = await win.webContents.executeJavaScript(`(() => {
              document.querySelector('#tabs button[data-tab="stats"]')?.click();
              const c = document.querySelector('.chips [data-arts="${process.env.ARTSTEST}"]');
              if (!c) return 'no-chip';
              c.click();
              const anchor = document.querySelector('[data-ench-set]');
              if (anchor) anchor.scrollIntoView({ block: 'center' });
              const b = window.__serialize().blades[0];
              return JSON.stringify({ sa: b.slashArt, color: b.summonColor, types: b.types, ench: b.enchants, effects: b.effects });
            })()`);
            console.log('[arts]', r);
          }
          if (process.env.CATALOG) {
            const html = await win.webContents.executeJavaScript('window.__catalogHtml()');
            require('fs').writeFileSync(process.env.CATALOG, html, 'utf8');
            console.log('[catalog]', process.env.CATALOG, html.length);
          }
          if (process.env.LOADSES) {
            const raw = require('fs').readFileSync(process.env.LOADSES, 'utf8');
            await win.webContents.executeJavaScript(`window.__loadProject(${raw})`);
            await new Promise((r) => setTimeout(r, 700));
            console.log('[loadses]', await win.webContents.executeJavaScript(`JSON.stringify({ blades: window.__serialize().blades.length, id: window.__serialize().blades[0].id, obj: window.__serialize().blades[0].modelData.length, tex: window.__serialize().blades[0].textureData.length })`));
          }
          if (process.env.ENCHSTEST) {
            const r2 = await win.webContents.executeJavaScript(`(() => {
              document.querySelector('#tabs button[data-tab="stats"]')?.click();
              const c = document.querySelector('[data-ench-set="${process.env.ENCHSTEST}"]');
              if (!c) return 'no-chip';
              c.click();
              const b = window.__serialize().blades[0];
              return JSON.stringify({ n: (b.enchants || []).length, sets: document.querySelectorAll('[data-ench-set]').length, quicks: document.querySelectorAll('[data-ench-quick]').length, ench: b.enchants.slice(0, 3) });
            })()`);
            console.log('[enchset]', r2);
          }
          if (process.env.SAMPLEJAR2) {
            const project2 = await win.webContents.executeJavaScript('window.__serialize()');
            const r2 = await require('./exporter').buildModJar(project2);
            require('fs').writeFileSync(process.env.SAMPLEJAR2, r2.buffer);
            console.log('[sample2] written', process.env.SAMPLEJAR2);
          }
          if (process.env.TAB) {
            await win.webContents.executeJavaScript(`document.querySelector('#tabs button[data-tab="${process.env.TAB}"]')?.click()`);
            await new Promise((r) => setTimeout(r, 400));
          }
          if (process.env.SCROLL) {
            await win.webContents.executeJavaScript(`document.querySelector('${process.env.SCROLL}')?.scrollIntoView({ block: 'start' })`);
            await new Promise((r) => setTimeout(r, 400));
          }
          const diag = await win.webContents.executeJavaScript(`(() => ({
            ready: document.readyState,
            status: document.getElementById('statusText')?.textContent,
            blades: document.getElementById('bladeList')?.children.length,
            scripts: [...document.scripts].map(s => s.src || 'inline'),
            hasApi: typeof window.api,
            canvas: (() => { const c = document.getElementById('view'); return { cw: c.clientWidth, ch: c.clientHeight, w: c.width, h: c.height }; })(),
            preview: (window.__previewDiag && window.__previewDiag()) || null,
            errors: window.__errs || null
          }))()`);
          console.log('[diag]', JSON.stringify(diag));
          const dataUrl = await win.webContents.executeJavaScript(`(window.__previewShot && window.__previewShot()) || document.getElementById('view').toDataURL('image/png')`);
          fs.writeFileSync(process.env.SHOT.replace('.png', '-canvas.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
          await win.webContents.debugger.attach('1.3');
          const shot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true });
          fs.writeFileSync(process.env.SHOT, Buffer.from(shot.data, 'base64'));
          win.webContents.debugger.detach();
          console.log('[shot] saved', process.env.SHOT);
        } catch (err) {
          console.error('[shot] failed', err);
        }
        app.quit();
      }, 2600);
    });
  }
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '打开工程…', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu:open') },
        { label: '保存工程…', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu:save') },
        { type: 'separator' },
        { label: '导出附属包 jar…', accelerator: 'CmdOrCtrl+E', click: () => win.webContents.send('menu:export') },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '新建刀', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:newBlade') },
        { label: '复制当前刀', click: () => win.webContents.send('menu:dupBlade') },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  if (process.env.UPD_PRINT_BAT) {
    console.log('[bat-print]');
    console.log(buildUpdateBat(process.env.UPD_PRINT_BAT, process.env.UPD_PRINT_DST || 'D:\\Tools\\SakuraEdgeStudio'));
    return app.quit();
  }
  if (process.env.UPD_TEST_ZIP) {
    const r = await applyUpdateInstall(process.env.UPD_TEST_ZIP);
    console.log('[upd-test]', JSON.stringify(r));
    return app.quit();
  }
  createWindow();
  buildMenu();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- IPC ---------- */

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  electron: process.versions.electron,
}));

ipcMain.handle('builtin:assets', () => {
  const p = path.join(app.getAppPath(), 'src', 'renderer', 'builtin.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: '打开工坊工程',
    filters: [{ name: '樱刃工坊工程', extensions: ['ses', 'json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const raw = fs.readFileSync(res.filePaths[0], 'utf8');
  return { path: res.filePaths[0], project: JSON.parse(raw) };
});

ipcMain.handle('project:save', async (_e, project) => {
  const res = await dialog.showSaveDialog(win, {
    title: '保存工坊工程',
    defaultPath: `${project.namespace || 'blade'}-project.ses`,
    filters: [{ name: '樱刃工坊工程', extensions: ['ses'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, JSON.stringify(project, null, 2), 'utf8');
  return res.filePath;
});

ipcMain.handle('file:importModel', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: '导入刀模型（OBJ）',
    filters: [{ name: 'Wavefront OBJ', extensions: ['obj'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const p = res.filePaths[0];
  return { name: path.basename(p), data: fs.readFileSync(p, 'utf8') };
});

ipcMain.handle('file:importTexture', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: '导入贴图（PNG）',
    filters: [{ name: 'PNG 贴图', extensions: ['png'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const p = res.filePaths[0];
  const b64 = fs.readFileSync(p).toString('base64');
  return { name: path.basename(p), data: `data:image/png;base64,${b64}` };
});

ipcMain.handle('file:saveObj', async (_e, { name, text }) => {
  const res = await dialog.showSaveDialog(win, {
    title: '导出刀模型（OBJ）',
    defaultPath: name || 'blade.obj',
    filters: [{ name: 'Wavefront OBJ', extensions: ['obj'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, text, 'utf8');
  return res.filePath;
});

ipcMain.handle('file:savePng', async (_e, { name, dataUrl }) => {
  const res = await dialog.showSaveDialog(win, {
    title: '导出贴图（PNG）',
    defaultPath: name || 'blade.png',
    filters: [{ name: 'PNG 贴图', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const b64 = String(dataUrl || '').split(',')[1] || '';
  fs.writeFileSync(res.filePath, Buffer.from(b64, 'base64'));
  return res.filePath;
});

ipcMain.handle('file:saveHtml', async (_e, { name, text }) => {
  const res = await dialog.showSaveDialog(win, {
    title: '导出刀谱',
    defaultPath: name || 'blade-catalog.html',
    filters: [{ name: '网页', extensions: ['html'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, text, 'utf8');
  shell.openPath(res.filePath);
  return res.filePath;
});

ipcMain.handle('export:audit', async (_e, project) => {
  try {
    return { ok: true, rows: exporter.auditProject(project || {}) };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err), rows: [] };
  }
});

ipcMain.handle('export:jar', async (_e, project) => {
  const res = await dialog.showSaveDialog(win, {
    title: '导出拔刀剑附属包',
    defaultPath: `${project.namespace}-${(project.pack && project.pack.version) || '1.0.0'}.jar`,
    filters: [{ name: 'Minecraft 模组', extensions: ['jar'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const { buffer, warnings, selfChecks } = await exporter.buildModJar(project);
  fs.writeFileSync(res.filePath, buffer);
  return { path: res.filePath, warnings, selfChecks: selfChecks || [], size: buffer.length };
});

ipcMain.handle('export:packs', async (_e, project) => {
  const res = await dialog.showOpenDialog(win, {
    title: '选择导出目录（资源包 + 数据包）',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const dir = res.filePaths[0];
  const rp = await exporter.buildResourcePack(project);
  const dp = await exporter.buildDataPack(project);
  const rpPath = path.join(dir, `${project.namespace}-resourcepack.zip`);
  const dpPath = path.join(dir, `${project.namespace}-datapack.zip`);
  fs.writeFileSync(rpPath, rp);
  fs.writeFileSync(dpPath, dp);
  return { dir, rpPath, dpPath };
});

// 分刀出包：每把刀单独打一个 jar，放到同一个目录，附 index.txt
ipcMain.handle('export:split', async (_e, project) => {
  let dir = process.env.SPLIT_DIR || '';
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
  } else {
    const res = await dialog.showOpenDialog(win, {
      title: '选择分刀出包目录（每把刀一个 jar）',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    dir = res.filePaths[0];
  }
  const ver = (project.pack && project.pack.version) || '1.0.0';
  const files = [];
  const failed = [];
  const index = [];
  const selfChecks = [];
  for (const b of (project.blades || [])) {
    try {
      const sub = Object.assign({}, project, { blades: [b] });
      if (b.recipe && b.recipe.type === 'upgrade') {
        const src = (project.blades || []).find((x) => x.id === b.recipe.source);
        // 源刀在本工程里才保留强化配方；源刀不在同一份工程里就不带配方，避免出空配方
        if (!src) sub.blades = [Object.assign({}, b, { recipe: { type: 'none' } })];
      }
      const built = await exporter.buildModJar(sub);
      const name = `${project.namespace}-${exporter.slug(b.id)}-${ver}.jar`;
      const target = path.join(dir, name);
      fs.writeFileSync(target, built.buffer);
      files.push({ id: b.id, name, size: built.buffer.length });
      for (const r of (built.selfChecks || [])) selfChecks.push(r);
      index.push(`${b.id}  (${b.zh || b.en || ''})  ->  ${name}  ${(built.buffer.length / 1024).toFixed(0)} KB`);
    } catch (err) {
      failed.push({ id: b.id, error: String(err && err.message || err) });
      index.push(`${b.id}  导出失败：${err && err.message || err}`);
    }
  }
  const idxPath = path.join(dir, `${project.namespace}-分刀出包清单.txt`);
  fs.writeFileSync(idxPath, [`樱刃工坊 ${ver} · 分刀出包`, `工程：${project.pack && project.pack.name || project.namespace}`, `共 ${files.length} 把成功，${failed.length} 把失败`, '', ...index].join('\n'), 'utf8');
  return { dir, files, failed, idxPath, selfChecks };
});

ipcMain.handle('shell:open', (_e, target) => shell.openPath(target));

/* ---------- 自动更新 ---------- */
const os = require('os');
const http = require('http');
const https = require('https');
const JSZip = require('jszip');

const updDir = () => path.join(os.tmpdir(), 'sakura-edge-update');
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
      req = lib.get(url, { timeout: 20000, headers: headers || undefined }, (res) => {
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
  const headers = { 'User-Agent': 'SakuraEdgeStudio-Updater', Accept: 'application/vnd.github+json' };
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
    const pick = zips.find((a) => /SakuraEdgeStudio/i.test(a.name)) || zips[0];
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

  const version = String(tag).replace(/^v/i, '');
  if (!/^[0-9]/.test(version)) throw new Error(`release tag「${tag}」不像版本号，建议用 v1.14.2 这种格式`);
  if (!assetUrl) {
    // 没拿到资产信息时的约定地址：附件名固定为 SakuraEdgeStudio-<版本>-Windows-x64.zip
    assetUrl = `https://github.com/${gh.owner}/${gh.repo}/releases/download/${tag}/SakuraEdgeStudio-${version}-Windows-x64.zip`;
  }
  return {
    ok: true,
    current: app.getVersion(),
    newer: cmpVer(version, app.getVersion()) > 0,
    meta: { version, url: assetUrl, assetApi, size, notes, channel, via: assetUrl.includes('/releases/download/') ? 'github' : 'github-api' },
    hint: apiError && assetUrl.includes('/releases/download/') ? 'GitHub API 不可用（' + apiError + '），按约定地址拼的下载链接' : '',
  };
}

ipcMain.handle('update:state', () => {
  const cfg = readUpdCfg();
  const failMark = path.join(os.tmpdir(), 'sakura-edge-update', 'fail.txt');
  let lastFail = '';
  try {
    if (fs.existsSync(failMark)) {
      lastFail = '上一次升级时覆盖安装目录失败（多半是权限问题）。日志在 ' + path.join(os.tmpdir(), 'sakura-edge-update', 'apply.log');
      fs.rmSync(failMark, { force: true });
    }
  } catch (_) {}
  return {
    token: cfg.token || '',
    lastFail,
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
    source: cfg.source || '',
    autoCheck: cfg.autoCheck !== false,
    lastCheck: cfg.lastCheck || 0,
  };
});

ipcMain.handle('update:save', (_e, patch) => {
  const next = writeUpdCfg(patch || {});
  return { ok: true, source: next.source || '', autoCheck: next.autoCheck !== false };
});

ipcMain.handle('update:check', async (_e, source) => {
  const cfg = readUpdCfg();
  const src = String(source || cfg.source || '').trim();
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
    if (token && meta.assetApi && /api\.github\.com/i.test(meta.assetApi)) {
      url = meta.assetApi;
      headers = {
        Authorization: 'Bearer ' + token,
        Accept: 'application/octet-stream',
        'User-Agent': 'SakuraEdgeStudio-Updater',
      };
    }
    fs.mkdirSync(updDir(), { recursive: true });
    const dest = path.join(updDir(), 'SakuraEdgeStudio-update.zip');
    const bytes = await downloadTo(url, dest, (got, total) => {
      try {
        e.sender.send('update:progress', { phase: 'download', got, total, pct: total ? got / total : 0 });
      } catch (_) {}
    }, 0, headers);
    return { ok: true, path: dest, bytes };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

// 解压 zip 到临时目录，返回可覆盖的文件根目录
async function stageZip(zipPath) {
  // Electron 的 fs 代理会把任何 *.asar 当成包去解析，写 app.asar 时要用纯 fs
  const prevNoAsar = process.noAsar;
  process.noAsar = true;
  try {
    return await stageZipInner(zipPath);
  } finally {
    process.noAsar = prevNoAsar;
  }
}

async function stageZipInner(zipPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const entries = Object.keys(zip.files);
  const exeEntry = entries.find((n) => /(^|\/)SakuraEdgeStudio\.exe$/i.test(n));
  if (!exeEntry) throw new Error('这个 zip 里没有 SakuraEdgeStudio.exe，不像工坊的更新包');
  const rootPrefix = exeEntry.slice(0, exeEntry.length - 'SakuraEdgeStudio.exe'.length);
  const stage = path.join(updDir(), 'stage-' + Date.now());
  fs.mkdirSync(stage, { recursive: true });
  let count = 0;
  for (const name of entries) {
    const entry = zip.files[name];
    const rel = rootPrefix && name.startsWith(rootPrefix) ? name.slice(rootPrefix.length) : name;
    if (!rel) continue;
    const out = path.join(stage, rel);
    if (entry.dir) {
      fs.mkdirSync(out, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const buf = await entry.async('nodebuffer');
    fs.writeFileSync(out, buf);
    count++;
  }
  const exe = path.join(stage, 'SakuraEdgeStudio.exe');
  if (!fs.existsSync(exe)) throw new Error('解压后没找到 SakuraEdgeStudio.exe');
  return { stage, count, exe };
}

// 生成替换脚本：等本进程退出 → robocopy 覆盖 → 重启；全程写日志，失败留标记
function buildUpdateBat(stage, appDir) {
  const base = path.join(os.tmpdir(), 'sakura-edge-update');
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
    'tasklist /FI "IMAGENAME eq SakuraEdgeStudio.exe" /NH 2>nul | find /I "SakuraEdgeStudio.exe" >nul',
    'if not errorlevel 1 (',
    '  timeout /t 2 /nobreak >nul',
    '  goto wait',
    ')',
    'echo [copy] %DATE% %TIME% >>"%LOG%"',
    'robocopy "%SRC%" "%DST%" /E /NFL /NDL /NJH /NJS /NP >>"%LOG%" 2>&1',
    'if exist "%DST%\\SakuraEdgeStudio.exe" (',
    '  echo [ok] %DATE% %TIME% >>"%LOG%"',
    ') else (',
    '  echo [failed] robocopy exit %ERRORLEVEL% >>"%LOG%"',
    '  echo failed >"' + failMark + '"',
    ')',
    'start "" "%DST%\\SakuraEdgeStudio.exe" >>"%LOG%" 2>&1',
    'timeout /t 2 /nobreak >nul',
    'rmdir /s /q "%SRC%" 2>nul',
    'del "%~f0"',
  ].join('\r\n');
}

async function applyUpdateInstall(zipPath) {
  try {
    if (!zipPath) return { ok: false, error: '没有更新包路径' };
    let staged;
    try {
      staged = await stageZip(zipPath);
    } catch (e) {
      return { ok: false, error: '解压更新包失败：' + String((e && e.message) || e) };
    }
    const { stage, count, exe } = staged;
    let appDir;
    try {
      appDir = path.dirname(app.getPath('exe'));
    } catch (e) {
      return { ok: false, error: '拿不到当前安装目录：' + String((e && e.message) || e), stage, count };
    }

    if (process.platform !== 'win32') {
      return { ok: false, error: '自动替换目前只支持 Windows；更新包已解压在临时目录，可以手动替换', stage, count, appDir };
    }
    if (!app.isPackaged) {
      return { ok: false, error: '开发模式下不能自动替换，已解压到临时目录供测试', stage, count, appDir };
    }

    const base = path.join(os.tmpdir(), 'sakura-edge-update');
    const bat = path.join(base, 'ApplyUpdate.bat');
    try {
      fs.rmSync(path.join(base, 'apply.log'), { force: true });
      fs.rmSync(path.join(base, 'fail.txt'), { force: true });
    } catch (_) {}
    const body = buildUpdateBat(stage, appDir);
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(bat, body, 'utf8');

    const { spawn } = require('child_process');
    const child = spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    setTimeout(() => app.quit(), 800);
    return { ok: true, count, appDir, stage, restart: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

ipcMain.handle('update:install', (_e, zipPath) => applyUpdateInstall(zipPath));

ipcMain.handle('update:openLogDir', () => {
  const dir = path.join(os.tmpdir(), 'sakura-edge-update');
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
