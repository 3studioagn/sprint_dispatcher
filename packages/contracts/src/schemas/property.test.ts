/**
 * Property-based + mensagens de erro Zod como API pública.
 *
 * Garante que: (a) qualquer payload gerado por arbitrary passa pelo
 * parser sem erro; (b) roundtrip JSON.stringify → JSON.parse → parse
 * preserva os campos; (c) mensagens de erro de campos críticos contêm
 * substrings que consumers (Leader UI, Agent logging) podem depender.
 */
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import {
  validAgentConfig,
  validSprintAck,
  validSprintCancel,
  validSprintPayload,
} from '../__fixtures__/sample-payloads';
import {
  agentConfigArbitrary,
  sprintAckArbitrary,
  sprintCancelArbitrary,
  sprintPayloadArbitrary,
} from '../__helpers__/arbitraries';

import { parseAgentConfig, safeParseAgentConfig } from './agent-config.schema';
import { parseSprintAck, safeParseSprintAck } from './sprint-ack.schema';
import { parseSprintCancel, safeParseSprintCancel } from './sprint-cancel.schema';
import { parseSprintPayload, safeParseSprintPayload } from './sprint-payload.schema';

// =====================================================================
// SprintPayload — properties
// =====================================================================

describe('property: parseSprintPayload aceita qualquer payload arbitrary válido', () => {
  it('parse(arbitrary) preserva sprint_id, user_id, meta e title', () => {
    fc.assert(
      fc.property(sprintPayloadArbitrary, (payload) => {
        const parsed = parseSprintPayload(payload);
        return (
          parsed.sprint_id === payload.sprint_id &&
          parsed.user_id === payload.user_id &&
          parsed.meta === payload.meta &&
          parsed.title === payload.title
        );
      }),
      { numRuns: 50 },
    );
  });

  it('roundtrip JSON: parse(JSON.parse(JSON.stringify(payload))) é válido', () => {
    fc.assert(
      fc.property(sprintPayloadArbitrary, (payload) => {
        const json = JSON.stringify(payload);
        const reparsed: unknown = JSON.parse(json);
        const result = safeParseSprintPayload(reparsed);
        return result.success;
      }),
      { numRuns: 50 },
    );
  });
});

// =====================================================================
// SprintAck — properties
// =====================================================================

describe('property: parseSprintAck aceita qualquer ack arbitrary válido', () => {
  it('parse(arbitrary) preserva sprint_id, user_id e agent_version', () => {
    fc.assert(
      fc.property(sprintAckArbitrary, (ack) => {
        const parsed = parseSprintAck(ack);
        return (
          parsed.sprint_id === ack.sprint_id &&
          parsed.user_id === ack.user_id &&
          parsed.agent_version === ack.agent_version
        );
      }),
      { numRuns: 50 },
    );
  });

  it('roundtrip JSON', () => {
    fc.assert(
      fc.property(sprintAckArbitrary, (ack) => {
        const json = JSON.stringify(ack);
        const reparsed: unknown = JSON.parse(json);
        const result = safeParseSprintAck(reparsed);
        return result.success;
      }),
      { numRuns: 50 },
    );
  });
});

// =====================================================================
// SprintCancel — properties
// =====================================================================

describe('property: parseSprintCancel aceita qualquer cancel arbitrary válido', () => {
  it('parse(arbitrary) preserva sprint_id_ref e cancelado_por', () => {
    fc.assert(
      fc.property(sprintCancelArbitrary, (cancel) => {
        const parsed = parseSprintCancel(cancel);
        return (
          parsed.sprint_id_ref === cancel.sprint_id_ref &&
          parsed.cancelado_por === cancel.cancelado_por
        );
      }),
      { numRuns: 50 },
    );
  });

  it('roundtrip JSON', () => {
    fc.assert(
      fc.property(sprintCancelArbitrary, (cancel) => {
        const json = JSON.stringify(cancel);
        const reparsed: unknown = JSON.parse(json);
        const result = safeParseSprintCancel(reparsed);
        return result.success;
      }),
      { numRuns: 50 },
    );
  });
});

// =====================================================================
// AgentConfig — properties
// =====================================================================

describe('property: parseAgentConfig aceita qualquer config arbitrary válida', () => {
  it('parse(arbitrary) preserva user_id, shared_path e log_level', () => {
    fc.assert(
      fc.property(agentConfigArbitrary, (config) => {
        const parsed = parseAgentConfig(config);
        return (
          parsed.user_id === config.user_id &&
          parsed.shared_path === config.shared_path &&
          parsed.log_level === config.log_level
        );
      }),
      { numRuns: 50 },
    );
  });

  it('roundtrip JSON', () => {
    fc.assert(
      fc.property(agentConfigArbitrary, (config) => {
        const json = JSON.stringify(config);
        const reparsed: unknown = JSON.parse(json);
        const result = safeParseAgentConfig(reparsed);
        return result.success;
      }),
      { numRuns: 50 },
    );
  });
});

