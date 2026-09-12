import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import {
  analyzeCornerbackDirections,
  type CornerbackDirectionAnalysisParams,
} from './components/cornerback-direction-analyzer';

const dataRoot = path.join(app.getAppPath(), 'NFL_DATA');

function createWindow(): void {
  const browser = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  void browser.loadFile(path.join(__dirname, '../movement.html'));
}

app.whenReady().then(() => {
  ipcMain.handle(
    'movement:analyse',
    (_event, options: Omit<CornerbackDirectionAnalysisParams, 'dataRoot'> = {}) =>
      analyzeCornerbackDirections({ ...options, dataRoot }),
  );
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
