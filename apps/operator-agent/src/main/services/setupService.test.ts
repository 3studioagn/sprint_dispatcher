/**
 * Testes da lógica pura do wizard de first-run (BL-C5-006, ADR-028).
 *
 * Cobre o builder de config (defaults Anexo F + validação Zod), a escrita
 * atômica do `config.json` e a sondagem de conexão (reaproveitando o
 * classificador C3-013, com a desambiguação de `pending/` ausente do C4).
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SCHEMA_VERSION } from '@sprint/contracts';
import { DirectoryNotFoundError, FilesystemIOError } from '@sprint/fs-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildAgentConfigFromInput,
  probeSharedPathConnection,
  writeConfigAtomic,
} from './setupService';

describe('buildAgentConfigFromInput', () => {
  it('monta um config válido com defaults do Anexo F', () => {
    const result = buildAgentConfigFromInput(
      { user_id: 'joao', shared_path: '\\\\srv\\Metas', user_nome_exibicao: 'João Silva' },
      'ART-DESIGN-04',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      schema_version: SCHEMA_VERSION,
      user_id: 'joao',
      user_nome_exibicao: 'João Silva',
      hostname: 'ART-DESIGN-04',
      shared_path: '\\\\srv\\Metas',
      polling_interval_seconds: 3,
      som_notificacao: true,
      log_level: 'info',
    });
  });

  it('usa user_id como display name quando user_nome_exibicao ausente', () => {
    const result = buildAgentConfigFromInput({ user_id: 'maria', shared_path: 'Z:\\Metas' }, 'PC1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.user_nome_exibicao).toBe('maria');
  });

  it('usa user_id como display name quando user_nome_exibicao é só whitespace', () => {
    const result = buildAgentConfigFromInput(
      { user_id: 'carlos', shared_path: 'Z:\\Metas', user_nome_exibicao: '   ' },
      'PC2',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.user_nome_exibicao).toBe('carlos');
  });

  it('faz trim de user_id e shared_path', () => {
    const result = buildAgentConfigFromInput(
      { user_id: '  joao  ', shared_path: '  Z:\\Metas  ' },
      'PC3',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.user_id).toBe('joao');
    expect(result.config.shared_path).toBe('Z:\\Metas');
  });

  it('rejeita user_id inválido (regex) com mensagem que nomeia o campo', () => {
    const result = buildAgentConfigFromInput(
      { user_id: 'João Silva', shared_path: 'Z:\\Metas' },
      'PC4',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // A mensagem deve nomear o campo (via .format() — "user_id: ...") para o
    // operador saber o que corrigir, não o genérico "N issue(s)".
    expect(result.message).toContain('user_id');
    expect(result.message).not.toContain('issue(s)');
  });

  it('rejeita user_id vazio', () => {
    const result = buildAgentConfigFromInput({ user_id: '   ', shared_path: 'Z:\\Metas' }, 'PC5');
    expect(result.ok).toBe(false);
  });

  it('rejeita shared_path vazio', () => {
    const result = buildAgentConfigFromInput({ user_id: 'joao', shared_path: '   ' }, 'PC6');
    expect(result.ok).toBe(false);
  });
});

describe('writeConfigAtomic', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'setup-svc-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('grava JSON pretty-printed, criando o diretório pai', async () => {
    const built = buildAgentConfigFromInput({ user_id: 'joao', shared_path: 'Z:\\M' }, 'PC');
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const configPath = path.join(tmpDir, 'nested', 'config.json');
    await writeConfigAtomic(configPath, built.config);

    const raw = await fs.readFile(configPath, 'utf-8');
    expect(raw).toContain('\n  "user_id": "joao"'); // indentado (pretty)
    const parsed = JSON.parse(raw) as { user_id: string };
    expect(parsed.user_id).toBe('joao');
  });

  it('não deixa arquivo .tmp órfão', async () => {
    const built = buildAgentConfigFromInput({ user_id: 'joao', shared_path: 'Z:\\M' }, 'PC');
    if (!built.ok) throw new Error('config inválido na fixture');
    const configPath = path.join(tmpDir, 'config.json');
    await writeConfigAtomic(configPath, built.config);

    const entries = await fs.readdir(tmpDir);
    expect(entries.filter((e) => e.endsWith('.tmp'))).toHaveLength(0);
    expect(entries).toContain('config.json');
  });
});

describe('probeSharedPathConnection', () => {
  it('reachable quando listPending resolve (mesmo vazio)', async () => {
    const result = await probeSharedPathConnection({
      listPending: () => Promise.resolve([]),
      existsRoot: () => Promise.resolve(true),
    });
    expect(result.reachable).toBe(true);
  });

  it('reachable quando pending/ não existe mas a raiz do share está no ar', async () => {
    const result = await probeSharedPathConnection({
      listPending: () => Promise.reject(new DirectoryNotFoundError('\\\\srv\\Metas\\pending')),
      existsRoot: () => Promise.resolve(true),
    });
    expect(result.reachable).toBe(true);
    expect(result.message).toContain('pending');
  });

  it('NÃO reachable quando pending/ não existe e a raiz também não', async () => {
    const result = await probeSharedPathConnection({
      listPending: () => Promise.reject(new DirectoryNotFoundError('\\\\srv\\Metas\\pending')),
      existsRoot: () => Promise.resolve(false),
    });
    expect(result.reachable).toBe(false);
  });

  it('NÃO reachable quando existsRoot lança (trata como ausente)', async () => {
    const result = await probeSharedPathConnection({
      listPending: () => Promise.reject(new DirectoryNotFoundError('\\\\srv\\Metas\\pending')),
      existsRoot: () => Promise.reject(new Error('boom')),
    });
    expect(result.reachable).toBe(false);
  });

  it('NÃO reachable em erro de conectividade (cause ENOENT do C4)', async () => {
    const ioErr = new FilesystemIOError('\\\\srv\\Metas\\pending', 'EHOSTUNREACH', {
      code: 'EHOSTUNREACH',
    } as unknown as Error);
    const result = await probeSharedPathConnection({
      listPending: () => Promise.reject(ioErr),
      existsRoot: () => Promise.resolve(false),
    });
    expect(result.reachable).toBe(false);
    expect(result.message).toContain('Sem acesso');
  });

  it('NÃO reachable em erro inesperado, com a mensagem do erro', async () => {
    const result = await probeSharedPathConnection({
      listPending: () => Promise.reject(new Error('algo estranho')),
      existsRoot: () => Promise.resolve(false),
    });
    expect(result.reachable).toBe(false);
    expect(result.message).toContain('algo estranho');
  });
});
