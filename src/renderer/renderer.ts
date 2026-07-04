type CleanerAction = 'rename' | 'delete';
type WindowAction = 'minimize' | 'maximize' | 'close';

interface ScanOptions {
  folder: string;
  prefixesText: string;
  recursive: boolean;
  action: CleanerAction;
}

interface ScanRow {
  path: string;
  folder: string;
  name: string;
  prefix: string;
  targetName: string;
  isDirectory: boolean;
  depth: number;
}

const folderInput = document.getElementById('folderInput') as HTMLInputElement;
const browseBtn = document.getElementById('browseBtn') as HTMLButtonElement;
const prefixInput = document.getElementById('prefixInput') as HTMLTextAreaElement;
const recursiveInput = document.getElementById('recursiveInput') as HTMLInputElement;
const prefixCount = document.getElementById('prefixCount') as HTMLSpanElement;
const scanRenameBtn = document.getElementById('scanRenameBtn') as HTMLButtonElement;
const scanDeleteBtn = document.getElementById('scanDeleteBtn') as HTMLButtonElement;
const executeBtn = document.getElementById('executeBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
const statusChip = document.getElementById('statusChip') as HTMLDivElement;
const countLabel = document.getElementById('countLabel') as HTMLSpanElement;
const previewModeLabel = document.getElementById('previewModeLabel') as HTMLSpanElement;
const resultsBody = document.getElementById('resultsBody') as HTMLTableSectionElement;
const selectAllInput = document.getElementById('selectAllInput') as HTMLInputElement;
const fileCount = document.getElementById('fileCount') as HTMLElement;
const folderCount = document.getElementById('folderCount') as HTMLElement;
const selectedCount = document.getElementById('selectedCount') as HTMLElement;
const selectedLabel = document.getElementById('selectedLabel') as HTMLElement;
const confirmOverlay = document.getElementById('confirmOverlay') as HTMLDivElement;
const confirmTitle = document.getElementById('confirmTitle') as HTMLHeadingElement;
const confirmText = document.getElementById('confirmText') as HTMLParagraphElement;
const modalFileCount = document.getElementById('modalFileCount') as HTMLElement;
const modalPrefixCount = document.getElementById('modalPrefixCount') as HTMLElement;
const modalFolderCount = document.getElementById('modalFolderCount') as HTMLElement;
const summaryAction = document.getElementById('summaryAction') as HTMLElement;
const summaryFolder = document.getElementById('summaryFolder') as HTMLElement;
const summaryMode = document.getElementById('summaryMode') as HTMLElement;
const summaryTotal = document.getElementById('summaryTotal') as HTMLElement;
const summaryChanges = document.getElementById('summaryChanges') as HTMLElement;
const modalNote = document.getElementById('modalNote') as HTMLElement;
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn') as HTMLButtonElement;
const cancelConfirmXBtn = document.getElementById('cancelConfirmXBtn') as HTMLButtonElement;
const acceptConfirmBtn = document.getElementById('acceptConfirmBtn') as HTMLButtonElement;
const minimizeBtn = document.getElementById('minimizeBtn') as HTMLButtonElement;
const maximizeBtn = document.getElementById('maximizeBtn') as HTMLButtonElement;
const closeBtn = document.getElementById('closeBtn') as HTMLButtonElement;

const state: {
  action: CleanerAction;
  rows: ScanRow[];
  selectedPaths: Set<string>;
  scanOptions: ScanOptions | null;
  confirmResolve: ((accepted: boolean) => void) | null;
} = {
  action: 'rename',
  rows: [],
  selectedPaths: new Set<string>(),
  scanOptions: null,
  confirmResolve: null,
};

function prefixes(): string[] {
  return prefixInput.value
    .split(/\r?\n|,|;/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function itemWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'элемент';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'элемента';
  return 'элементов';
}

function fileType(row: ScanRow): string {
  if (row.isDirectory) return 'Папка';
  const ext = row.name.includes('.') ? row.name.split('.').pop()?.toUpperCase() : '';
  return ext ? `${ext} файл` : 'Файл';
}

function selectedRows(): ScanRow[] {
  return state.rows.filter((row) => state.selectedPaths.has(row.path));
}

function setStatus(message: string, kind: 'info' | 'ok' | 'warn' | 'bad' = 'info'): void {
  statusChip.dataset.kind = kind;
  statusChip.lastElementChild!.textContent = message;
}

function setBusy(isBusy: boolean): void {
  executeBtn.disabled = isBusy;
  scanRenameBtn.disabled = isBusy;
  scanDeleteBtn.disabled = isBusy;
  browseBtn.disabled = isBusy;
  clearBtn.disabled = isBusy;
  exportBtn.disabled = isBusy;
}

function currentScanOptions(): ScanOptions {
  return {
    folder: folderInput.value,
    prefixesText: prefixInput.value,
    recursive: recursiveInput.checked,
    action: state.action,
  };
}

function updateControls(): void {
  const selected = selectedRows();
  const files = selected.filter((row) => !row.isDirectory).length;
  const folders = selected.filter((row) => row.isDirectory).length;
  const isDelete = state.action === 'delete';

  prefixCount.textContent = String(prefixes().length);
  countLabel.textContent = `${state.rows.length} ${itemWord(state.rows.length)}`;
  previewModeLabel.textContent = state.rows.length > 0
    ? `(${state.rows.length} ${isDelete ? 'будет удалено' : 'будет переименовано'})`
    : 'Сначала выполните сканирование';
  fileCount.textContent = String(files);
  folderCount.textContent = String(folders);
  selectedCount.textContent = String(selected.length);
  selectedLabel.textContent = isDelete ? 'Будет удалено' : 'Будет переименовано';
  executeBtn.querySelector('span')!.textContent = selected.length > 0
    ? `${isDelete ? 'Выполнить удаление' : 'Выполнить переименование'} (${selected.length})`
    : 'Выполнить';
  executeBtn.disabled = selected.length === 0;
  clearBtn.disabled = state.rows.length === 0;
  exportBtn.disabled = state.rows.length === 0;
  selectAllInput.checked = state.rows.length > 0 && selected.length === state.rows.length;
  selectAllInput.indeterminate = selected.length > 0 && selected.length < state.rows.length;
}

function makeCell(value: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = value;
  cell.title = value;
  return cell;
}

function renderRows(): void {
  resultsBody.innerHTML = '';

  if (state.rows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty-state';
    cell.textContent = 'Выполните сканирование, чтобы увидеть предпросмотр.';
    row.appendChild(cell);
    resultsBody.appendChild(row);
    updateControls();
    return;
  }

  for (const rowData of state.rows) {
    const row = document.createElement('tr');
    const checkCell = document.createElement('td');
    checkCell.className = 'check-col';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedPaths.has(rowData.path);
    checkbox.ariaLabel = `Выбрать ${rowData.name}`;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.selectedPaths.add(rowData.path);
      } else {
        state.selectedPaths.delete(rowData.path);
      }
      updateControls();
    });
    checkCell.appendChild(checkbox);
    row.appendChild(checkCell);
    row.appendChild(makeCell(rowData.name));
    row.appendChild(makeCell(rowData.prefix));
    row.appendChild(makeCell(rowData.targetName));
    row.appendChild(makeCell(rowData.folder));
    row.appendChild(makeCell(fileType(rowData)));
    resultsBody.appendChild(row);
  }

  updateControls();
}

