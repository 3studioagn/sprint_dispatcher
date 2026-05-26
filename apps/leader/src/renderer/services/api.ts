/**
 * Wrapper tipado de `window.api` para consumo no renderer.
 *
 * O bridge real é exposto pelo preload via
 * `contextBridge.exposeInMainWorld('api', impl)`. O renderer poderia
 * acessar `window.api` direto, mas esta indireção:
 *
 * 1. Centraliza o ponto de contato com o bridge — adicionar logging,
 *    telemetria ou normalização de erro mais tarde mexe em 1 arquivo.
 * 2. **Cada método é uma arrow function** que faz `window.api.<m>()`
 *    na hora da chamada (não no momento do import). Testes substituem
 *    `window.api` via `vi.fn()` em `test-setup.ts`, e o wrapper
 *    automaticamente passa a usar o mock.
 * 3. Propriedades-com-arrow (não method-shorthand) alinham com a
 *    convenção do `LeaderAPI` (`shared/ipc-types.ts`) para que
 *    `vi.mocked(api.foo)` em testes não dispare `unbound-method`.
 *
 * @see DECISIONS.md ADR-009 (IPC contract-first)
 * @see src/renderer/test-setup.ts (window.api mock global em testes)
 */

import type {
  DispatchSprintRequest,
  DispatchSprintResponse,
  GetConfigResult,
  IpcResult,
  LeaderAPI,
  OperatorsListResponse,
} from '../../shared/ipc-types';

export const api: LeaderAPI = {
  ping: (): Promise<string> => window.api.ping(),

  getConfig: (): Promise<GetConfigResult> => window.api.getConfig(),

  listOperators: (): Promise<IpcResult<OperatorsListResponse>> => window.api.listOperators(),

  dispatchSprint: (request: DispatchSprintRequest): Promise<IpcResult<DispatchSprintResponse>> =>
    window.api.dispatchSprint(request),
};
