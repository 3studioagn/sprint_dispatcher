/**
 * PillApp — root do renderer da janela do pill (BL-C3-017).
 *
 * Renderiza `<OverlayMinimized>` do `@sprint/ui-kit` com label = título
 * da sprint acked + value = meta. Click no pill → `window.api.pill.
 * expand()` → main fecha pill + reabre overlay fullscreen no modo
 * BL-C3-009 reopen.
 *
 * **Roteamento:** `main.tsx` detecta query `?pill` em
 * `window.location.search` e monta `<PillApp>` em vez de `<App>`.
 *
 * **Estado:** pull inicial via `pill.requestCurrent()` no mount + push
 * `pill.onUpdate()` para atualizações (operador ack outra sprint ⇒ main
 * atualiza pill sem destruir janela).
 *
 * **Sem fila/queue store**: pill não exibe contagem de fila. Quando há
 * próxima sprint pendente, ela substitui o pill (overlay fullscreen
 * eclipsa) — o pill nunca compete visualmente com o overlay normal.
 */

import { OverlayMinimized, ThemeProvider } from '@sprint/ui-kit';
import { useEffect, useState } from 'react';

import type { PillCurrentInfo } from '../shared/ipc-types';

export default function PillApp(): JSX.Element {
  const [info, setInfo] = useState<PillCurrentInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function pullInitial(): Promise<void> {
      try {
        const current = await window.api.pill.requestCurrent();
        if (cancelled) return;
        setInfo(current);
      } catch (err) {
        // Pull falhou — push (onUpdate) ainda pode chegar. Loga para
        // diagnose; não bloqueia o renderer.
        console.warn('[PillApp] pill.requestCurrent falhou', err);
      }
    }
    void pullInitial();

    const unsub = window.api.pill.onUpdate((event) => {
      setInfo(event.info);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  function handleClick(): void {
    // Async fire-and-forget — main hide() pill + reabre overlay full.
    // Nada para o renderer fazer no after; janela do pill será
    // escondida em seguida.
    void window.api.pill.expand();
  }

  // Pré-pull: render um wrapper vazio (sem `<OverlayMinimized>`) para
  // evitar flash de conteúdo errado. ThemeProvider sempre envolve para
  // garantir tokens disponíveis caso o pull complete e renderize.
  if (info === null) {
    return (
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <OverlayMinimized
        label={info.title}
        value={info.meta}
        onClick={handleClick}
        position="center"
      />
    </ThemeProvider>
  );
}
