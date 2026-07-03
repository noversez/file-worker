const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('filePrefixCleaner', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (payload) => ipcRenderer.invoke('scan-folder', payload),
  executeItems: (payload) => ipcRenderer.invoke('execute-items', payload),
});