function clearPreview(): void {
  state.rows = [];
  state.selectedPaths.clear();
  state.scanOptions = null;
  renderRows();
  setStatus('Готово', 'ok');
}

async function scan(action: CleanerAction): Promise<void> {
  state.action = action;
  setBusy(true);
  setStatus('Сканирование...', 'info');

  const options = currentScanOptions();
  options.action = action;

  try {
    const result = await window.filePrefixCleaner.scanFolder(options);
    if (!result.ok) {
      clearPreview();
      setStatus(result.message, 'bad');
      return;
    }

    state.rows = result.rows;
    state.selectedPaths = new Set(result.rows.map((row) => row.path));
    state.scanOptions = options;
    renderRows();
    setStatus(result.message, result.kind);
  } finally {
    setBusy(false);
    updateControls();
  }
}

function closeConfirm(accepted: boolean): void {
  confirmOverlay.hidden = true;
  if (state.confirmResolve) {
    state.confirmResolve(accepted);
    state.confirmResolve = null;
  }
}

function requestConfirmation(rows: ScanRow[]): Promise<boolean> {
  const isDelete = state.action === 'delete';
  const files = rows.filter((row) => !row.isDirectory).length;
  const folders = rows.filter((row) => row.isDirectory).length;
  const uniquePrefixes = new Set(rows.map((row) => row.prefix)).size;

  confirmTitle.textContent = isDelete ? 'Подтвердить удаление' : 'Подтвердить переименование';
  confirmText.textContent = isDelete
    ? 'Вы собираетесь перенести найденные элементы в корзину.'
    : 'Вы собираетесь переименовать файлы и папки, удалив префиксы.';
  modalFileCount.textContent = String(files);
  modalPrefixCount.textContent = String(uniquePrefixes);
  modalFolderCount.textContent = String(folders);
  summaryAction.textContent = isDelete ? 'Удалить в корзину' : 'Переименовать';
  summaryFolder.textContent = state.scanOptions?.folder || '-';
  summaryFolder.title = state.scanOptions?.folder || '';
  summaryMode.textContent = state.scanOptions?.recursive ? 'Рекурсивно, включая подпапки' : 'Только выбранная папка';
  summaryTotal.textContent = String(rows.length);
  summaryChanges.textContent = `${rows.length} ${itemWord(rows.length)} ${isDelete ? 'будет удалено' : 'будет переименовано'}`;
  modalNote.textContent = isDelete
    ? 'Элементы будут перемещены в корзину.'
    : 'Файлы не будут удалены. Исходные файлы будут переименованы.';
  acceptConfirmBtn.lastChild!.textContent = isDelete ? ' Выполнить удаление' : ' Выполнить переименование';

  confirmOverlay.hidden = false;
  acceptConfirmBtn.focus();

  return new Promise((resolve) => {
    state.confirmResolve = resolve;
  });
}

