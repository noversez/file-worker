const folderInput = document.getElementById('folderInput');
const browseBtn = document.getElementById('browseBtn');
const prefixInput = document.getElementById('prefixInput');
const recursiveInput = document.getElementById('recursiveInput');
const scanRenameBtn = document.getElementById('scanRenameBtn');
const scanDeleteBtn = document.getElementById('scanDeleteBtn');
const executeBtn = document.getElementById('executeBtn');
const statusChip = document.getElementById('statusChip');
const countLabel = document.getElementById('countLabel');
const resultsBody = document.getElementById('resultsBody');

const state = {
  action: 'rename',
  rows: [],
  scanOptions: null,
};

function setStatus(message, kind = 'info') {
  statusChip.textContent = message;
  statusChip.dataset.kind = kind;
}

function setBusy(isBusy) {
  executeBtn.disabled = isBusy;
  scanRenameBtn.disabled = isBusy;
  scanDeleteBtn.disabled = isBusy;
  browseBtn.disabled = isBusy;
}

function updateAction(action) {
  state.action = action;
  executeBtn.textContent = action === 'delete' ? 'Удалить найденное' : 'Переименовать найденное';
}

function createCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value;
  return cell;
}

function renderRows(rows) {
  resultsBody.innerHTML = '';
  countLabel.textContent = `${rows.length} элементов`;

  if (rows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'empty-state';
    cell.textContent = 'Найдите элементы, чтобы увидеть предпросмотр.';
    row.appendChild(cell);
    resultsBody.appendChild(row);
    return;
  }

  for (const rowData of rows) {
    const row = document.createElement('tr');
    row.appendChild(createCell(rowData.name));
    row.appendChild(createCell(rowData.prefix));
    row.appendChild(createCell(rowData.targetName));
    row.appendChild(createCell(rowData.folder));
    row.appendChild(createCell(rowData.isDirectory ? 'Папка' : 'Файл'));
    resultsBody.appendChild(row);
  }
}

function currentScanOptions() {
  return {
    folder: folderInput.value,
    prefixesText: prefixInput.value,
    recursive: recursiveInput.checked,
    action: state.action,
  };
}

async function scan(action) {
  updateAction(action);
  setBusy(true);
  setStatus('Сканирование...', 'info');

  const options = currentScanOptions();
  options.action = action;

  try {
    const result = await window.filePrefixCleaner.scanFolder(options);
    if (!result.ok) {
      setStatus(result.message, 'bad');
      return;
    }

    state.rows = result.rows;
    state.scanOptions = options;
    renderRows(result.rows);
    setStatus(result.message, result.kind || 'ok');
  } finally {
    setBusy(false);
  }
}

async function execute() {
  if (!state.scanOptions) {
    setStatus('Сначала выполните сканирование.', 'warn');
    return;
  }

  if (state.rows.length === 0) {
    setStatus('Нет элементов для выполнения.', 'warn');
    return;
  }

  setBusy(true);
  setStatus('Выполнение...', 'info');

  try {
    const result = await window.filePrefixCleaner.executeItems({
      rows: state.rows,
      action: state.action,
      scanOptions: state.scanOptions,
    });

    if (result.cancelled) {
      setStatus('Действие отменено.', 'warn');
      return;
    }

    state.rows = result.rows || [];
    renderRows(state.rows);
    setStatus(result.message, result.kind || 'ok');
  } finally {
    setBusy(false);
  }
}

browseBtn.addEventListener('click', async () => {
  const result = await window.filePrefixCleaner.selectFolder();
  if (!result.canceled) {
    folderInput.value = result.folder;
  }
});

scanRenameBtn.addEventListener('click', () => scan('rename'));
scanDeleteBtn.addEventListener('click', () => scan('delete'));
executeBtn.addEventListener('click', execute);

updateAction('rename');
renderRows([]);
