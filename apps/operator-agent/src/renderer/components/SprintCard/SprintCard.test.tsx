/**
 * Testes do SprintCard — foco na re-sanitização defensiva do body_html.
 *
 * Confirma que mesmo se o JSON em pending/ for adulterado com <script>,
 * o renderer remove ANTES de injetar via dangerouslySetInnerHTML. Defesa
 * em profundidade (Leader já sanitiza no write; Agent re-sanitiza no read).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makePayload } from '../../__test-fixtures__/sprint';

import { SprintCard } from './SprintCard';

describe('SprintCard — renderização padrão', () => {
  it('renderiza title como h1', () => {
    const sprint = makePayload({ title: 'É hora de correr' });
    render(<SprintCard sprint={sprint} />);
    expect(
      screen.getByRole('heading', { level: 1, name: /é hora de correr/i }),
    ).toBeInTheDocument();
  });

  it('renderiza meta numérica destacada', () => {
    const sprint = makePayload({ meta: 42 });
    render(<SprintCard sprint={sprint} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('META')).toBeInTheDocument();
  });

  it('preserva tags permitidas (b, i, p)', () => {
    const sprint = makePayload({ bodyHtml: '<b>texto em negrito</b>' });
    const { container } = render(<SprintCard sprint={sprint} />);
    const b = container.querySelector('b');
    expect(b).not.toBeNull();
    expect(b?.textContent).toBe('texto em negrito');
  });
});

describe('SprintCard — re-sanitização defensiva (defesa em profundidade)', () => {
  it('REMOVE <script> mesmo se passar via body_html', () => {
    const sprint = makePayload({
      bodyHtml: '<script>alert("xss")</script>conteúdo seguro',
    });
    const { container } = render(<SprintCard sprint={sprint} />);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/conteúdo seguro/i)).toBeInTheDocument();
  });

  it('REMOVE handlers inline (onclick) preservando o texto', () => {
    const sprint = makePayload({
      bodyHtml: '<p onclick="evil()">click me</p>',
    });
    const { container } = render(<SprintCard sprint={sprint} />);
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.getAttribute('onclick')).toBeNull();
    expect(p?.textContent).toBe('click me');
  });

  it('REMOVE <iframe> completo', () => {
    const sprint = makePayload({
      bodyHtml: 'antes<iframe src="https://evil.com"></iframe>depois',
    });
    const { container } = render(<SprintCard sprint={sprint} />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('antes');
    expect(container.textContent).toContain('depois');
  });

  it('REMOVE atributos não-listados (class, id, data-*)', () => {
    const sprint = makePayload({
      bodyHtml: '<p class="injected" id="xss" data-evil="1">texto</p>',
    });
    const { container } = render(<SprintCard sprint={sprint} />);
    const p = container.querySelector('p');
    expect(p?.getAttribute('class')).toBeNull();
    expect(p?.getAttribute('id')).toBeNull();
    expect(p?.getAttribute('data-evil')).toBeNull();
  });
});
