/**
 * Fixture compartilhada para testes que precisam de uma lista padrão de
 * operadores. Espelha o mock anterior (`data/operators.mock.ts` deletado
 * em Gate 4) preservando os nomes e hostnames usados em asserts existentes
 * de `OperatorList.test.tsx`, `App.test.tsx`, etc.
 *
 * Não é arquivo de produção — só consumido por `test-setup.ts` e por
 * testes individuais que sobrescrevem o default da API mockada.
 * `vitest.config.ts` exclui `__test-fixtures__/` do coverage para evitar
 * inflar `% Stmts` com dados que nunca rodam em prod.
 */

import type { Operator } from '../../shared/types/operator';

export const TEST_OPERATORS: readonly Operator[] = [
  { user_id: 'joao', user_nome_exibicao: 'João Silva', hostname: 'ART-DESIGN-04', ativo: true },
  { user_id: 'maria', user_nome_exibicao: 'Maria Souza', hostname: 'ART-DESIGN-05', ativo: true },
  {
    user_id: 'carlos',
    user_nome_exibicao: 'Carlos Pereira',
    hostname: 'ART-DESIGN-06',
    ativo: true,
  },
  {
    user_id: 'beatriz',
    user_nome_exibicao: 'Beatriz Lima',
    hostname: 'ART-DESIGN-07',
    ativo: true,
  },
  {
    user_id: 'rafael',
    user_nome_exibicao: 'Rafael Costa',
    hostname: 'ART-DESIGN-08',
    ativo: false,
  },
];
