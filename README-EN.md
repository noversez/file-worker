# File Prefix Cleaner

**File Prefix Cleaner** is a Windows desktop app that finds files and folders by prefix, shows a preview, and then renames selected items or moves them to the Recycle Bin.

The current version is an Electron + TypeScript rewrite of the original PowerShell utility. The original implementation is kept in `powershell-version/`.

Русская версия: [README.md](README.md)

## Features

- Find files and folders whose names start with one of the configured prefixes.
- Multiple prefixes: one per line, comma-separated, or semicolon-separated.
- Scan only the selected folder or include subfolders.
- Preview table before any action.
- Select individual rows with checkboxes.
- Safe rename: existing files are not overwritten; conflicts become `name (2).ext`.
- Safe delete: items are moved to the Recycle Bin.
- Export preview to CSV.
- Custom in-app confirmation modal.
- Branded app and `.exe` icon.

Rename example:

```text
[QWERTY.COM] Lesson 1.mp4 -> Lesson 1.mp4
```

## Usage

1. Select the target folder.
2. Enter one or more prefixes.
3. Enable subfolder scanning if needed.
4. Click “Scan for Rename” or “Scan for Delete”.
5. Review the preview table and uncheck items you do not want to process.
6. Click “Execute” and confirm the action in the modal.

## Development Setup

```bash
npm install
```

## Run

```bash
npm start
```

This command builds TypeScript first and then starts Electron.

## Build

Build a Windows portable `.exe`:

```bash
npm run dist
```

The generated file will be placed in `dist/`.

Build an unpacked app faster:

```bash
npm run dist:dir
```

`npm run pack` is kept as an alias for the unpacked build.

## Scripts

- `npm run build` — compile TypeScript into `build/`.
- `npm start` — build and run the app.
- `npm run dist` — build a portable `.exe`.
- `npm run dist:dir` — build an unpacked app.
- `npm run pack` — alias for `dist:dir`.

## Project Structure

```text
assets/                 App icons: svg, png, ico
src/main/domain/        Pure prefix helpers
src/main/application/   Scanning, renaming, Recycle Bin operations
src/main/ipc/           IPC handlers, CSV export, window controls
src/main/window/        BrowserWindow creation
src/preload/            Safe bridge between renderer and main process
src/renderer/           UI logic
src/shared/             Shared TypeScript contracts
powershell-version/     Original PowerShell implementation
```

## Safety Notes

- Always review the preview table before executing an action.
- Delete mode sends items to the Recycle Bin.
- Rename mode never overwrites existing files or folders.
- In recursive mode, nested items are processed from deepest to highest so folder operations stay correct.
