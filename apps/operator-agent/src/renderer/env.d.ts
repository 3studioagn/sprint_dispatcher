/// <reference types="vite/client" />

import type { Api } from '../shared/ipc-types';

declare global {
  interface Window {
    /**
     * API tipada exposta pelo main process via preload.
     *
     * @see src/shared/ipc-types.ts
     * @see DECISIONS.md ADR-009
     */
    api: Api;
  }
}

export {};
