/**
 * Arbitraries `fast-check` reutilizáveis nos testes do `@sprint/contracts`.
 *
 * Mantemos a curadoria aqui (em vez de cada `.test.ts` definir o seu) para
 * que invariantes do projeto fiquem em um lugar só — adicionar uma
 * variante nova (ex.: ULID com case mixto, userId com Unicode) é trivial
 * porque o consumer já enxerga a versão atualizada.
 *
 * Excluído da medição de cobertura (ver `vitest.config.ts`) — é código
 * de suporte a teste, não de produção.
 */
import fc from 'fast-check';

// =====================================================================
// PRIMITIVOS
// =====================================================================

/**
 * ULID em Crockford Base32 — 26 chars uppercase, sem `I/L/O/U`.
 *
 * Casa exatamente o `ULID_REGEX` do `ids.ts`. Use em testes de
 * roundtrip filename / ID generation / parsing.
 */
export const ulidArbitrary: fc.Arbitrary<string> = fc.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/);

/**
 * userId conforme `userIdSchema` — 1-50 chars de `[a-z0-9_-]`.
 *
 * Restringimos via charset explícito + bounds em vez de `stringMatching`
 * para que o shrink do fast-check produza counterexamples menores
 * (encurta string preservando charset legal).
 */
export const userIdArbitrary: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom<string>(
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'w',
      'x',
      'y',
      'z',
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '_',
      '-',
    ),
    { minLength: 1, maxLength: 50 },
  )
  .map((chars) => chars.join(''));

/**
 * ISO 8601 datetime com offset — sempre termina em `Z` (UTC) ao usar
 * `Date.toISOString()`. Compatível com `isoDatetimeSchema`.
 *
 * Range restrito a 2020-01-01 .. 2030-12-31 para evitar timestamps
 * negativos ou pré-epoch que poderiam confundir consumers de log.
 */
export const isoDatetimeArbitrary: fc.Arbitrary<string> = fc
  .date({
    min: new Date(Date.UTC(2020, 0, 1)),
    max: new Date(Date.UTC(2030, 11, 31)),
  })
  .map((d) => d.toISOString());

/**
 * Semver MAJOR.MINOR.PATCH — sempre 3 dígitos numéricos separados por `.`.
 * Compatível com `sprint-ack.schema.ts` (`agent_version`).
 */
export const semverArbitrary: fc.Arbitrary<string> = fc
  .tuple(fc.nat(99), fc.nat(99), fc.nat(99))
  .map(([major, minor, patch]) => `${String(major)}.${String(minor)}.${String(patch)}`);

// =====================================================================
// REGISTROS COMPLETOS (válidos por construção)
// =====================================================================

/**
 * `SprintPayload` válido — todos os campos preenchidos, dentro dos
 * bounds do `sprintPayloadSchema`. Use em property tests de parse e
 * roundtrip.
 */
export const sprintPayloadArbitrary = fc.record({
  schema_version: fc.constant('1.0' as const),
  sprint_id: ulidArbitrary,
  criado_por: fc.string({ minLength: 1, maxLength: 100 }),
  criado_em: isoDatetimeArbitrary,
  user_id: userIdArbitrary,
  title: fc.string({ minLength: 1, maxLength: 200 }),
  body_html: fc.string({ minLength: 1, maxLength: 2000 }),
  meta: fc.integer({ min: 1, max: 100_000 }),
  deadline_at: isoDatetimeArbitrary,
  show_duration_seconds: fc.integer({ min: 1, max: 60 }),
  persistent_popup: fc.boolean(),
});

/**
 * `SprintAck` válido. `acknowledged_at` é sempre populado para evitar
 * surpresa com `exactOptionalPropertyTypes` (que distingue ausência
 * de `undefined` explícito).
 */
export const sprintAckArbitrary = fc.record({
  schema_version: fc.constant('1.0' as const),
  sprint_id: ulidArbitrary,
  user_id: userIdArbitrary,
  hostname: fc.string({ minLength: 1, maxLength: 100 }),
  displayed_at: isoDatetimeArbitrary,
  acknowledged_at: isoDatetimeArbitrary,
  agent_version: semverArbitrary,
});

/**
 * `SprintCancel` válido. `motivo` sempre populado por simplicidade.
 */
export const sprintCancelArbitrary = fc.record({
  schema_version: fc.constant('1.0' as const),
  type: fc.constant('cancel' as const),
  sprint_id_ref: ulidArbitrary,
  cancelado_por: fc.string({ minLength: 1, maxLength: 100 }),
  cancelado_em: isoDatetimeArbitrary,
  motivo: fc.string({ minLength: 1, maxLength: 500 }),
});

/**
 * `AgentConfig` válido — usa `polling_interval_seconds` entre 1 e 60
 * (bounds do schema). `log_level` cobre todos os 6 níveis suportados.
 */
export const agentConfigArbitrary = fc.record({
  schema_version: fc.constant('1.0' as const),
  user_id: userIdArbitrary,
  user_nome_exibicao: fc.string({ minLength: 1, maxLength: 100 }),
  hostname: fc.string({ minLength: 1, maxLength: 100 }),
  shared_path: fc.string({ minLength: 1, maxLength: 500 }),
  polling_interval_seconds: fc.integer({ min: 1, max: 60 }),
  som_notificacao: fc.boolean(),
  log_level: fc.constantFrom<'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'>(
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
  ),
});