async function execute(): Promise<void> {
  const rows = selectedRows();
  if (!state.scanOptions || rows.length === 0) {
    setStatus('Нет выбранных элементов.', 'warn');
    return;
  }

  const accepted = await requestConfirmation(rows);
  if (!accepted) {
    setStatus('Действие отменено.', 'warn');
    return;
  }

  setBusy(true);
  setStatus('Выполнение...', 'info');

  try {
    const result = await window.filePrefixCleaner.executeItems({
      rows,
      action: state.action,
      scanOptions: state.scanOptions,
    });

    state.rows = result.rows ?? [];
    state.selectedPaths = new Set(state.rows.map((row) => row.path));
    renderRows();
    setStatus(result.message ?? 'Готово', result.kind ?? 'ok');
  } finally {
    setBusy(false);
    updateControls();
  }
}

async function exportPreview(): Promise<void> {
  if (state.rows.length === 0) {
    setStatus('Нет строк для экспорта.', 'warn');
    return;
  }

  const result = await window.filePrefixCleaner.exportPreview({
    rows: state.rows,
    action: state.action,
  });

  if (result.canceled) {
    setStatus('Экспорт отменён.', 'warn');
    return;
  }

  setStatus(result.message ?? 'Предпросмотр экспортирован.', result.ok ? 'ok' : 'bad');
}

browseBtn.addEventListener('click', async () => {
  const result = await window.filePrefixCleaner.selectFolder();
  if (!result.canceled) {
    folderInput.value = result.folder;
  }
});

prefixInput.addEventListener('input', updateControls);
scanRenameBtn.addEventListener('click', () => void scan('rename'));
scanDeleteBtn.addEventListener('click', () => void scan('delete'));
executeBtn.addEventListener('click', () => void execute());
clearBtn.addEventListener('click', clearPreview);
exportBtn.addEventListener('click', () => void exportPreview());

selectAllInput.addEventListener('change', () => {
  state.selectedPaths = selectAllInput.checked
    ? new Set(state.rows.map((row) => row.path))
    : new Set<string>();
  renderRows();
});

cancelConfirmBtn.addEventListener('click', () => closeConfirm(false));
cancelConfirmXBtn.addEventListener('click', () => closeConfirm(false));
acceptConfirmBtn.addEventListener('click', () => closeConfirm(true));
confirmOverlay.addEventListener('click', (event) => {
  if (event.target === confirmOverlay) closeConfirm(false);
});

document.addEventListener('keydown', (event) => {
  if (!confirmOverlay.hidden && event.key === 'Escape') closeConfirm(false);
});

minimizeBtn.addEventListener('click', () => void window.filePrefixCleaner.windowAction('minimize' as WindowAction));
maximizeBtn.addEventListener('click', () => void window.filePrefixCleaner.windowAction('maximize' as WindowAction));
closeBtn.addEventListener('click', () => void window.filePrefixCleaner.windowAction('close' as WindowAction));

renderRows();
