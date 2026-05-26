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

export { DispatchService, resolveDeadlineIso, substituteMeta } from './dispatchService';
