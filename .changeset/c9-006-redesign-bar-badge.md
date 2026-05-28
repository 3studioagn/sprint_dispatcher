---
'@sprint/ui-kit': patch
---

fix(C9): redesign <OverlayMinimized> como bar + badge "pendurada" [BL-C9-006]

Ajuste pós-screenshot do Renan na mesma sessão. A versão original do componente
era um pill solto centralizado; o design real entregue é uma faixa horizontal
full-width com a badge "saindo" para baixo, mesma cor entre bar e badge (efeito
de extensão da faixa).

Mudanças:

- **Nova estrutura**:
  `<div className=bar><div className=positioner data-position={position}><button className=badge>...</button></div></div>`
  (era: `<button className=pill>...</button>`).
- **Nova prop `position?: 'left' | 'center' | 'right'`** (default 'center').
  Move a badge horizontalmente dentro da bar via `data-position` (atributo
  data-\* serve como hook CSS público e mantém tests estáveis frente a hashing
  de CSS Modules).
- **Bar (full-width, 8px dark)** e **badge (mesma cor, bottom corners
  arredondados via radius-pill, sombra inferior sutil)** — visualmente formam
  uma única forma fluida.
- **Inter via Google Fonts** carregada em `tokens.css` com `@import url(...)`
  (weights 400/500/600/700). Antes a fonte era apenas declarada como preferência
  com fallback de sistema; agora é garantida.

**Positioning vertical da faixa continua sendo responsabilidade do host** (Agent
em BL-C3-017) — componente assume container de largura plena.

Adiciona `OverlayMinimizedPosition` aos exports públicos (tipo nomeado). Testes
atualizados: 35 → 35 (substitui 1 teste antigo de className regex por 3 de
data-position, mantendo 7 testes pré-existentes).
