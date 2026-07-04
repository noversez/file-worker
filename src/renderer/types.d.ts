import { CleanerApi } from '../shared/contracts';

declare global {
  interface Window {
    filePrefixCleaner: CleanerApi;
  }
}

export {};
