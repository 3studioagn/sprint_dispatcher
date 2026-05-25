/**
 * Operator — usuário operador de produção da ARTFLEXÍVEIS que recebe sprints.
 *
 * Definido localmente em `apps/leader/src/renderer/types/` enquanto o tipo é
 * exclusivo do Leader. Promover para `@sprint/contracts` quando C3 (Agent) ou
 * C4 (fs-adapter / leitura real de operators.json) precisarem consumir.
 *
 * Convenção de naming: snake_case alinhado aos contratos JSON do projeto
 * (`user_id`, `user_nome_exibicao`) — facilita transição futura sem aliasing.
 *
 * @see DECISIONS.md ADR-015 (composer do Leader — W1.C2 parte 1)
 */
export interface Operator {
  readonly user_id: string;
  readonly user_nome_exibicao: string;
  readonly hostname: string;
  readonly ativo: boolean;
}
