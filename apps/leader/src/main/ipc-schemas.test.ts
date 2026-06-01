// @vitest-environment node
/**
 * Testes das validações Zod dos inputs IPC do histórico (BL-C2-010).
 * Garante a defesa em profundidade: payload malformado do renderer é
 * rejeitado antes de chegar ao ArchiveService.
 */
import { describe, expect, it } from 'vitest';

import { archiveFilterSchema, readArchivedSprintRequestSchema } from './ipc-schemas';

const VALID_ULID = '01HX9K2M4F8N7P2Q5R3S6T7V8W';

describe('archiveFilterSchema', () => {
  it('aceita filtro vazio', () => {
    expect(archiveFilterSchema.safeParse({}).success).toBe(true);
  });

  it('aceita data YYYY-MM-DD válida', () => {
    expect(archiveFilterSchema.safeParse({ date: '2026-05-28' }).success).toBe(true);
  });

  it('rejeita data em formato errado', () => {
    expect(archiveFilterSchema.safeParse({ date: '28/05/2026' }).success).toBe(false);
  });

  it('rejeita chaves extras (.strict)', () => {
    expect(archiveFilterSchema.safeParse({ date: '2026-05-28', operador: 'joao' }).success).toBe(
      false,
    );
  });
});

describe('readArchivedSprintRequestSchema', () => {
  const valid = { date: '2026-05-28', sprint_id: VALID_ULID, user_id: 'joao' };

  it('aceita request válido', () => {
    expect(readArchivedSprintRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejeita sprint_id que não é ULID', () => {
    expect(readArchivedSprintRequestSchema.safeParse({ ...valid, sprint_id: 'nope' }).success).toBe(
      false,
    );
  });

  it('rejeita user_id inválido', () => {
    expect(
      readArchivedSprintRequestSchema.safeParse({ ...valid, user_id: 'João Maiúsculo!' }).success,
    ).toBe(false);
  });

  it('rejeita data ausente', () => {
    expect(
      readArchivedSprintRequestSchema.safeParse({ sprint_id: VALID_ULID, user_id: 'joao' }).success,
    ).toBe(false);
  });

  it('rejeita chaves extras (.strict)', () => {
    expect(readArchivedSprintRequestSchema.safeParse({ ...valid, extra: 'x' }).success).toBe(false);
  });
});
