import { describe, it, expect } from 'vitest';

import {
  ALLOWED_HTML_TAGS,
  DEFAULT_POLLING_INTERVAL_MS,
  DEFAULT_SHOW_DURATION_SECONDS,
  DEFAULT_SPRINT_TITLE,
  LOCAL_DIRS,
  MAX_DEADLINE_HORIZON_HOURS,
  SCHEMA_VERSION,
  SHARED_DIRS,
} from './constants';

describe('constants', () => {
  it('SCHEMA_VERSION é uma string semver-compatível minor', () => {
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it('intervalos de polling estão em ranges sensatos', () => {
    expect(DEFAULT_POLLING_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
    expect(DEFAULT_POLLING_INTERVAL_MS).toBeLessThanOrEqual(10_000);
  });

  it('show duration default está no range válido pelo schema (1-60s)', () => {
    expect(DEFAULT_SHOW_DURATION_SECONDS).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_SHOW_DURATION_SECONDS).toBeLessThanOrEqual(60);
  });

  it('SHARED_DIRS são paths relativos simples sem separadores', () => {
    Object.values(SHARED_DIRS).forEach((dir) => {
      expect(dir).not.toContain('/');
      expect(dir).not.toContain('\\');
      expect(dir).not.toContain('..');
      expect(dir.length).toBeGreaterThan(0);
    });
  });

  it('LOCAL_DIRS são paths relativos simples sem separadores', () => {
    Object.values(LOCAL_DIRS).forEach((dir) => {
      expect(dir).not.toContain('/');
      expect(dir).not.toContain('\\');
      expect(dir).not.toContain('..');
      expect(dir.length).toBeGreaterThan(0);
    });
  });

  it('ALLOWED_HTML_TAGS não inclui tags perigosas', () => {
    const dangerous = ['script', 'iframe', 'object', 'embed', 'a', 'img', 'style', 'link'];
    dangerous.forEach((tag) => {
      expect(ALLOWED_HTML_TAGS as readonly string[]).not.toContain(tag);
    });
  });

  it('DEFAULT_SPRINT_TITLE não está vazio', () => {
    expect(DEFAULT_SPRINT_TITLE.length).toBeGreaterThan(0);
  });

  it('MAX_DEADLINE_HORIZON_HOURS é positivo e razoável', () => {
    expect(MAX_DEADLINE_HORIZON_HOURS).toBeGreaterThan(0);
    expect(MAX_DEADLINE_HORIZON_HOURS).toBeLessThanOrEqual(72);
  });
});
