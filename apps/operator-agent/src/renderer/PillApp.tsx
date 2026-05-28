/**
 * PillApp — root do renderer da janela do pill (BL-C3-017, redesigned
 * Sessão 24).
 *
 * Renderiza `<Pill>` do `@sprint/ui-kit` no modo compact por default;
 * click alterna para expanded. Em expanded, auto-colapsa após 5s sem
 * interação adicional (decisão Renan via AskUserQuestion na sessão).
 *
 * **Click no pill NÃO reabre overlay** (mudança Sessão 24). Overlay
 * fullscreen aparece apenas em dispatch novo via polling. Pill é
 * puramente informacional — visualiza a sprint ackeada até o deadline.
 *
 * **Roteamento:** `main.tsx` detecta query `?pill` em
 * `window.location.search` e monta `<PillApp>` em vez de `<App>`.
 *
 * **Estado:** pull inicial via `pill.requestCurrent()` no mount + push
 * `pill.onUpdate()` para atualizações (operador ack outra sprint ⇒ main
 * atualiza pill sem destruir janela). `isExpanded` local — não
 * sincronizado com main (UX puramente local).
 *
 * **Auto-collapse:** `useEffect` agenda `setTimeout(5000)` quando
 * `isExpanded` vira true. Cleanup cancela timer em: (a) expanded volta
 * para false manualmente; (b) componente desmonta; (c) info muda
 * (nova sprint via push).
 */

import { Pill, ThemeProvider } from '@sprint/ui-kit';
import { useEffect, useState } from 'react';

import type { PillCurrentInfo } from '../shared/ipc-types';

/** Duração do auto-collapse após click expand (decisão Renan na Sessão 24). */
const AUTO_COLLAPSE_MS = 5000;

/**
 * Formata `deadline_at` (ISO-8601) para o texto exibido no pill expandido
 * — "HH:MMh". Usa `toLocaleTimeString` com fuso horário do operador
 * (`hour12: false` para 24h, padrão BR).
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

  function handleClick(): void {
    // Toggle local — click compact → expanded (auto-colapsa em 5s).
    // Click expanded → compact imediato (cancela auto-collapse via
    // cleanup do useEffect).
    setIsExpanded((prev) => !prev);
  }

  // Pré-pull: render um wrapper vazio para evitar flash de conteúdo
  // errado. ThemeProvider sempre envolve para garantir tokens
  // disponíveis caso o pull complete e renderize.
  //
  // `className="transparent-theme"` força o background do ThemeProvider
  // a transparente (default do ui-kit é dark via .module.css) — sem
  // isso, o canvas 340×160 do BrowserWindow aparece como retângulo
  // preto em volta da pill (Sessão 25 fix). Override em global.css.
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
          onClick={handleClick}
        />
      </div>
    </ThemeProvider>
  );
}
