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

Comportamento na inicialização:

- Config existe e válido → app inicia, tray aparece
- Config ausente → diálogo com path e instrução, quit
- Config inválido (JSON quebrado ou schema violado) → diálogo com erro
  específico, quit

Veja `DECISIONS.md` ADR-012.

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
