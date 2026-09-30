import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('tradeosWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
});

