import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import { MessageCustomizer } from './MessageCustomizer';

const store = useSprintComposerStore;

/** Helper: escopa queries no preview card (evita colisões com o textarea). */
function preview(): HTMLElement {
  return screen.getByLabelText('Pré-visualização do aviso');
}

describe('MessageCustomizer', () => {
  beforeEach(() => {
    store.getState().reset();
  });

  afterEach(() => {
    store.getState().reset();
  });

  describe('defaults', () => {
    it('input de título mostra "É hora de correr" como valor inicial', () => {
      render(<MessageCustomizer />);
      const titleInput = screen.getByLabelText('Título do aviso');
      expect(titleInput).toHaveValue('É hora de correr');
    });

    it('textarea do corpo mostra placeholder com template default', () => {
      render(<MessageCustomizer />);
      const bodyTextarea = screen.getByLabelText('Corpo do aviso');
      expect(bodyTextarea).toHaveAttribute(
        'placeholder',
        'Sua meta até o final do dia é de: <b>{meta} artes</b>',
      );
      expect(bodyTextarea).toHaveValue('');
    });

    it('preview renderiza título e corpo default com {meta} substituído por 0', () => {
      render(<MessageCustomizer />);
      const card = preview();
      // O default é "Sua meta até o final do dia é de: <b>0 artes</b>"
      expect(within(card).getByText(/Sua meta até o final do dia é de/)).toBeInTheDocument();
      expect(within(card).getByText('0 artes')).toBeInTheDocument();
      expect(within(card).getByRole('heading', { name: 'É hora de correr' })).toBeInTheDocument();
    });

    it('preview hint aparece quando nenhum operador foi selecionado', () => {
      render(<MessageCustomizer />);
      expect(screen.getByText(/Selecione um operador com meta/)).toBeInTheDocument();
    });
  });

  describe('digitar título', () => {
    it('atualiza a store ao digitar', async () => {
      const user = userEvent.setup();
      render(<MessageCustomizer />);
      const titleInput = screen.getByLabelText('Título do aviso');

      await user.clear(titleInput);
      await user.type(titleInput, 'Fim de turno!');

      expect(store.getState().title).toBe('Fim de turno!');
    });

    it('preview reflete o título digitado', async () => {
      const user = userEvent.setup();
      render(<MessageCustomizer />);
      const titleInput = screen.getByLabelText('Título do aviso');

      await user.clear(titleInput);
      await user.type(titleInput, 'Custom');

      expect(within(preview()).getByRole('heading', { name: 'Custom' })).toBeInTheDocument();
    });

    it('preview cai para default quando título é apagado', async () => {
      const user = userEvent.setup();
      render(<MessageCustomizer />);
      const titleInput = screen.getByLabelText('Título do aviso');

      await user.clear(titleInput);

      expect(
        within(preview()).getByRole('heading', { name: 'É hora de correr' }),
      ).toBeInTheDocument();
    });
  });

  describe('digitar corpo', () => {
    it('atualiza a store ao digitar', async () => {
      const user = userEvent.setup();
      render(<MessageCustomizer />);
      const bodyTextarea = screen.getByLabelText('Corpo do aviso');

      await user.type(bodyTextarea, '<p>Custom</p>');

      expect(store.getState().body).toBe('<p>Custom</p>');
    });

    it('preview renderiza HTML customizado', () => {
      store.getState().setBody('<p>Custom body</p>');
      render(<MessageCustomizer />);
      expect(within(preview()).getByText('Custom body')).toBeInTheDocument();
    });

    it('preview substitui {meta} pela meta do primeiro operador selecionado', () => {
      store.getState().toggleOperator('joao');
      store.getState().setMeta('joao', 7);
      store.getState().setBody('<p>Meta total: <b>{meta}</b></p>');

      render(<MessageCustomizer />);

      const card = preview();
      // Texto literal do <b> sanitizado é "7"; o <p> tem o "Meta total: "
      // como text node distinto.
      expect(within(card).getByText('7')).toBeInTheDocument();
      expect(within(card).getByText(/Meta total/)).toBeInTheDocument();
    });
  });

  describe('sanitização (defesa em profundidade — §7.9)', () => {
    it('preview NÃO renderiza <script> no corpo', () => {
      store.getState().setBody('<p>Safe inside</p><script>window.HACKED = true;</script>');
      render(<MessageCustomizer />);
      const card = preview();
      expect(within(card).getByText('Safe inside')).toBeInTheDocument();
      // O script deve ter sido removido do preview — query no card.
      expect(card.querySelector('script')).toBeNull();
      expect((window as unknown as { HACKED?: boolean }).HACKED).toBeUndefined();
    });

    it('preview NÃO mantém handlers inline (onerror, onclick)', () => {
      store.getState().setBody('<p onclick="alert(1)">Clique aqui agora</p>');
      render(<MessageCustomizer />);
      const p = within(preview()).getByText('Clique aqui agora');
      expect(p.getAttribute('onclick')).toBeNull();
    });

    it('preserva tags permitidas (b, i, p, br, span, h1)', () => {
      store.getState().setBody('<p>texto com <b>negrito</b> e <i>itálico</i></p>');
      render(<MessageCustomizer />);
      const card = preview();
      expect(within(card).getByText('negrito').tagName).toBe('B');
      expect(within(card).getByText('itálico').tagName).toBe('I');
    });
  });

  describe('contadores de caracteres', () => {
    it('título mostra contador "X/80"', () => {
      store.getState().setTitle('Olá');
      render(<MessageCustomizer />);
      expect(screen.getByText('3/80')).toBeInTheDocument();
    });

    it('corpo mostra contador "X/500"', () => {
      store.getState().setBody('texto');
      render(<MessageCustomizer />);
      expect(screen.getByText('5/500')).toBeInTheDocument();
    });
  });
});
