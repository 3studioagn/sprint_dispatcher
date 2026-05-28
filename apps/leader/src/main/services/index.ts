/**
 * Barrel dos services do main process do Leader.
 *
 * Importadores típicos: `main/index.ts` (bootstrap), `main/ipc.ts`
 * (registrar handlers). Tests dos services importam direto do módulo
 * (granularidade fina).
 */

export {
  OperatorsFileInvalidError,
  OperatorsFileNotFoundError,
  OperatorsService,
  operatorsFileSchema,
} from './operatorsService';

export {
  DispatchService,
  resolveBodyTemplate,
  resolveDeadlineIso,
  resolveTitle,
  substituteMeta,
} from './dispatchService';

export { AckTrackingService, type AckTrackingTarget } from './ackTrackingService';

export { CancelService } from './cancelService';
