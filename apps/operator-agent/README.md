# sprint-operator-agent

Agente do Operador do Sprint Dispatcher.

App Electron residente em system tray na estação do operador. Faz polling da
pasta compartilhada, exibe overlays TOPMOST quando sprints chegam, e envia acks
de volta.

## Arquitetura tray-resident

**Não tem janela principal.** O app vive na tray. Quando uma sprint chega
(polling em W1), abre overlay temporário TOPMOST. Operador clica "OK, entendi" →
overlay fecha, ack escrito.

Veja `DECISIONS.md` ADR-011.

## Scripts

| Comando              | Descrição                                  |
| -------------------- | ------------------------------------------ |
| `pnpm dev`           | Modo dev: tray + hot-reload do overlay     |
| `pnpm build`         | Build de produção (type-check + bundle)    |
| `pnpm test`          | Testes unitários (Vitest) — config loader  |
| `pnpm test:coverage` | Testes + relatório de cobertura            |
| `pnpm lint`          | ESLint                                     |
| `pnpm type-check`    | `tsc --noEmit`                             |
| `pnpm package`       | Empacota em pasta (rápido, debug)          |
| `pnpm make`          | Gera instalador completo (NSIS + portable) |

## Estrutura

```
src/
├── main/
│   ├── index.ts           Entry, app lifecycle
│   ├── tray.ts            Tray icon + menu de contexto
│   ├── overlay.ts         Função createOverlayWindow (uso em W1)
│   ├── config.ts          Loader de config.json
│   └── single-instance.ts Garantia de instância única
├── preload/               Bridge tipado (overlay → main)
├── renderer/              React app do overlay (placeholder em W0)
└── shared/                AgentAPI (tipos IPC)
```

## Config.json

Localização: `%APPDATA%\Roaming\sprint-operator-agent\config.json`

Schema validado por `@sprint/contracts` via `safeParseAgentConfig`. Veja Anexo F
do doc de Requisitos para exemplo.

Comportamento na inicialização (fail-soft desde W1):

- Config existe e válido → app inicia, tray aparece, polling começa
- Config ausente / inválido → tray vermelho + balloon de erro (NÃO encerra; o
  operador corrige e o app "destrava" sem reiniciar)
- **`shared_path` inacessível NÃO é mais erro de config (W3, ADR-027)** — virou
  condição de runtime: o app sobe, entra em "sem conexão" (tray vermelho) e
  reconecta sozinho quando o servidor volta (ver abaixo)

Campos relevantes do `config.json` (Anexo F): `polling_interval_seconds` (1–60,
default 3), `som_notificacao` (boolean, default `true` — ver abaixo).

Veja `DECISIONS.md` ADR-012 (fail-soft) e ADR-027 (reconexão).

## Reconexão resiliente e som (W3 — BL-C3-013 / BL-C3-014)

**Reconexão com backoff (BL-C3-013):** se a pasta compartilhada SMB cair, o
Agent detecta (classificando o erro do `listPending`), pinta o tray de
**vermelho** ("sem conexão" + última conexão no tooltip/menu) e faz **backoff
exponencial** (5s → 10s → 30s → 60s, cap 60s). Ao reconectar, o tray volta a
**verde** e a fila acumulada é processada. O Agent **sobe mesmo com o servidor
fora** e conecta sozinho quando ele volta. Reconexão ≠ watchdog de processo
(BL-C5-004).

**Som de notificação (BL-C3-014):** com `"som_notificacao": true` (default), um
tom curto toca ao exibir o overlay (exibição inicial; não toca ao reabrir pela
tray). Defina `false` para silenciar. O som é fail-safe (se o áudio falhar, o
overlay funciona normalmente) e usa Web Audio — para trocar pelo seu
`.wav`/`.ogg`, veja o seam em `renderer/sound/notificationSound.ts`.

## Segurança

Todo BrowserWindow (incluindo overlay) usa o padrão obrigatório do CLAUDE.md
§8.1: contextIsolation, sandbox, sem nodeIntegration, CSP estrita. Bridge via
preload + `contextBridge.exposeInMainWorld`.

## Single Instance Lock

App usa `app.requestSingleInstanceLock()` para impedir múltiplas instâncias. Se
um segundo agent é iniciado, ele aciona o primeiro (traz overlay à frente se
houver) e sai imediatamente.

## Roadmap interno

- **W0 (sessão atual):** scaffold + config loader + tray placeholder
- **W1:** polling, overlay real, ack, tray menu completo, auto-start
- **W2:** cancelamento, edge cases
- **W3:** code signing, polish visual
