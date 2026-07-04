import { contextBridge, ipcRenderer } from 'electron';
import {
  CleanerApi,
  ExecuteItemsRequest,
  ExportPreviewRequest,
  ScanOptions,
  WindowAction,
} from '../shared/contracts';

const api: CleanerApi = {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (payload: ScanOptions) => ipcRenderer.invoke('scan-folder', payload),
  executeItems: (payload: ExecuteItemsRequest) => ipcRenderer.invoke('execute-items', payload),
  exportPreview: (payload: ExportPreviewRequest) => ipcRenderer.invoke('export-preview', payload),
  windowAction: (action: WindowAction) => ipcRenderer.invoke('window-action', action),
};

contextBridge.exposeInMainWorld('filePrefixCleaner', api);
