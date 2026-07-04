export type CleanerAction = 'rename' | 'delete';
export type WindowAction = 'minimize' | 'maximize' | 'close';

export interface ScanOptions {
  folder: string;
  prefixesText: string;
  recursive: boolean;
  action: CleanerAction;
}

export interface ScanRow {
  path: string;
  folder: string;
  name: string;
  prefix: string;
  targetName: string;
  isDirectory: boolean;
  depth: number;
}

export interface ScanResultError {
  ok: false;
  message: string;
}

export interface ScanResultSuccess {
  ok: true;
  rows: ScanRow[];
  message: string;
  kind: 'ok' | 'warn';
}

export type ScanResult = ScanResultError | ScanResultSuccess;

export interface SelectFolderResult {
  canceled: boolean;
  folder: string;
}

export interface ExportPreviewRequest {
  rows: ScanRow[];
  action: CleanerAction;
}

export interface ExportPreviewResult {
  ok: boolean;
  canceled?: boolean;
  message?: string;
}

export interface ExecuteItemsRequest {
  rows: ScanRow[];
  action: CleanerAction;
  scanOptions: ScanOptions;
}

export interface ExecuteItemsResult {
  ok: boolean;
  cancelled?: boolean;
  done?: number;
  errors?: string[];
  rows?: ScanRow[];
  message?: string;
  kind?: 'ok' | 'bad' | 'warn';
}

export interface CleanerApi {
  selectFolder: () => Promise<SelectFolderResult>;
  scanFolder: (payload: ScanOptions) => Promise<ScanResult>;
  executeItems: (payload: ExecuteItemsRequest) => Promise<ExecuteItemsResult>;
  exportPreview: (payload: ExportPreviewRequest) => Promise<ExportPreviewResult>;
  windowAction: (action: WindowAction) => Promise<void>;
}
