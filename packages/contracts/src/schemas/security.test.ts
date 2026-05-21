import { describe, it, expect } from 'vitest';

import { validSprintPayload } from '../__fixtures__/sample-payloads';

import { safeParseSprintPayload } from './sprint-payload.schema';

describe('vetores de ataque no SprintPayload', () => {
  it('campo extra arbitrário é rejeitado por .strict()', () => {
    const malicious = { ...validSprintPayload, evilExtraKey: 'data' };
    const result = safeParseSprintPayload(malicious);
    expect(result.success).toBe(false);
  });

  it('payload com campo "constructor" é rejeitado por .strict()', () => {
    // Defesa contra prototype-injection via campo nomeado "constructor".
    const malicious = { ...validSprintPayload, constructor: { prototype: {} } };
    const result = safeParseSprintPayload(malicious);
    expect(result.success).toBe(false);
  });

  it('payload com chave "__proto__" como own property é rejeitado por .strict()', () => {
    // Cenário realista: JSON.parse('{"__proto__":...}') cria own property
    // (não polui prototype). .strict() rejeita por ser chave desconhecida.
    const malicious = JSON.parse(
      `{${Object.keys(validSprintPayload)
        .map(
          (k) =>
            `${JSON.stringify(k)}:${JSON.stringify((validSprintPayload as Record<string, unknown>)[k])}`,
        )
        .join(',')},"__proto__":{"polluted":true}}`,
    ) as unknown;
    const result = safeParseSprintPayload(malicious);
    expect(result.success).toBe(false);
  });

  it('body_html com tags potencialmente perigosas é aceito pelo schema (sanitização é em C1-004)', () => {
    // Decisão arquitetural deliberada: o schema NÃO sanitiza. Aceita
    // qualquer string em body_html. A sanitização é responsabilidade
    // exclusiva de BL-C1-004 (W1) via DOMPurify.
    const withScript = {
      ...validSprintPayload,
      body_html: '<script>alert(1)</script>',
    };
    const result = safeParseSprintPayload(withScript);
    expect(result.success).toBe(true);
  });

  it('null em campo obrigatório é rejeitado', () => {
    const invalid = { ...validSprintPayload, user_id: null };
    const result = safeParseSprintPayload(invalid);
    expect(result.success).toBe(false);
  });

  it('undefined em campo obrigatório é rejeitado', () => {
    const invalid = { ...validSprintPayload, user_id: undefined };
    const result = safeParseSprintPayload(invalid);
    expect(result.success).toBe(false);
  });
});
