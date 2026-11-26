const { execFileSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
execFileSync(path.join(root, 'node_modules/.bin/esbuild'), [
  path.join(root, 'src/renderer/app.js'),
  '--bundle', '--format=iife', '--target=chrome120',
  '--alias:three=' + path.join(root, 'src/renderer/vendor/three.module.js'),
  '--outfile=' + path.join(root, 'src/renderer/bundle.js'),
], { stdio: 'inherit' });
console.log('[blade-forge] bundle built');
