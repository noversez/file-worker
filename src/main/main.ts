import { app, BrowserWindow } from 'electron';
import { registerHandlers } from './ipc/registerHandlers';
import { createMainWindow } from './window/createMainWindow';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  registerHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
