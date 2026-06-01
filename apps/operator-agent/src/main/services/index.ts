/**
 * Barrel dos services do main process do Sprint Operator Agent.
 *
 * Cada service é instanciado pelo `main/index.ts` (composition root) e
 * vive enquanto o processo. Services impuros (com refs a APIs do Electron
 * ou ao filesystem) ficam separados de utilidades puras testáveis
 * (`trayStateService`).
 */

export {
  computeTrayIconColor,
  computeTrayMenu,
  computeTrayTooltip,
  formatConnectionStatusLabel,
  type TrayIconColor,
  type TrayMenuAction,
  type TrayMenuItem,
  type TrayState,
} from './trayStateService';

export { TrayService, type TrayActionHandler } from './trayService';

// Reconexão com backoff — BL-C3-013 (W3)
export {
  BACKOFF_JITTER,
  BACKOFF_SCHEDULE_MS,
  CONNECTIVITY_ERROR_CODES,
  isConnectivityError,
  nextBackoffDelayMs,
  type ConnectionStatus,
  type RandomFn,
} from './connectivity';

// Domain — Gate 3 (BL-C3-003) + Gate 6 (BL-C3-008 archive)
export { QueueService, type QueueUnsubscribe } from './queueService';
export { HistoryService } from './historyService';
export { PollingService, type PollingDeps, type PollingLogger } from './pollingService';

// Ack — Gate 6 (BL-C3-007)
export { AckService, type AckLogger, type AckServiceDeps } from './ackService';

// Overlay — Gate 4 (BL-C3-004) + Gate 5 (BL-C3-005 timer)
export {
  OverlayService,
  type OverlayServiceDeps,
  type OverlayState,
  type OverlayStateUnsubscribe,
} from './overlayService';

// Pill — BL-C3-017 (W2) — badge minimizado pós-ack
export { PillService } from './pillService';
