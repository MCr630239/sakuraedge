const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  info: () => ipcRenderer.invoke('app:info'),
  builtinAssets: () => ipcRenderer.invoke('builtin:assets'),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  importModel: () => ipcRenderer.invoke('file:importModel'),
  importTexture: () => ipcRenderer.invoke('file:importTexture'),
  saveObj: (name, text) => ipcRenderer.invoke('file:saveObj', { name, text }),
  savePng: (name, dataUrl) => ipcRenderer.invoke('file:savePng', { name, dataUrl }),
  saveHtml: (name, text) => ipcRenderer.invoke('file:saveHtml', { name, text }),
  exportJar: (project) => ipcRenderer.invoke('export:jar', project),
  auditProject: (project) => ipcRenderer.invoke('export:audit', project),
  exportPacks: (project) => ipcRenderer.invoke('export:packs', project),
  exportSplit: (project) => ipcRenderer.invoke('export:split', project),
  openPath: (p) => ipcRenderer.invoke('shell:open', p),
  openUrl: (url) => ipcRenderer.invoke('shell:openUrl', url),
  updateState: () => ipcRenderer.invoke('update:state'),
  updateSave: (patch) => ipcRenderer.invoke('update:save', patch),
  updateCheck: (source) => ipcRenderer.invoke('update:check', source),
  updateDownload: (url) => ipcRenderer.invoke('update:download', url),
  updateInstall: (zipPath) => ipcRenderer.invoke('update:install', zipPath),
  updatePickZip: () => ipcRenderer.invoke('update:pickZip'),
  updateOpenLogDir: () => ipcRenderer.invoke('update:openLogDir'),
  onUpdateProgress: (handler) => ipcRenderer.on('update:progress', (_e, payload) => handler(payload)),
  onMenu: (channel, handler) => {
    const allowed = ['menu:open', 'menu:save', 'menu:export', 'menu:newBlade', 'menu:dupBlade'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, handler);
  },
});
