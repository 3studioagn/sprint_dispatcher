/**
 * SetupWizard — formulário de configuração inicial do Agent (BL-C5-006).
 *
 * Renderizado pela janela `?setup` (ver `main.tsx` → `<SetupApp>`), aberta no
 * first-run quando o `config.json` está ausente/inválido. Coleta `user_id`,
 * `shared_path` e (opcional) nome de exibição; o MAIN deriva `hostname`, aplica
 * defaults do Anexo F, valida via Zod e grava o `config.json` em `ProgramData`.
 *
 * **Sem `fs` no renderer** (CLAUDE.md §8.1): toda a I/O passa por
 * `window.api.setup.*` (IPC tipado). Este componente só coleta e exibe.
 *
 * @see DECISIONS.md ADR-028
 * @see Requisitos UC-06 (configurar estação)
 */

import { useState } from 'react';

import styles from './SetupWizard.module.css';

export interface SetupWizardProps {
  /** Nome de exibição do app (vem de `APP_DISPLAY_NAME`, injetado por `SetupApp`). */
  appName: string;
}

/** Resultado da sondagem (espelha `SetupProbeResult`; inline evita import profundo). */
interface ProbeOutcome {
  reachable: boolean;
  message: string;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function SetupWizard({ appName }: SetupWizardProps): JSX.Element {
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sharedPath, setSharedPath] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeOutcome, setProbeOutcome] = useState<ProbeOutcome | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmedUserId = userId.trim();
  const trimmedShared = sharedPath.trim();
  const isSaving = saveStatus === 'saving';
  const isDone = saveStatus === 'success';
  const canProbe = trimmedShared.length > 0 && !probing && !isSaving && !isDone;
  const canSave = trimmedUserId.length > 0 && trimmedShared.length > 0 && !isSaving && !isDone;

  async function handleProbe(): Promise<void> {
    setProbing(true);
    setProbeOutcome(null);
    try {
      const result = await window.api.setup.probe({ shared_path: trimmedShared });
      setProbeOutcome(result);
    } finally {
      setProbing(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!canSave) return;
    setSaveStatus('saving');
    setSaveError(null);
    const display = displayName.trim();
    const result = await window.api.setup.save({
      user_id: trimmedUserId,
      shared_path: trimmedShared,
      ...(display.length > 0 ? { user_nome_exibicao: display } : {}),
    });
    if (result.ok) {
      setSaveStatus('success');
    } else {
      setSaveStatus('error');
      setSaveError(result.message);
    }
  }

  return (
    <main className={styles.wizard}>
      <header className={styles.header}>
        <h1 className={styles.title}>{appName}</h1>
        <p className={styles.subtitle}>Configuração inicial da estação</p>
      </header>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <label className={styles.field}>
          <span className={styles.labelText}>Seu identificador (user_id)</span>
          <input
            className={styles.input}
            type="text"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
            }}
            placeholder="ex.: joao"
            aria-label="user_id"
            autoComplete="off"
            autoFocus
            disabled={isSaving || isDone}
          />
          <span className={styles.hint}>
            Apenas letras minúsculas, números, hífen e underscore.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.labelText}>Nome de exibição (opcional)</span>
          <input
            className={styles.input}
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
            }}
            placeholder="ex.: João Silva"
            aria-label="Nome de exibição"
            autoComplete="off"
            disabled={isSaving || isDone}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.labelText}>Pasta compartilhada</span>
          <input
            className={styles.input}
            type="text"
            value={sharedPath}
            onChange={(e) => {
              setSharedPath(e.target.value);
              setProbeOutcome(null);
            }}
            placeholder="\\servidor\Metas_3Studio"
            aria-label="Caminho da pasta compartilhada"
            autoComplete="off"
            disabled={isSaving || isDone}
          />
        </label>

        <div className={styles.probeRow}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void handleProbe()}
            disabled={!canProbe}
          >
            {probing ? 'Testando…' : 'Testar conexão'}
          </button>
          {probeOutcome !== null && (
            <span
              role="status"
              className={probeOutcome.reachable ? styles.probeOk : styles.probeFail}
            >
              {probeOutcome.message}
            </span>
          )}
        </div>

        {saveStatus === 'error' && saveError !== null && (
          <p role="alert" className={styles.error}>
            {saveError}
          </p>
        )}
        {isDone && (
          <p role="status" className={styles.success}>
            Configuração salva! Iniciando o monitoramento…
          </p>
        )}

        <button type="submit" className={styles.primaryButton} disabled={!canSave}>
          {isSaving ? 'Salvando…' : 'Salvar e iniciar'}
        </button>
      </form>
    </main>
  );
}