// =====================================================================
// Mensagens de erro como API pública
//
// Consumers (Leader UI, Agent logging) dependem de substrings
// específicas nas mensagens para discriminar tipo de erro. Mudanças
// aqui são quebra de contrato — exigem ADR.
// =====================================================================

describe('mensagens de erro Zod — API pública', () => {
  describe('SprintPayload', () => {
    it('sprint_id com U inválido reporta menção a "ULID"', () => {
      const invalid = { ...validSprintPayload, sprint_id: '01HX9K2M4F8N7P2Q5R3S6T7U8W' };
      const result = safeParseSprintPayload(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('sprint_id'));
        expect(issue?.message).toContain('ULID');
      }
    });

    it('user_id vazio reporta "não pode ser vazio"', () => {
      const invalid = { ...validSprintPayload, user_id: '' };
      const result = safeParseSprintPayload(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('user_id'));
        expect(issue?.message).toMatch(/vazio|empty/i);
      }
    });

    it('user_id > 50 chars reporta menção a "50"', () => {
      const invalid = { ...validSprintPayload, user_id: 'a'.repeat(51) };
      const result = safeParseSprintPayload(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('user_id'));
        expect(issue?.message).toContain('50');
      }
    });

    it('user_id com caractere inválido reporta menção a charset "[a-z0-9_-]"', () => {
      const invalid = { ...validSprintPayload, user_id: 'João!' };
      const result = safeParseSprintPayload(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('user_id'));
        expect(issue?.message).toContain('[a-z0-9_-]');
      }
    });

    it('criado_em sem offset reporta menção a "ISO 8601" e "offset"', () => {
      const invalid = { ...validSprintPayload, criado_em: '2026-05-21T14:32:10' };
      const result = safeParseSprintPayload(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('criado_em'));
        expect(issue?.message).toMatch(/ISO 8601/);
        expect(issue?.message).toMatch(/offset/i);
      }
    });

    it('campo extra desconhecido reporta "Unrecognized" (strict mode)', () => {
      const invalid = { ...validSprintPayload, campo_extra: 'x' };
      const result = safeParseSprintPayload(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasUnrecognized = result.error.issues.some((i) => /unrecognized/i.test(i.message));
        expect(hasUnrecognized).toBe(true);
      }
    });

    it('error.format() retorna linhas no formato "path: mensagem"', () => {
      const result = safeParseSprintPayload({ ...validSprintPayload, sprint_id: 'bad' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.format()).toMatch(/sprint_id:\s/);
      }
    });
  });

  describe('SprintAck', () => {
    it('agent_version não-semver reporta menção a "MAJOR.MINOR.PATCH"', () => {
      const invalid = { ...validSprintAck, agent_version: 'not-semver' };
      const result = safeParseSprintAck(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('agent_version'));
        expect(issue?.message).toContain('MAJOR.MINOR.PATCH');
      }
    });
  });

  describe('SprintCancel', () => {
    it('type diferente de "cancel" é rejeitado', () => {
      const invalid = { ...validSprintCancel, type: 'sprint' };
      const result = safeParseSprintCancel(invalid);
      expect(result.success).toBe(false);
    });

    it('motivo > 500 chars é rejeitado', () => {
      const invalid = { ...validSprintCancel, motivo: 'x'.repeat(501) };
      const result = safeParseSprintCancel(invalid);
      expect(result.success).toBe(false);
    });

    it('campo extra desconhecido é rejeitado (strict)', () => {
      const invalid = { ...validSprintCancel, extra: 'x' };
      const result = safeParseSprintCancel(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('AgentConfig', () => {
    it('polling_interval_seconds = 0 reporta ">= 1"', () => {
      const invalid = { ...validAgentConfig, polling_interval_seconds: 0 };
      const result = safeParseAgentConfig(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('polling_interval_seconds'));
        expect(issue?.message).toContain('>= 1');
      }
    });

    it('polling_interval_seconds = 61 reporta "<= 60"', () => {
      const invalid = { ...validAgentConfig, polling_interval_seconds: 61 };
      const result = safeParseAgentConfig(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('polling_interval_seconds'));
        expect(issue?.message).toContain('<= 60');
      }
    });

    it('log_level fora do enum reporta menção aos níveis válidos', () => {
      const invalid = { ...validAgentConfig, log_level: 'verbose' };
      const result = safeParseAgentConfig(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('log_level'));
        // Zod 3.x reporta "Invalid enum value. Expected 'trace' | 'debug' | ..."
        expect(issue?.message).toMatch(/invalid.*enum|expected/i);
      }
    });
  });
});
