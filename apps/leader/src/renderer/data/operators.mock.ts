import type { Operator } from '../types/operator';

/**
 * Mock da lista de operadores para a Wave 1 parte 1.
 *
 * Substituído por leitura real de `operators.json` da pasta compartilhada
 * quando `@sprint/fs-adapter` (C4) entregar as operações de domínio e o
 * Leader integrar (refactor de BL-C2-003).
 */
export const MOCK_OPERATORS: readonly Operator[] = [
  {
    user_id: 'joao',
    user_nome_exibicao: 'João Silva',
    hostname: 'ART-DESIGN-04',
    ativo: true,
  },
  {
    user_id: 'maria',
    user_nome_exibicao: 'Maria Souza',
    hostname: 'ART-DESIGN-05',
    ativo: true,
  },
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
] as const;
