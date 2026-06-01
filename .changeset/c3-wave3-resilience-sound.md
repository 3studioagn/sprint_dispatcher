---
'sprint-operator-agent': minor
---

feat(C3): reconexão à pasta compartilhada com backoff + som de notificação
opcional [BL-C3-013][BL-C3-014]

**BL-C3-013 — Reconexão com backoff (RNF-07, RI-03):** o Agent agora sobrevive à
queda temporária do servidor de arquivos. Uma máquina de estados de conexão no
MAIN classifica o throw do `listPending` (via `cause.code`, sem método novo no
C4): em queda, entra em `disconnected` e faz backoff exponencial 5s → 10s → 30s
→ 60s (cap 60s, +jitter ±10%); a cada tick sonda o share via `listPending` e, ao
reconectar, retoma o intervalo normal e processa a fila acumulada. O tray
reflete o estado (ícone vermelho/verde + tooltip + item "Status da conexão" com
a última conexão). Boot resiliente: o Agent sobe mesmo com o share fora e
conecta sozinho quando ele volta — `loadConfig` deixou de validar a
acessibilidade do `shared_path` (virou condição de runtime, ADR-027).

**BL-C3-014 — Som de notificação opcional (RF-14, US-02.01):** ao exibir o
overlay (exibição inicial), toca um tom curto (~480ms) via Web Audio se
`config.som_notificacao === true`. Não toca na reabertura via tray; fail-safe
(se o áudio falhar, o overlay funciona normalmente). Seam documentado para
trocar o tom sintetizado por um asset `.wav`/`.ogg` próprio.

Sem novas dependências de runtime de terceiros; `@sprint/logger` (C6, permitido)
passa a ser usado no Agent para logar as transições de conexão. Ver ADR-027.
