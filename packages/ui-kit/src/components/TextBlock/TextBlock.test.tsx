import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { TextBlock } from './TextBlock';

describe('<TextBlock>', () => {
  it('renderiza HTML com tags permitidas (h1, p, b, i, span, br)', () => {
    const html =
      '<h1>Título</h1><p>Texto <b>negrito</b> e <i>itálico</i><br /><span>span</span></p>';
    const { container } = render(<TextBlock bodyHtml={html} />);

    expect(container.querySelector('h1')?.textContent).toBe('Título');
    expect(container.querySelector('b')?.textContent).toBe('negrito');
    expect(container.querySelector('i')?.textContent).toBe('itálico');
    expect(container.querySelector('span')?.textContent).toBe('span');
    expect(container.querySelector('br')).not.toBeNull();
  });

  it('remove tag <script> (vetor XSS clássico)', () => {
    // Limpa marcador de tentativa de injeção que outros testes
    // hipotéticos poderiam ter setado. Tipo estreito (sem `any`).
    const win = window as unknown as { __xss?: boolean };
    delete win.__xss;
    const malicious = '<p>antes</p><script>window.__xss = true</script><p>depois</p>';
    const { container } = render(<TextBlock bodyHtml={malicious} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('antes');
    expect(container.textContent).toContain('depois');
    expect(win.__xss).toBeUndefined();
  });

  it('remove atributos on* (handler injection)', () => {
    const html = '<p onclick="window.__pwn=true">clique</p>';
    const { container } = render(<TextBlock bodyHtml={html} />);

    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.getAttribute('onclick')).toBeNull();
  });

  it('remove atributos style (defesa contra style:url injection)', () => {
    const html = '<p style="background: url(javascript:alert(1))">x</p>';
    const { container } = render(<TextBlock bodyHtml={html} />);

    const p = container.querySelector('p');
    expect(p?.getAttribute('style')).toBeNull();
  });

  it('remove tags fora da whitelist (ex: <div>, <iframe>)', () => {
    const html = '<div>div</div><iframe src="https://evil"></iframe><p>p</p>';
    const { container } = render(<TextBlock bodyHtml={html} />);

    // DOMPurify pode remover a tag mantendo o conteúdo de texto ou
    // remover tudo. Importante: NÃO existe nenhum <iframe>.
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe('p');
  });

  it('é idempotente — segundo passe não muta o output (ADR-014)', () => {
    // Re-render com mesmo bodyHtml deve produzir mesmo DOM. Garante
    // que sanitização defensiva não introduz drift entre renders.
    const html = '<p>conteúdo <b>estável</b></p>';
    const { container, rerender } = render(<TextBlock bodyHtml={html} />);
    const firstHtml = container.innerHTML;
    rerender(<TextBlock bodyHtml={html} />);
    expect(container.innerHTML).toBe(firstHtml);
  });

  it('compõe className adicional preservando a classe base do CSS Module', () => {
    const { container, rerender } = render(<TextBlock bodyHtml="<p>x</p>" />);
    const baseClassName = (container.firstElementChild as HTMLElement).className;
    expect(baseClassName).not.toContain('host-extra');

    rerender(<TextBlock bodyHtml="<p>x</p>" className="host-extra" />);
    const composedClassName = (container.firstElementChild as HTMLElement).className;
    expect(composedClassName).toContain('host-extra');
    expect(composedClassName.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('renderiza wrapper vazio para bodyHtml vazio (não joga)', () => {
    const { container } = render(<TextBlock bodyHtml="" />);
    const wrapper = container.firstElementChild;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.innerHTML).toBe('');
  });
});
