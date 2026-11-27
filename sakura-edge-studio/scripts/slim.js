// 打包后精简：删掉用不到的多语言包（Electron 默认 55 个，只留中英繁三个）
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2] || 'dist/BladeForge-win32-x64');
const KEEP = new Set(['zh-CN.pak', 'zh-TW.pak', 'en-US.pak', 'en-GB.pak']);
let saved = 0, removed = 0;
const loc = path.join(dir, 'locales');
if (fs.existsSync(loc)) {
  for (const f of fs.readdirSync(loc)) {
    if (KEEP.has(f)) continue;
    const p = path.join(loc, f);
    try { saved += fs.statSync(p).size; fs.rmSync(p); removed++; } catch (e) {}
  }
}
function walk(d) {
  let n = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    n += e.isDirectory() ? walk(p) : fs.statSync(p).size;
  }
  return n;
}
console.log('[slim] 删掉 ' + removed + ' 个语言包，省 ' + (saved / 1048576).toFixed(1) + ' MB；目录现在 ' + (walk(dir) / 1048576).toFixed(1) + ' MB');
