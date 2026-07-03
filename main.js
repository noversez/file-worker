const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

let mainWindow;

function normalizePrefixes(rawText) {
  return rawText
    .split(/\r?\n|,|;/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function matchesPrefix(name, prefixes) {
  for (const prefix of prefixes) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      return prefix;
    }
  }
  return null;
}

function cleanName(name, prefix) {
  const cleaned = name.slice(prefix.length).replace(/^[\s\t\-_.\]]+/, '');
  return cleaned.trim().length > 0 ? cleaned : name;
}

function samePath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function uniquePath(directory, name, sourcePath) {
  const target = path.join(directory, name);
  if (samePath(target, sourcePath)) {
    return target;
  }

  if (!(await pathExists(target))) {
    return target;
  }

  const parsed = path.parse(name);
  for (let index = 2; index < 10000; index += 1) {
    const candidate = path.join(directory, `${parsed.name} (${index})${parsed.ext}`);
    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Unable to resolve a unique name for ${name}`);
}

function pathDepth(rootPath, itemPath) {
  const relative = path.relative(rootPath, itemPath);
  if (!relative) {
    return 0;
  }

  return relative.split(path.sep).filter(Boolean).length;
}

async function collectEntries(currentPath, rootPath, prefixes, recursive, action, rows) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const isDirectory = entry.isDirectory();
    const prefix = matchesPrefix(entry.name, prefixes);

    if (prefix) {
      rows.push({
        path: fullPath,
        folder: path.dirname(fullPath),
        name: entry.name,
        prefix,
        targetName: action === 'delete' ? 'Удалить' : cleanName(entry.name, prefix),
        isDirectory,
        depth: pathDepth(rootPath, fullPath),
      });
    }

    if (isDirectory && recursive) {
      await collectEntries(fullPath, rootPath, prefixes, recursive, action, rows);
    }
  }
}

async function scanFolder({ folder, prefixesText, recursive, action }) {
  const folderPath = folder.trim();
  if (!folderPath) {
    return { ok: false, message: 'Выберите папку для сканирования.' };
  }

  if (!(await pathExists(folderPath))) {
    return { ok: false, message: 'Указанная папка не найдена.' };
  }

  const prefixes = normalizePrefixes(prefixesText);
  if (prefixes.length === 0) {
    return { ok: false, message: 'Введите хотя бы один префикс.' };
  }

  const rows = [];
  await collectEntries(folderPath, folderPath, prefixes, recursive, action, rows);

  if (rows.length === 0) {
    return {
      ok: true,
      rows,
      message: 'Совпадений не найдено.',
      kind: 'warn',
    };
  }

  return {
    ok: true,
    rows,
    message: `Найдено ${rows.length} элементов для ${action === 'delete' ? 'удаления' : 'переименования'}.`,
    kind: 'ok',
  };
}

async function executeRows(rows, action) {
  const orderedRows = [...rows].sort((left, right) => right.depth - left.depth);
  const errors = [];
  let done = 0;

  for (const row of orderedRows) {
    try {
      if (action === 'delete') {
        await shell.trashItem(row.path);
      } else {
        const targetPath = await uniquePath(row.folder, row.targetName, row.path);
        if (!samePath(targetPath, row.path)) {
          await fs.rename(row.path, targetPath);
        }
      }
      done += 1;
    } catch (error) {
      errors.push(`${row.name}: ${error.message}`);
    }
  }

  return { done, errors };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#151922',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
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

  ipcMain.handle('scan-folder', async (_event, payload) => scanFolder(payload));

  ipcMain.handle('execute-items', async (event, payload) => {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const action = payload.action === 'delete' ? 'delete' : 'rename';
    const window = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const verb = action === 'delete' ? 'удалить' : 'переименовать';

    const answer = await dialog.showMessageBox(window, {
      type: 'question',
      buttons: ['Отмена', 'Выполнить'],
      defaultId: 1,
      cancelId: 0,
      message: `Найдено ${rows.length} элементов. Выполнить действие: ${verb}?`,
      detail: 'Изменения будут применены ко всем найденным элементам.',
    });

    if (answer.response !== 1) {
      return { ok: false, cancelled: true };
    }

    const execution = await executeRows(rows, action);
    const refreshed = await scanFolder(payload.scanOptions);
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

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
