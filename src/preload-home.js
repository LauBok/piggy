const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('home', {
  act: (action, id) => ipcRenderer.send('home:act', action, id),
  ready: () => ipcRenderer.send('home:ready'),
  onState: (cb) => ipcRenderer.on('home:state', (_e, snap) => cb(snap)),
  onToast: (cb) => ipcRenderer.on('home:toast', (_e, t) => cb(t)),
  onTab: (cb) => ipcRenderer.on('home:tab', (_e, tab) => cb(tab)),
  minimize: () => ipcRenderer.send('home:min'),
  close: () => ipcRenderer.send('home:close'),
});
