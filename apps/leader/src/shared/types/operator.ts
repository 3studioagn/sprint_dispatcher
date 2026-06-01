/**
 * Operator — usuário operador de produção da ARTFLEXÍVEIS que recebe sprints.
 *
 * Definido em `apps/leader/src/shared/` para que main process e renderer
 * compartilhem o mesmo shape sem cruzar o IPC com tipos divergentes. Não
 * promovido para `@sprint/contracts` enquanto for exclusivo do Leader —
 * o Agent não consome `operators.json` (ele usa seu próprio `config.json`
 * com user_id/hostname locais via ADR-012). Promover para o package
 * compartilhado quando C3 ou outro consumer cross-component precisar.
 *
 * Convenção de naming: snake_case alinhado aos contratos JSON do projeto
 * (`user_id`, `user_nome_exibicao`) — facilita transição futura sem
 * aliasing.
 *
 * @see DECISIONS.md ADR-015 (composer do Leader — W1.C2 parte 1)
 * @see DECISIONS.md ADR-009 (IPC contract-first — tipos compartilhados main↔renderer)
 */
export interface Operator {
  readonly user_id: string;
  readonly user_nome_exibicao: string;
  readonly hostname: string;
  readonly ativo: boolean;
}
