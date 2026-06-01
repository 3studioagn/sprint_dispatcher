---
'@sprint/ui-kit': minor
'sprint-operator-agent': minor
---

feat(C9,C3): overlay matchando design 'Hora do Rush!' (Sessão 31)

Renan: "Agora precisamos arrumar somente a overlay, ela está muito diferente e
precisa ficar exatamente igual ao design que estou te enviando." Refactor
coordenado em duas camadas:

**@sprint/ui-kit · `<Overlay>` chrome:**

- `.card` background trocado de `--sprint-color-background` (#1A1A1A) para
  `--sprint-color-background-deep` (#000000, token introduzido na Sessão 29) —
  matching preto puro do design.
- `.card` sem padding direto (`padding: var(--sprint-space-8)` removido); cada
  seção controla o próprio para que o header tenha bg distinto sem gap no topo.
- `.card` ganha `overflow: hidden` para clipar o bg do header nos cantos
  arredondados.
- `.header` ganha background `--sprint-color-surface-elevated` (#2A2A2A) e
  padding próprio. Substitui o `border-bottom: 1px solid border` por contraste
  de superfícies. Matching "bar" cinza médio sobre body preto do design.
- `.body` ganha padding próprio (`--sprint-space-6`).
- `.acknowledgeButton` perde `width: 100%` e ganha `margin: 0 space-6 space-6` —
  cria respiração visual entre body e botão. Adiciona `border: none` e
  `cursor: pointer` (defaults perdidos ao retirar do contexto do `.card`).

**sprint-operator-agent · `<Overlay>` body slot:**

- Refactor completo do `SprintBody`. Estrutura nova matching imagem:
  - **metricRow** (top): `metricGroup` (value 4xl + unit "Artes" em linha
    baseline-aligned) + `deadlineGroup` (label "Até" + value "HH:MMh" em
    coluna).
  - **footerRow** (bottom): `labelGroup` (ícone ✓ pontilhado laranja + label
    "Suas metas") + `dateBadge` ("DD/MM" com bg surface).
- **Remove do body slot:** `<DeadlineBadge>` (label "PRAZO"),
  `<QueueIndicator>`, `<TextBlock>` com `body_html`, bloco "META" gigante
  laranja. Componentes continuam exportados; podem ser reusados em telas futuras
  (histórico, queue overlay).
- **Helpers locais:** `formatDeadline` (HH:MMh) e `formatDate` (DD/MM)
  duplicados do PillApp (consciente — promover para `utils/` quando 3º consumer
  aparecer).
- **DottedCheckIcon local:** SVG inline duplicado do `<Pill>` do ui-kit. Idem
  promoção quando 3º consumer aparecer.
- **Hardcoded:** label "Suas metas" e unit "Artes" não existem no
  `SprintPayload` schema. Débito a resolver em W3+ com bump de `schema_version`
  (adicionar campos `kind`/`unit`).

**Tests atualizados (Agent · `Overlay.test.tsx`):**

- Remove teste "renderiza DeadlineBadge no body slot".
- Atualiza "renderiza meta gigante com label 'META'" → "meta gigante + unit
  'Artes' baseline".
- Adiciona "renderiza deadline formatado como HH:MMh no body slot" + "renderiza
  footer com 'Suas metas' + badge data DD/MM".
- 298 testes verdes no Agent (estável).

**Tests do ui-kit Overlay** inalterados (8 testes verdes) — mudanças foram
apenas CSS visuais que não afetam comportamento testado (structure, button
label, auto-close, aria, slot pattern, urgent variant).
