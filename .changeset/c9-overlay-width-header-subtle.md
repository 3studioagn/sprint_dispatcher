---
'@sprint/ui-kit': minor
---

fix(C9): overlay card mais estreito + header bar "subtle" (Sessão 32)

Renan validou Sessão 31 e reportou 2 ajustes:

1. "Ele ficou um pouco largo demais, comparado com a imagem que tinha te
   enviado."
2. "O fundo onde está escrito 'É hora de correr' deve ser um pouco mais escuro,
   apenas um tom acima do preto mesmo."

Fix em `<Overlay>` do ui-kit + token novo:

**Card mais estreito:**

- `.card` `max-width: 720px` → `520px`. Aproxima a proporção do design-alvo
  (mais quadrada/portrait); não compromete legibilidade da meta gigante 4xl.

**Header bar mais escuro:**

- Novo token `--sprint-color-surface-subtle: #111111` em `tokens.css` — entre
  `background-deep` (#000) e `surface` (#222). Reservado para áreas que precisam
  se diferenciar SUTILMENTE do background-deep sem chamar atenção.
- `.header` background `--sprint-color-surface-elevated` (#2A) →
  `--sprint-color-surface-subtle` (#111). Hierarquia visual entre header e body
  preservada, mas mais sutil.

Tests: 60 verdes no ui-kit (estável; CSS visual não afeta comportamento
testado).
