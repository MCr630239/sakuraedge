const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveObj: (name, text) => ipcRenderer.invoke('file:saveObj', { name, text }),
  savePng: (name, dataUrl) => ipcRenderer.invoke('file:savePng', { name, dataUrl }),
  saveProject: (name, text) => ipcRenderer.invoke('project:save', { name, text }),
  openSes: () => ipcRenderer.invoke('ses:open'),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveBundle: (payload) => ipcRenderer.invoke('bundle:save', payload),
  saveJar: (payload) => ipcRenderer.invoke('jar:save', payload),
  saveSes: (name, text) => ipcRenderer.invoke('file:saveSes', { name, text }),
  pickObj: () => ipcRenderer.invoke('obj:pick'),
  readObj: (p) => ipcRenderer.invoke('obj:read', p),
  info: () => ipcRenderer.invoke('app:info'),
  openUrl: (url) => ipcRenderer.invoke('shell:openUrl', url),
  updateState: () => ipcRenderer.invoke('update:state'),
  updateSave: (patch) => ipcRenderer.invoke('update:save', patch),
  updateCheck: (source) => ipcRenderer.invoke('update:check', source),
  updateDownload: (meta) => ipcRenderer.invoke('update:download', meta),
  updateInstall: (zipPath) => ipcRenderer.invoke('update:install', zipPath),
  updatePickZip: () => ipcRenderer.invoke('update:pickZip'),
  updateOpenLogDir: () => ipcRenderer.invoke('update:openLogDir'),
  onUpdateProgress: (handler) => ipcRenderer.on('update:progress', (_e, payload) => handler(payload)),
});
