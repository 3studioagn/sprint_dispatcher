import { useSprintComposerStore } from '../../stores/useSprintComposerStore';

import styles from './DeadlineInput.module.css';

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Helper puro: o deadline HH:MM já passou em relação a `now`?
 * Retorna `false` para formato inválido (responsabilidade de outra validação).
 *
 * Exportado para testes e para reuso em outros componentes futuros.
 */
export function isDeadlineInPast(deadlineHHMM: string, now: Date = new Date()): boolean {
  if (!HHMM_REGEX.test(deadlineHHMM)) {
    return false;
  }
  const [hhStr = '', mmStr = ''] = deadlineHHMM.split(':');
  const hh = Number.parseInt(hhStr, 10);
  const mm = Number.parseInt(mmStr, 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    return false;
  }
  const deadline = new Date(now);
  deadline.setHours(hh, mm, 0, 0);
  return deadline.getTime() < now.getTime();
}

export function DeadlineInput() {
  const deadline = useSprintComposerStore((s) => s.deadline);
  const setDeadline = useSprintComposerStore((s) => s.setDeadline);

  const isInPast = isDeadlineInPast(deadline);

  return (
    <div className={styles.field}>
      <label htmlFor="sprint-deadline" className={styles.label}>
        Horário
      </label>
      <input
        id="sprint-deadline"
        type="time"
        className={styles.input}
        value={deadline}
        onChange={(event) => {
          setDeadline(event.target.value);
        }}
      />
      {isInPast ? (
        <p className={styles.warning} role="alert">
          Atenção: o horário {deadline} já passou. A rodada ainda pode ser disparada, mas os agentes
          que receberem após o limite irão descartá-la.
        </p>
      ) : null}
    </div>
  );
}
