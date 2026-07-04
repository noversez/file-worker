import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CleanerAction,
  ScanOptions,
  ScanResult,
  ScanRow,
} from '../../shared/contracts';
import { cleanName, matchesPrefix, normalizePrefixes } from '../domain/filePrefix';

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await fs.stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function uniquePath(directory: string, name: string, sourcePath: string): Promise<string> {
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

  throw new Error(`Не удалось подобрать свободное имя для ${name}`);
}

function pathDepth(rootPath: string, itemPath: string): number {
  const relative = path.relative(rootPath, itemPath);
  if (!relative) {
    return 0;
  }

  return relative.split(path.sep).filter(Boolean).length;
}

async function collectEntries(
  currentPath: string,
  rootPath: string,
  prefixes: string[],
  recursive: boolean,
  action: CleanerAction,
  rows: ScanRow[],
): Promise<void> {
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

export async function scanFolder(options: ScanOptions): Promise<ScanResult> {
  const folderPath = options.folder.trim();
  if (!folderPath) {
    return { ok: false, message: 'Выберите папку для сканирования.' };
  }

  if (!(await isDirectory(folderPath))) {
    return { ok: false, message: 'Указанная папка не найдена.' };
  }

  const prefixes = normalizePrefixes(options.prefixesText);
  if (prefixes.length === 0) {
    return { ok: false, message: 'Введите хотя бы один префикс.' };
  }

  const rows: ScanRow[] = [];
  await collectEntries(folderPath, folderPath, prefixes, options.recursive, options.action, rows);

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
    message: `Найдено ${rows.length} элементов для ${options.action === 'delete' ? 'удаления' : 'переименования'}.`,
    kind: 'ok',
  };
}

export async function executeRows(rows: ScanRow[], action: CleanerAction): Promise<{ done: number; errors: string[] }> {
  const orderedRows = [...rows].sort((left, right) => right.depth - left.depth);
  const errors: string[] = [];
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
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      errors.push(`${row.name}: ${message}`);
    }
  }

  return { done, errors };
}
