/**
 * Helpers de data para o histórico compartilhado
 * (`arquivo/<YYYY-MM-DD>/`).
 *
 * **Timezone:** usamos a data-calendário **UTC**. O Leader serializa
 * `criado_em` via `Date#toISOString()` (sempre UTC, sufixo `Z`) e gera o
 * `sprint_id` (ULID) no mesmo instante; logo a data UTC derivada do ULID
 * coincide com a de `criado_em`. Para o horário comercial da fábrica (as
 * sprints disparam longe da meia-noite), a data UTC coincide com a local
 * de São Paulo.
 *
 * **Sem `date-fns`** — pureza de dependências do C4 (só Node + C1). Toda
 * formatação usa `Date` puro.
 *
 * @see Requisitos Anexo A (estrutura `arquivo/<YYYY-MM-DD>/`)
 * @see DECISIONS.md ADR-025 (política de arquivamento e retenção)
 */

/**
 * Regex de uma pasta de data do histórico: exatamente `YYYY-MM-DD`.
 *
 * Casamento sintático apenas — use {@link isArchiveDateFolder} para
 * também rejeitar datas-calendário impossíveis (ex.: `2026-13-40`).
 */
export const ARCHIVE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formata um instante (objeto `Date` ou ms desde a epoch) como
 * `YYYY-MM-DD` em **UTC**.
 *
 * @param input - `Date` ou timestamp em ms.
 * @returns Data no formato `YYYY-MM-DD`.
 * @throws RangeError se o input representar uma data inválida (`NaN`).
 */
export function formatArchiveDate(input: Date | number): string {
  const date = typeof input === 'number' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('formatArchiveDate: data inválida');
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Verdadeiro se `name` é um nome de pasta de data válido — `YYYY-MM-DD`
 * que representa uma data-calendário real.
 *
 * Usado por `ArchiveStore.listArchive` para ignorar entradas de
 * `arquivo/` que não são pastas de data (ex.: `log-limpeza.txt`,
 * `.tmp` órfãos). Rejeita também datas sintaticamente válidas mas
 * impossíveis (ex.: `2026-02-30`) via round-trip de normalização.
 */
export function isArchiveDateFolder(name: string): boolean {
  if (!ARCHIVE_DATE_REGEX.test(name)) return false;
  const ms = Date.parse(`${name}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return false;
  // Round-trip: se a data foi normalizada (ex.: 02-30 → 03-02), o
  // resultado diverge do input e a pasta é rejeitada.
  return new Date(ms).toISOString().slice(0, 10) === name;
}
