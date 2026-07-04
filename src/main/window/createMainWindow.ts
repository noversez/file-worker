import { app, BrowserWindow } from 'electron';
import path from 'node:path';

export function createMainWindow(): BrowserWindow {
  const appPath = app.getAppPath();

  const window = new BrowserWindow({
    width: 1500,
    height: 1000,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#151922',
    autoHideMenuBar: true,
    frame: false,
    icon: path.join(appPath, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(appPath, 'build/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void window.loadFile(path.join(appPath, 'index.html'));
  return window;
}
