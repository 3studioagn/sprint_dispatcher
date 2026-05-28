# SCOPE_QUESTION.md — versão minimizada exige expansão de escopo

> Bloqueio levantado durante o **Protocolo de Início (§1.1)** da sessão
> **BL-C9-001 a 005 (componente C9 completo)**. O prompt master prescreve PARAR
> antes de implementar e aguardar resposta antes de prosseguir.

---

## Resumo do bloqueio

A segunda imagem anexada à sessão ("versão minimizada") **não é um tray icon
estático** (cenário **a** do prompt) — é claramente um **componente React
adicional** (cenário **b**) que **não está previsto no backlog v1.1**.

O backlog atual do C9 contempla:

- **BL-C9-003** — `<Overlay>` com variants `default | urgent`

Nenhum dos 5 BLs do C9 cobre um componente compacto/minimizado. O que está em
CLAUDE.md §1 ("overlay minimiza para ícone na bandeja") sugere tray icon
estático — mas o design entregue mostra outra coisa.

**A sessão está PARADA aguardando sua decisão.** Nenhum scaffold do
`@sprint/ui-kit` foi criado ainda (só este arquivo + a pasta `dev/`).

---

## O que vejo na imagem "minimizada"

| Propriedade      | Observação                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Posição          | Ancorado ao **topo central da tela** (não na bandeja do Windows)                          |
| Forma            | Pill horizontal com cantos arredondados inferiores; topo conecta à borda superior da tela |
| Fundo            | Mesma cor escura do card principal (`~#1A1A1A`)                                           |
| Conteúdo         | Ícone check pontilhado laranja + label "Suas metas" + número "20" em bold branco          |
| Tamanho aparente | ~280-320px de largura por ~50-60px de altura                                              |
| Tipografia       | Mesma família/peso do overlay completo (16-20px aproximado)                               |
| Persistência     | Permanece visível enquanto a sprint está ativa (não é toast efêmero)                      |

**Comportamento inferido (não confirmado pela imagem):**

- Clicar no pill reabre o `<Overlay>` completo (consistente com CLAUDE.md
  "clicável pra reabrir")
- Aparece após o auto-close de 5 segundos do overlay completo
- Mostra um resumo compacto (a meta) para o operador não esquecer

---

## Por que isso é diferente de tray icon

| Aspecto          | Tray icon (CLAUDE.md §1)                    | Pill on-screen (imagem 2)                                                        |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| Localização      | Bandeja do Windows (canto inferior-direito) | Topo central da tela                                                             |
| Tecnologia       | Electron `Tray` API + ícone PNG/ICO         | Componente React + janela Electron `BrowserWindow` separada (frameless, topmost) |
| Visibilidade     | Pequeno (16x16/32x32 px)                    | Pill com texto legível                                                           |
| Responsabilidade | Operator Agent (BL-C3-006, já existente)    | **NOVO** — sem item de backlog                                                   |

CLAUDE.md, §1 (item 4): "Após 5 segundos, overlay minimiza para ícone na bandeja
(clicável pra reabrir)". O design mostra **outra UX**: minimiza para um **pill
on-screen** persistente. Pode ou não substituir o tray icon — você decide.

---

## Propostas

### Opção 1 — Adicionar 6º componente ao C9 nesta sessão

Criar `<OverlayMinimized>` (ou `<NotificationBadge>` / `<MinimizedSprintPill>`)
em `packages/ui-kit/src/components/OverlayMinimized/` com props provavelmente:

```tsx
export interface OverlayMinimizedProps {
  label: string; // "Suas metas"
  value: string | number; // "20"
  icon?: ReactNode; // check pontilhado (ou prop tipada para evitar SVG cru)
  onClick: () => void; // dispara restore do <Overlay> completo
  variant?: 'default' | 'urgent';
}
```

Requer:

- Novo BL no backlog (BL-C9-006? BL-C9-003b?) — você cria/aprova
- Tokens novos (se a paleta exigir laranja específico para o icon — ver Opção 4)
- Smoke tests dedicados
- Documentação no README do package
- Possivelmente impacto em BL-C3-015 (refator do Agent) que precisará orquestrar
  Overlay ↔ OverlayMinimized via state machine

Adia o fechamento da sessão em ~30-40 min adicionais.

### Opção 2 — Adiar para sessão dedicada pós-C3-015

Implementar agora apenas os 5 BLs originais. Tray icon segue como está
(BL-C3-006). Pill on-screen vira BL-C9-006 + BL-C3-017 (orquestração) em wave
futura. Mantém escopo desta sessão íntegro.

