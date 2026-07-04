import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import {
  CleanerAction,
  ExecuteItemsRequest,
  ExecuteItemsResult,
  ExportPreviewRequest,
  ExportPreviewResult,
  ScanOptions,
  ScanRow,
  WindowAction,
} from '../../shared/contracts';
import { executeRows, scanFolder } from '../application/fileWorkerService';

function sanitizeAction(action: unknown): CleanerAction {
  return action === 'delete' ? 'delete' : 'rename';
}

function sanitizeScanOptions(payload: Partial<ScanOptions> | undefined): ScanOptions {
  return {
    folder: typeof payload?.folder === 'string' ? payload.folder : '',
    prefixesText: typeof payload?.prefixesText === 'string' ? payload.prefixesText : '',
    recursive: Boolean(payload?.recursive),
    action: sanitizeAction(payload?.action),
  };
}

function sanitizeRows(rows: unknown): ScanRow[] {
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') as ScanRow[] : [];
}

function sanitizeExecuteRequest(payload: Partial<ExecuteItemsRequest> | undefined): ExecuteItemsRequest {
  return {
    rows: sanitizeRows(payload?.rows),
    action: sanitizeAction(payload?.action),
    scanOptions: sanitizeScanOptions(payload?.scanOptions),
  };
}

function csvCell(value: string | number | boolean): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function previewCsv(rows: ScanRow[], action: CleanerAction): string {
  const header = ['Action', 'Name', 'Prefix', 'Target name', 'Folder', 'Type', 'Path'];
  const lines = rows.map((row) => [
    action,
    row.name,
    row.prefix,
    row.targetName,
    row.folder,
    row.isDirectory ? 'Folder' : 'File',
    row.path,
  ].map(csvCell).join(','));

  return [header.map(csvCell).join(','), ...lines].join('\r\n');
}

export function registerHandlers(): void {
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Выберите папку для обработки',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, folder: '' };
    }

    return { canceled: false, folder: result.filePaths[0] };
  });

  ipcMain.handle('scan-folder', async (_event, payload: Partial<ScanOptions>) => {
    return scanFolder(sanitizeScanOptions(payload));
  });

  ipcMain.handle('execute-items', async (_event, payload: Partial<ExecuteItemsRequest>): Promise<ExecuteItemsResult> => {
    const request = sanitizeExecuteRequest(payload);

    if (request.rows.length === 0) {
      return {
        ok: false,
        cancelled: true,
        rows: [],
        message: 'Нет элементов для выполнения.',
        kind: 'warn',
      };
    }

    const execution = await executeRows(request.rows, request.action);
    const refreshed = await scanFolder(request.scanOptions);
    const summary = execution.errors.length > 0
      ? `Выполнено: ${execution.done}, ошибок: ${execution.errors.length}. ${execution.errors[0]}`
      : `Выполнено: ${execution.done}.`;

    return {
      ok: true,
      done: execution.done,
      errors: execution.errors,
      rows: refreshed.ok ? refreshed.rows : [],
      message: summary,
      kind: execution.errors.length > 0 ? 'bad' : 'ok',
    };
  });

  ipcMain.handle('export-preview', async (_event, payload: Partial<ExportPreviewRequest>): Promise<ExportPreviewResult> => {
    const rows = sanitizeRows(payload?.rows);
    if (rows.length === 0) {
      return { ok: false, message: 'Нет строк для экспорта.' };
    }

    const result = await dialog.showSaveDialog({
      title: 'Экспорт предпросмотра',
      defaultPath: 'file-prefix-cleaner-preview.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    await fs.writeFile(result.filePath, previewCsv(rows, sanitizeAction(payload?.action)), 'utf8');
    return { ok: true, message: 'Предпросмотр экспортирован.' };
  });

  ipcMain.handle('window-action', async (event, action: WindowAction) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return;
    }

    if (action === 'minimize') {
      window.minimize();
    } else if (action === 'maximize') {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    } else if (action === 'close') {
      window.close();
    }
  });
}
