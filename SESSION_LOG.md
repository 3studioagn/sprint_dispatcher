# SESSION_LOG.md — Diário de Sessões

Registro cronológico de cada sessão de desenvolvimento do Claude Code neste projeto.

> **Claude Code:** o objetivo deste arquivo é resolver o problema do **"onde paramos?"** entre sessões. Você lê a entrada mais recente no início de toda sessão pra retomar de onde a anterior parou. Você escreve uma nova entrada no fim de toda sessão, sem exceção.

---

## Formato de cada entrada

```markdown
## Sessão NN — YYYY-MM-DD

**Wave atual:** W0 / W1 / W2 / W3 / W4
**Duração estimada:** ~Xh
**Itens trabalhados:** [BL-CX-NNN, BL-CX-NNN, ...]

### Objetivo da sessão
<O que era pra ser feito quando começamos>

### O que foi feito
<Lista do trabalho efetivamente realizado, com refs a commits relevantes>

### Estado atual
<Em que ponto exato o trabalho está agora?>

- BL-CX-NNN: ✅ concluído, mergeado em develop
- BL-CX-NNN: 🔄 70% — falta X, testes Y passando
- BL-CX-NNN: ⏸️ não iniciado

### Decisões tomadas
<Decisões da sessão. Se virou ADR, referencie DECISIONS.md ADR-NNN>

### Bloqueios encontrados
<O que travou? Espera input de Renan? Aguarda decisão externa?>

### Próximo passo
<O que a próxima sessão deve fazer primeiro. Seja específico.>

### Observações para a próxima sessão
<Contexto implícito que não cabe nos outros lugares. Gotchas frescos, libs
que não funcionaram, atalhos descobertos, cuidados a tomar. Use sem culpa.>
```

### Convenções de status

- ✅ — item totalmente concluído e mergeado
- 🔄 — em andamento
- ⏸️ — pausado ou não iniciado
- ❌ — abortado ou bloqueado
- ⚠️ — concluído mas com débito técnico ou observação importante

---

## Histórico

> Vazio. A primeira entrada será adicionada ao fim da primeira sessão.

<!-- Adicione novas entradas ABAIXO desta linha, mais recente NO TOPO da lista (ordem reversa cronológica). -->

---

## Regras críticas

1. **Atualize sempre, mesmo em sessão curta.** Mesmo que tenha sido improdutiva, registre.
2. **Seja específico no "Próximo passo".** "Continuar onde paramos" é inútil. "Implementar `parseSprintPayload` em `packages/contracts/src/parse.ts` com testes em `parse.test.ts`" é útil.
3. **Use a seção "Observações" sem economia.** É o lugar onde você passa contexto implícito que economiza horas da próxima sessão.
4. **Se a sessão termina abruptamente** (interrupção, fim de tempo), pelo menos registre uma entrada mínima com data e o que foi feito até onde se lembra.
