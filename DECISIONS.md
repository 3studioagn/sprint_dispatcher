# DECISIONS.md — Architecture Decision Records

Log cronológico das decisões arquiteturais do projeto Sprint Dispatcher.

Cada decisão de peso (escolha entre alternativas com trade-offs, padrão organizacional, estratégia de longo prazo) vira uma entrada aqui. Mantenha entradas em ordem cronológica crescente — mais recente no fim.

---

## Formato de cada ADR

```markdown
## ADR-NNN: <Título conciso>

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXX
- **Data:** YYYY-MM-DD
- **Decisores:** <Quem participou da decisão>

### Contexto
<O que estava acontecendo? Qual problema motivou a decisão?>

### Decisão
<O que decidimos fazer? Seja específico e direto.>

### Alternativas consideradas
<Que outras opções foram avaliadas? Por que foram rejeitadas?>

### Consequências
<O que essa decisão implica? Trade-offs aceitos? Riscos?>

### Referências
<Links, issues, PRs relacionados (se houver)>
```

### Regras

- **ADRs nunca são apagados.** Se uma decisão muda, a antiga vira `Status: Superseded by ADR-XXX` e uma nova é criada.
- **Status `Deprecated`** indica decisão que perdeu relevância mas não foi formalmente substituída.
- **Numeração é sequencial e única.** Não reuse IDs.

### O que NÃO merece ADR

- Escolhas óbvias sem trade-offs (ex: "usar TypeScript em projeto TS")
- Implementação tática de feature específica
- Reversões triviais de comportamento

---

## Registro de ADRs

> Vazio na Wave 0. Será preenchido durante o bootstrap com pelo menos:
>
> - ADR-001: Adoção de monorepo com pnpm + Turborepo
> - ADR-002: Electron como runtime desktop (não Tauri, não WPF)
> - ADR-003: Pasta compartilhada como canal de comunicação (não backend HTTP)
> - ADR-004: Polling como estratégia de detecção (não fs.watch)

---

<!-- Adicione ADRs abaixo desta linha, em ordem cronológica crescente -->
