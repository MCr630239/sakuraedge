// 构建前置脚本：把 three.js 与 OBJLoader 复制到渲染进程目录，并把内置刀模型打包成 JSON
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vendor = path.join(root, 'src', 'renderer', 'vendor');
fs.mkdirSync(vendor, { recursive: true });

const threeSrc = path.join(root, 'node_modules', 'three', 'build', 'three.module.js');
const objLoaderSrc = path.join(root, 'node_modules', 'three', 'examples', 'jsm', 'loaders', 'OBJLoader.js');
const roomSrc = path.join(root, 'node_modules', 'three', 'examples', 'jsm', 'environments', 'RoomEnvironment.js');
fs.copyFileSync(threeSrc, path.join(vendor, 'three.module.js'));
fs.copyFileSync(path.join(root, 'node_modules', 'three', 'build', 'three.core.js'), path.join(vendor, 'three.core.js'));
fs.copyFileSync(objLoaderSrc, path.join(vendor, 'OBJLoader.js'));
fs.copyFileSync(roomSrc, path.join(vendor, 'RoomEnvironment.js'));
console.log('[prepare] three.js + OBJLoader copied');

// 内置刀模：assets/builtin/<name>/<name>.obj + 同目录贴图
// katana 的贴图按 katana_<配色>.png 命名，键名取配色名（shiro/moon/crimson）；其余目录用完整文件名
const builtinRoot = path.join(root, 'assets', 'builtin');
const builtin = { obj: '', textures: {}, models: {} };
for (const dir of fs.readdirSync(builtinRoot)) {
  const dirPath = path.join(builtinRoot, dir);
  if (!fs.statSync(dirPath).isDirectory()) continue;
  const files = fs.readdirSync(dirPath);
  const objFile = files.find((f) => f.endsWith('.obj'));
  if (!objFile) continue;
  const objText = fs.readFileSync(path.join(dirPath, objFile), 'utf8');
  builtin.models[dir] = { obj: objText };
  if (dir === 'katana') {
    builtin.obj = objText;
    for (const f of files) {
      if (f.endsWith('.png') && f.startsWith('katana_')) {
        builtin.textures[f.replace('katana_', '').replace('.png', '')] =
          'data:image/png;base64,' + fs.readFileSync(path.join(dirPath, f)).toString('base64');
      }
    }
  } else {
    for (const f of files) {
      if (!f.endsWith('.png')) continue;
      builtin.textures[f.replace('.png', '')] =
        'data:image/png;base64,' + fs.readFileSync(path.join(dirPath, f)).toString('base64');
    }
  }
}
fs.writeFileSync(path.join(root, 'src', 'renderer', 'builtin.json'), JSON.stringify(builtin));
console.log('[prepare] builtin.json written, models:', Object.keys(builtin.models).join(','), '| textures:', Object.keys(builtin.textures).join(','));

const { execFileSync } = require('child_process');
execFileSync(path.join(root, 'node_modules', '.bin', 'esbuild'), [
  path.join(root, 'src', 'renderer', 'app.js'),
  '--bundle',
  '--format=iife',
  '--target=chrome120',
  '--alias:three=' + path.join(root, 'src', 'renderer', 'vendor', 'three.module.js'),
  '--outfile=' + path.join(root, 'src', 'renderer', 'bundle.js'),
], { stdio: 'inherit' });
console.log('[prepare] renderer bundle built');
