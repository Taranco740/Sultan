import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';

function createWindow() {
  const window = new BrowserWindow({
    width: 320,
    height: 420,
    minWidth: 320,
    maxWidth: 320,
    minHeight: 420,
    maxHeight: 420,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#090d11',
    title: 'TradeOS',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

