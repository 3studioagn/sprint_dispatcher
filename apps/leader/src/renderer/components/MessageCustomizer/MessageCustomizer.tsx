/**
 * MessageCustomizer — composer de título/corpo do aviso (BL-C2-006).
 *
 * Permite o líder customizar o que aparece no overlay do operador:
 *
 * - **Título** (max 80 chars): linha grande no header. Default "É hora
 *   de correr".
 * - **Corpo** (max 500 chars): template HTML com placeholder `{meta}`.
 *   Default `Sua meta até o final do dia é de: <b>{meta} artes</b>`.
 *
 * O preview renderiza o aviso final com `{meta}` substituído pelo valor
 * do primeiro operador selecionado (ou 0 se nenhum selecionado), passando
 * o HTML por `sanitizeBodyHtml` (mesmo sanitizador que o `DispatchService`
 * aplica no main antes de gravar). Defesa em profundidade: o preview NÃO
 * mostra `<script>` ou outras tags fora da whitelist.
 *
 * Estado vive em `useSprintComposerStore` — esta UI só faz ponte.
 *
 * @see DispatchService.substituteMeta + sanitizeBodyHtml — pipeline real
 * @see CLAUDE.md §7.9 — sanitização obrigatória
 */
import { sanitizeBodyHtml } from '@sprint/contracts';
import { useMemo } from 'react';

import { DEFAULT_BODY_TEMPLATE, useSprintComposerStore } from '../../stores/useSprintComposerStore';

import styles from './MessageCustomizer.module.css';

const DEFAULT_TITLE = 'É hora de correr';
const PREVIEW_FALLBACK_META = 0;

/**
 * Resolve a meta usada no preview. Espelha o que cada operador veria —
 * usamos o primeiro selecionado com meta válida. Se nenhum, mostra 0
 * (visualmente comunica "selecione operador para preview real").
 */
function selectPreviewMeta(state: ReturnType<typeof useSprintComposerStore.getState>): number {
  for (const meta of state.selectedOperators.values()) {
    if (meta !== null && meta > 0) return meta;
  }
  return PREVIEW_FALLBACK_META;
}

export function MessageCustomizer() {
  const title = useSprintComposerStore((s) => s.title);
  const body = useSprintComposerStore((s) => s.body);
  const setTitle = useSprintComposerStore((s) => s.setTitle);
  const setBody = useSprintComposerStore((s) => s.setBody);
  const previewMeta = useSprintComposerStore(selectPreviewMeta);

  // Espelha exatamente o pipeline do main: trim + fallback default, depois
  // substitui {meta} (substituição multi-ocorrência via replaceAll), depois
  // sanitiza. Idempotente — operador da TI pode inspecionar o JSON gravado
  // e comparar contra este preview.
  const previewHtml = useMemo(() => {
    const trimmedBody = body.trim();
    const template = trimmedBody.length > 0 ? trimmedBody : DEFAULT_BODY_TEMPLATE;
    const withMeta = template.replaceAll('{meta}', String(previewMeta));
    return sanitizeBodyHtml(withMeta);
  }, [body, previewMeta]);

  const finalTitle = useMemo(() => {
    const trimmed = title.trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_TITLE;
  }, [title]);

  return (
    <section className={styles.section} aria-label="Customização do aviso">
      <header className={styles.header}>
        <h2 className={styles.heading}>Mensagem</h2>
        <p className={styles.hint}>
          Use <code>{'{meta}'}</code> no corpo para a meta de cada usuário ser inserida.
        </p>
      </header>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>Título</span>
          <input
            type="text"
            className={styles.input}
            value={title}
            maxLength={80}
            placeholder={DEFAULT_TITLE}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            aria-label="Título do aviso"
          />
          <span className={styles.counter} aria-live="polite">
            {String(title.length)}/80
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Corpo (HTML simples permitido)</span>
          <textarea
            className={styles.textarea}
            value={body}
            maxLength={500}
            placeholder={DEFAULT_BODY_TEMPLATE}
            rows={3}
            onChange={(e) => {
              setBody(e.target.value);
            }}
            aria-label="Corpo do aviso"
          />
          <span className={styles.counter} aria-live="polite">
            {String(body.length)}/500
          </span>
        </label>
      </div>

      <div className={styles.preview} aria-label="Pré-visualização do aviso">
        <span className={styles.previewLabel}>Pré-visualização</span>
        <div className={styles.previewCard}>
          <h3 className={styles.previewTitle}>{finalTitle}</h3>
          <div
            className={styles.previewBody}
            // sanitizeBodyHtml já passou; sem aspas duplas em atributos perigosos.
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          {previewMeta === PREVIEW_FALLBACK_META && (
            <p className={styles.previewHint}>
              Selecione um operador com meta para ver o valor substituído em <code>{'{meta}'}</code>
              .
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
