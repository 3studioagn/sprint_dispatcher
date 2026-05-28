/**
 * PillApp — root do renderer da janela do pill (BL-C3-017, redesigned
 * Sessões 24-26).
 *
 * Renderiza `<Pill>` do `@sprint/ui-kit` no modo compact por default;
 * click alterna para expanded. Em expanded, auto-colapsa após 5s sem
 * interação adicional (Sessão 24, decisão Renan).
 *
 * **Click no pill NÃO reabre overlay** (Sessão 24). Overlay fullscreen
 * aparece APENAS em dispatch novo via polling. Pill é puramente
 * informacional — visualiza a sprint ackeada até o deadline.
 *
 * **Drag horizontal (Sessão 26):** operador pode arrastar o pill para
 * a esquerda ou direita; a BrowserWindow do pill é reposicionada via
 * IPC para acompanhar o cursor. Mecanismo:
 *
 * 1. `pointerdown` no pill → captura cursor, IPC `pill:begin-drag` com
 *    `e.screenX` (coordenada absoluta da tela primária).
 * 2. `pointermove` enquanto pressionado → calcula deslocamento em
 *    pixels; se passou de limiar (5px), classifica gesto como drag e
 *    envia IPC `pill:drag-to` com novo `screenX`. Main move o window.
 * 3. `pointerup` → IPC `pill:end-drag`. Se NÃO houve movimento
 *    significativo, classifica como click puro e alterna expanded.
 *
 * Coordenadas absolutas evitam feedback loop: quando o window se move,
 * `clientX` mudaria mas `screenX` permanece o mesmo enquanto o cursor
 * estiver imóvel. Apenas movimento real do cursor afeta o cálculo.
 *
 * **Roteamento:** `main.tsx` detecta query `?pill` em
 * `window.location.search` e monta `<PillApp>` em vez de `<App>`.
 *
 * **Estado:** pull inicial via `pill.requestCurrent()` no mount + push
 * `pill.onUpdate()` para atualizações.
 *
 * **Auto-collapse:** `useEffect` agenda `setTimeout(5000)` quando
 * `isExpanded` vira true. Cleanup cancela em (a) re-collapse manual,
 * (b) componente desmonta, (c) info muda via push.
 */

import { Pill } from '@sprint/ui-kit';
import { ThemeProvider } from '@sprint/ui-kit';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { PillCurrentInfo } from '../shared/ipc-types';

/** Duração do auto-collapse após click expand (decisão Renan na Sessão 24). */
const AUTO_COLLAPSE_MS = 5000;
/** Movimento mínimo em pixels para classificar gesto como drag (Sessão 26). */
const DRAG_THRESHOLD_PX = 5;

/**
 * Formata `deadline_at` (ISO-8601) para o texto exibido no pill expandido
 * — "HH:MMh". Usa horário local do operador (24h, padrão BR).
 */
function formatDeadline(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--:--h';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}h`;
  } catch {
    return '--:--h';
  }
}

/**
 * Formata `deadline_at` (ISO-8601) para o badge de data no expanded —
 * "DD/MM". Não inclui ano (informação supérflua para meta do dia).
 */
function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--/--';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  } catch {
    return '--/--';
  }
}

export default function PillApp(): JSX.Element {
  const [info, setInfo] = useState<PillCurrentInfo | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  /**
   * Tracking de drag em curso. `useRef` (não `useState`) porque o valor
   * é atualizado durante pointer move e NÃO precisa causar re-render —
   * apenas o `pointerup` lê para classificar click vs drag.
   */
  const dragRef = useRef<{ startScreenX: number; moved: boolean } | null>(null);

  // Pull inicial + subscribe a push de updates.
  useEffect(() => {
    let cancelled = false;

    async function pullInitial(): Promise<void> {
      try {
        const current = await window.api.pill.requestCurrent();
        if (cancelled) return;
        setInfo(current);
      } catch (err) {
        console.warn('[PillApp] pill.requestCurrent falhou', err);
      }
    }
    void pullInitial();

    const unsub = window.api.pill.onUpdate((event) => {
      setInfo(event.info);
      // Nova sprint chegou — colapsa qualquer expansão em vôo para que
      // operador veja o badge limpo do novo conteúdo.
      setIsExpanded(false);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Auto-collapse 5s após expansão.
  useEffect(() => {
    if (!isExpanded) return;
    const timerId = window.setTimeout(() => {
      setIsExpanded(false);
    }, AUTO_COLLAPSE_MS);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [isExpanded]);

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>): void {
    // Captura pointer no botão para que pointermove/up continuem chegando
    // mesmo se o cursor sair do botão durante o drag (necessário porque
    // movimento horizontal grande pode levar o cursor para fora do
    // bounding-box do pill).
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startScreenX: e.screenX, moved: false };
    void window.api.pill.beginDrag(e.screenX);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (drag === null) return;
    // Classificou como drag uma vez? Mantém marcado (não pode "desfazer"
    // mid-gesto). Senão checa threshold para promover de hover→drag.
    if (!drag.moved) {
      if (Math.abs(e.screenX - drag.startScreenX) > DRAG_THRESHOLD_PX) {
        drag.moved = true;
      }
    }
    if (drag.moved) {
      void window.api.pill.dragTo(e.screenX);
    }
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (drag === null) return;
    const wasClick = !drag.moved;
    dragRef.current = null;
    // Solta capture; defensivo: pointer pode já ter perdido capture
    // (browser cancel, etc.) — try/catch evita exception em races.
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer já não está capturado — ignora
    }
    void window.api.pill.endDrag();
    if (wasClick) {
      setIsExpanded((prev) => !prev);
    }
  }

  function handlePointerCancel(e: ReactPointerEvent<HTMLButtonElement>): void {
    // Pointer cancel (browser interrompeu gesto: troca de janela, perda
    // de foco, etc.) — encerra drag sem toggle de expand. Sem cleanup
    // específico além do endDrag no main.
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignora
    }
    void window.api.pill.endDrag();
  }

  // Pré-pull: render um wrapper vazio para evitar flash de conteúdo
  // errado. ThemeProvider sempre envolve para garantir tokens
  // disponíveis caso o pull complete e renderize.
  //
  // `className="transparent-theme"` força o background do ThemeProvider
  // a transparente — sem isso, o canvas 340×160 do BrowserWindow
  // aparece como retângulo preto em volta da pill (Sessão 25 fix).
  if (info === null) {
    return (
      <ThemeProvider className="transparent-theme">
        <div />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider className="transparent-theme">
      <div className="pill-positioner">
        <Pill
          label="Suas metas"
          value={info.meta}
          unit="Artes"
          deadline={formatDeadline(info.deadline_at)}
          date={formatDate(info.deadline_at)}
          expanded={isExpanded}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      </div>
    </ThemeProvider>
  );
}
