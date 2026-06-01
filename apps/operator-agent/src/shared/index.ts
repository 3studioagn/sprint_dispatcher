/**
 * Barrel dos tipos compartilhados main↔renderer do Sprint Operator Agent.
 *
 * Re-exporta ipc-types + types/queue. NÃO re-exporta tipos do main-only
 * (services, lifecycle) — esses ficam isolados ao main process.
 */

export type {
  AcknowledgeSprintRequest,
  AcknowledgeSprintResponse,
  Api,
  ConfigErrorCode,
  ConfigErrorInfo,
  ConfigStatusResponse,
  ConfigView,
  IncomingSprintEvent,
  IpcError,
  IpcResult,
  OverlayMinimizeEvent,
  QueueUpdatedEvent,
  Unsubscribe,
} from './ipc-types';

export type { QueueItem, QueueSnapshot } from './types/queue';
