# sprint-leader

Aplicação do Líder do Sprint Dispatcher.

Interface gráfica desktop (Electron + React + TypeScript) usada por líderes de
setor para disparar sprints de meta a operadores.

## Scripts

| Comando               | Descrição                                                            |
| --------------------- | -------------------------------------------------------------------- |
| `pnpm dev`            | Modo desenvolvimento com hot-reload (renderer) + auto-restart (main) |
| `pnpm build`          | Build de produção (type-check + bundle Vite)                         |
| `pnpm preview`        | Preview do build de produção                                         |
| `pnpm test`           | Testes unitários (Vitest)                                            |
| `pnpm lint`           | ESLint                                                               |
| `pnpm type-check`     | `tsc --noEmit`                                                       |
| `pnpm package`        | Empacota em pasta (rápido, debug)                                    |
| `pnpm make`           | Gera instalador completo (NSIS + portable)                           |
| `pnpm make:portable`  | Apenas `.exe` portable (~120MB)                                      |
| `pnpm make:installer` | Apenas instalador NSIS                                               |

## Estrutura

```
src/
├── main/      Main process Electron (Node.js)
├── preload/   Bridge tipado main↔renderer (sandboxed)
├── renderer/  React app (sandboxed, contextIsolation: true)
└── shared/    Tipos compartilhados main↔renderer
```

## Segurança

Toda BrowserWindow usa o padrão obrigatório do CLAUDE.md §8.1: contextIsolation,
sandbox, sem nodeIntegration, CSP estrita.

Bridge entre main e renderer **exclusivamente** via preload +
`contextBridge.exposeInMainWorld('api', ...)`. Tipos em
`src/shared/ipc-types.ts`.

## Roadmap interno

- **W0 (sessão atual):** scaffold funcional + electron-builder
- **W1:** telas Nova Sprint, Acompanhamento; Zustand; React Router; dispatch
  real (depende de C4)
- **W2:** customização, ack tracking, cancelamento
- **W3:** histórico, validação de permissão de líder
