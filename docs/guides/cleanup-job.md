# Job de limpeza do histórico compartilhado (`sprint-archive-cleanup`)

> **Componente:** C4 (`@sprint/fs-adapter`) · **Backlog:** BL-C4-008 · **ADR:**
> [ADR-025](../../DECISIONS.md) · **Requisitos:** UC-08, RN-08

CLI standalone que varre `pending/` e `acks/` na pasta compartilhada,
**arquiva** sprints/acks expirados em `arquivo/<YYYY-MM-DD>/` e registra um log
de limpeza. Pensado para rodar periodicamente (ex.: 1×/dia) via Windows Task
Scheduler, evitando o acúmulo de arquivos no servidor (RI-07).

> **`arquivo/` (compartilhado) ≠ `historico/` (local).** Este job mexe **só** no
> histórico **compartilhado** do servidor (`<shared>/arquivo/`, auditoria,
> UC-07). O histórico **local** de cada estação
> (`C:\ProgramData\SprintAgent\historico\`, BL-C3-008/009) é responsabilidade do
> Agent e **não** é tocado por este job.

---

## O que ele arquiva

Para cada arquivo varrido, a **política de retenção** decide:

| Modo       | Arquiva quando…                                          |
| ---------- | -------------------------------------------------------- |
| `age`      | a idade do arquivo (mtime) ≥ `--retention-days` (RN-08). |
| `deadline` | o `deadline_at` da sprint já passou (UC-08).             |
| `both`     | (padrão) idade ≥ retenção **OU** deadline passou.        |

- **Sprints** (`<sprintId>-<userId>.json` em `pending/`) são movidas **junto com
  o ack pareado** (`<sprintId>-<userId>.ack.json` em `acks/`) para
  `arquivo/<data-de-origem>/`. A data de origem vem do timestamp embutido no
  ULID do `sprint_id` (UTC).
- **Acks órfãos** (cuja sprint já saiu de `pending/` — ex.: já processada e
  deletada pelo Agent) são arquivados por **idade**, na mesma pasta de data da
  sua sprint.
- **Arquivos de cancelamento** (`cancel-*.json`) **não** são arquivados por este
  job (seu ciclo de vida é do Agent); aparecem como `ignorado` no log.
- **Arquivos corrompidos** geram `AVISO` e são arquivados por idade (limpa cruft
  sem perder rastro).

O move é **atômico** (`rename`) com fallback **copy + unlink** se `arquivo/`
estiver em outro volume (`EXDEV`). Nunca sobrescreve um arquivo já no destino
(idempotente). Tolerante a corrida (um arquivo que some no meio é benigno).

---

## Como executar

O CLI é compilado para um `.mjs` standalone via esbuild
(`pnpm --filter @sprint/fs-adapter build:cli`, gerado automaticamente no
`pnpm install` via `prepare`):

```powershell
node packages\fs-adapter\dist\sprint-archive-cleanup.mjs --share "\\srv-alpha\TEMP\Metas_3Studio"
```

> **Empacotamento em EXE e agendamento via instalador são responsabilidade do C5
> (deploy)** — fora do escopo do C4. Esta é a forma _runnable_ para
> validação/operação manual; o C5 produzirá o executável final.

### Argumentos

| Argumento                      | Descrição                                                        |
| ------------------------------ | ---------------------------------------------------------------- |
| `--share <caminho>`            | **(obrigatório)** Pasta compartilhada (UNC ou letra mapeada).    |
| `--retention-days <n>`         | Idade (dias) p/ arquivar por antiguidade. Padrão: `7`.           |
| `--mode <age\|deadline\|both>` | Política de retenção. Padrão: `both`.                            |
| `--dry-run`                    | Lista o que **seria** arquivado, sem mover nada (não grava log). |
| `-h`, `--help`                 | Mostra a ajuda.                                                  |

> **Sempre informe o caminho UNC** (`\\servidor\...`), nunca a letra mapeada — a
> letra pode variar por estação (ver CLAUDE.md §2).

### Validar antes de agendar (`--dry-run`)

```powershell
node packages\fs-adapter\dist\sprint-archive-cleanup.mjs --share "\\srv-alpha\TEMP\Metas_3Studio" --dry-run
```

### Códigos de saída

| Código | Significado                                           |
| ------ | ----------------------------------------------------- |
| `0`    | Sucesso — inclusive quando não havia nada a arquivar. |
| `1`    | Erro fatal (ex.: compartilhamento inacessível).       |
| `2`    | Erro de argumentos.                                   |

---

## Log de limpeza

Cada execução (exceto `--dry-run`) **acrescenta** (append) ao arquivo
`<shared>/arquivo/log-limpeza.txt`, com linhas legíveis:

```text
[2026-06-01T03:00:00.000Z] INÍCIO — modo=both retenção=7d dry-run=false share=\\srv-alpha\TEMP\Metas_3Studio
[arquivado] 01J...-joao.json → arquivo/2026-05-21/ (archived) +ack 01J...-joao.ack.json
[AVISO] 01J...-maria.json — JSON inválido: schema inválido: meta ausente
[2026-06-01T03:00:00.000Z] FIM — varridos=42 arquivados=12 ignorados=3 avisos=1 dry-run=false
```

---

## Agendar via Windows Task Scheduler

Roda 1×/dia às 03:00 (ajuste `node` e os caminhos ao ambiente). Idealmente
agende no **servidor de arquivos** (ou numa estação dedicada com acesso de
escrita ao compartilhamento):

```powershell
schtasks /create ^
  /tn "Sprint Dispatcher - Limpeza de Histórico" ^
  /tr "\"C:\Program Files\nodejs\node.exe\" \"C:\sprint-dispatcher\packages\fs-adapter\dist\sprint-archive-cleanup.mjs\" --share \"\\srv-alpha\TEMP\Metas_3Studio\"" ^
  /sc DAILY ^
  /st 03:00 ^
  /ru SYSTEM
```

- Use uma conta (`/ru`) com permissão de **escrita** em `pending/`, `acks/` e
  `arquivo/` (mover = ler+remover+gravar).
- Valide a tarefa rodando-a manualmente uma vez (`schtasks /run /tn "..."`) e
  conferindo `arquivo\log-limpeza.txt`.
- Para auditar o que seria limpo sem mexer em nada, rode antes com `--dry-run`.

> Esta tarefa **não** depende dos agentes nem do Leader estarem rodando — opera
> apenas sobre o filesystem compartilhado (P-01).