Risco: design pronto fica engavetado. BL-C3-015 (próxima sessão) refatora o
Agent para usar `<Overlay>` do ui-kit, mas sem o pill — fica visualmente
incompleto.

### Opção 3 — Implementar como `variant='minimized'` do `<Overlay>`

Adicionar terceira variant ao `<Overlay>` existente
(`default | urgent | minimized`) que renderiza só o pill compacto. Mesmo
componente, modos diferentes via prop.

Avaliação técnica: **ruim**. Layouts são muito diferentes (fullscreen card
centralizado vs pill no topo). Forçaria condicionais grandes no JSX e CSS.
Princípio "componente único = layout único" do design system fica violado.

### Opção 4 — Postergar e questionar o design

A imagem mostra UX que **diverge** do que CLAUDE.md descreveu na missão original
(tray icon → pill on-screen). Vale validar:

- Substitui o tray icon ou coexiste com ele?
- Persiste até o ack ou some após X segundos?
- Clicar reabre o `<Overlay>` ou só dispara o ack diretamente?
- Comportamento em multi-monitor? (Pill aparece em qual tela?)

Estas respostas mudam a arquitetura — talvez janela Electron própria
(`BrowserWindow` topmost frameless), talvez componente puro renderizado pelo
overlay principal mudando layout.

---

## Recomendação

**Opção 2** (adiar para sessão dedicada pós-C3-015) — alinhado com o princípio
do prompt §2.3 ("Coesão dentro do C9; impermeabilidade fora dele") e com a
disciplina anti-scope-creep. Mas reconheço que o design pronto perde momentum.

Se você priorizar momentum visual, **Opção 1** (adicionar 6º componente agora) é
viável dentro desta sessão **se você aprovar explicitamente**:

1. Criar BL-C9-006 (ou nome equivalente)
2. Confirmar props/comportamento (ou aceitar minhas inferências)
3. Decidir se substitui ou coexiste com tray icon (BL-C3-006)

---

## Outras inconsistências menores detectadas no protocolo init

(Não bloqueiam a sessão, mas vale registrar para ajustar antes ou durante.)

### Inconsistência 1 — path alias em `tsconfig.base.json`

O prompt §6.1.12 + §2.1 item 10 prescreve:

> "Path alias `@sprint/ui-kit` em `tsconfig.base.json` (única edição fora do
> package)"

Mas no repo atual:

- `tsconfig.base.json` **não tem** seção `paths`
- Cada app (`apps/leader/`, `apps/operator-agent/`) define seus próprios `paths`
  no `tsconfig.json` individual
- Packages se resolvem via `workspace:*` em `package.json` (pnpm) + `paths` no
  app consumidor

**Proposta:** **não** editar `tsconfig.base.json` nesta sessão. O alias TS para
`@sprint/ui-kit` será adicionado em **BL-C3-015** (sessão de integração do
Agent), no `apps/operator-agent/tsconfig.json`. Para esta sessão, basta o
package em si existir e exportar via `name` no `package.json`.

Justificativa: o pattern existente do monorepo é "paths são responsabilidade do
consumidor". Adicionar paths globais quebraria o padrão.

### Inconsistência 2 — numeração de ADRs

O prompt menciona "ADR-003 (adoção do C9)" e "ADR-004 (não adoção de
Storybook)". Mas no `DECISIONS.md` real:

- ADR-003 = "Pasta compartilhada SMB como canal de comunicação" (já existe)
- ADR-004 = "Polling como estratégia de detecção" (já existe)
- Último ADR registrado: **ADR-021**

Os ADRs reais do C9 serão **ADR-022 (adoção do C9)** e **ADR-023 (não adoção de
Storybook)** — entregues em BL-C7-008 e BL-C7-009 (sessões futuras separadas).

**Proposta:** documentar a numeração correta no rodapé do `src/index.ts` e na
nota técnica do `DECISIONS.md` desta sessão. Não criar os ADRs em si (escopo
desta sessão é só C9 enxuto).

### Inconsistência 3 — tag `wave-1-complete`

O prompt §1.2 espera a tag `wave-1-complete` aplicada. Ela **não existe** no
repo (`git tag --list` vazio). SESSION_LOG.md Sessão 19 confirma W1 ✅ pronta
para W2 mas via auditoria, sem criar tag.

**Proposta:** não bloqueia. Continuar a sessão tratando o veredito da Sessão 19
como gate W1→W2 aprovado.

---

## Status

🟡 **Sessão BLOQUEADA** aguardando decisão sobre escopo da versão minimizada.

Após sua resposta, retomo direto da Fase 1 (BL-C9-001 scaffold) e prossigo até o
gate final.
