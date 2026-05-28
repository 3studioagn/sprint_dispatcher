/**
 * Sprint Operator Agent — Main process entrypoint (W1, Gate 6).
 *
 * Responsabilidades:
 *
 * - Single instance lock (impede 2 agents na mesma estação).
 * - Boot do `TrayService` com estado `loading`.
 * - Tenta `rebuildDeps()` — carrega config + instancia services + start
 *   polling. Em sucesso atualiza tray; em falha vira `config_error` +
 *   balloon. Fail-soft.
 * - Wire eventos:
 *   - `queueService.onNextSprint` → `overlayService.showSprint` + grava
 *     ack inicial (`displayed_at`) via `ackService.writeDisplayed`.
 *   - `queueService.onQueueUpdated` → `overlayService.sendQueueUpdate` +
 *     `refreshTrayState`.
 * - Registra handlers IPC:
 *   - `config:get`, `sprint:request-current` (Gate 4)
 *   - `sprint:acknowledge` (Gate 6 — orquestra ack final + archive +
 *     deletePending + dequeue + próxima sprint)
 *
 * @see DECISIONS.md ADR-011 — arquitetura tray-resident
 * @see DECISIONS.md ADR-017 — rebuildDeps callback no Leader (precedent)
 * @see CLAUDE.md §8.1 — segurança obrigatória Electron
 */

import path from 'node:path';

import { NodeFilesystemAdapter, AckStore, PendingStore } from '@sprint/fs-adapter';
import { app, dialog, ipcMain, shell } from 'electron';

import type {
  AcknowledgeSprintRequest,
  AcknowledgeSprintResponse,
  ConfigStatusResponse,
  IncomingSprintEvent,
  IpcResult,
} from '../shared/ipc-types';

import { ConfigError, loadConfig, type RuntimeConfig } from './config';
import { handleAck as handleAckOrchestration } from './handlers/handleAck';
import {
  AckService,
  HistoryService,
  OverlayService,
  PillService,
  PollingService,
  QueueService,
  TrayService,
  type TrayActionHandler,
} from './services';
import { acquireSingleInstanceLock } from './single-instance';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

// =============================================================================
// Crash visibility — uncaughtException global (G-023)
// =============================================================================
//
// Sem este handler, qualquer throw NÃO capturado durante boot (ex: Tray icon
// ausente do asar, BrowserWindow falhando antes do tray, etc.) mata o processo
// silenciosamente em prod — sem console visível, sem balloon, sem feedback.
// O operador da fábrica abre o atalho e "nada acontece".
//
// dialog.showErrorBox é síncrono e funciona mesmo antes do app.whenReady em
// muitas plataformas; é a única forma garantida de o usuário saber que houve
// um erro fatal. Após exibir, encerramos com exit code 1 (não app.quit, que
// passa pelo lifecycle window-all-closed que cancelaria o quit).

process.on('uncaughtException', (err: Error) => {
  const message = `${err.message}\n\n${err.stack ?? '(sem stack)'}`;
  // showErrorBox não exige whenReady; é seguro em qualquer momento do boot.
  try {
    dialog.showErrorBox('Sprint Operator Agent — Erro fatal', message);
  } catch {
    // Última linha de defesa: console.error ao menos persiste em log do
    // electron-builder quando inicia o app via "Run from console".
    console.error('[fatal]', err);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  const message = `Promise rejeitada sem catch: ${err.message}\n\n${err.stack ?? '(sem stack)'}`;
  try {
    dialog.showErrorBox('Sprint Operator Agent — Erro fatal', message);
  } catch {
    console.error('[fatal] unhandledRejection', err);
  }
  process.exit(1);
});

// =============================================================================
// Estado do processo
// =============================================================================

const trayService = new TrayService();

let currentConfig: RuntimeConfig | null = null;

/**
 * Services instanciados no PRIMEIRO `rebuildDeps()` bem-sucedido.
 * Pattern instantiate-once — recovery de config re-valida mas não recria.
 */
let queueService: QueueService | null = null;
let historyService: HistoryService | null = null;
let overlayService: OverlayService | null = null;
let pillService: PillService | null = null;
let pendingStore: PendingStore | null = null;
let ackService: AckService | null = null;
// pollingService é wired em Gate 5+ (`stop()` no `before-quit` lifecycle).
// O timer interno mantém o ciclo via setTimeout recursivo independente.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let pollingService: PollingService | null = null;

// =============================================================================
// Tray action wiring
// =============================================================================

const handleTrayAction: TrayActionHandler = (action) => {
  switch (action) {
    case 'about':
      trayService.showAboutDialog();
      return;
    case 'open-history': {
      void shell.openPath(path.join(app.getPath('userData'), 'historico'));
      return;
    }
    case 'show-current':
      overlayService?.restoreCurrent();
      return;
    case 'reopen-last':
      void handleReopenLast();
      return;
  }
};

/**
 * BL-C3-009 — orquestra reabertura do último aviso via tray:
 * 1. Carrega último arquivo do histórico local via `historyService`.
 * 2. Se houver: chama `overlayService.reopenFromHistory(payload)`.
 * 3. Se não: dispara balloon "Nenhum aviso para reabrir" (UX —
 *    operador clicou esperando algo; precisa de feedback).
 *
 * Falhas não-fatais. Tipicamente disparado quando state === 'idle'
 * (tray menu desabilita em sprint_active/config_error), então
 * `historyService` está inicializado.
 */
async function handleReopenLast(): Promise<void> {
  if (historyService === null || overlayService === null) {
    // Boot incompleto / config error — tray menu já deveria desabilitar,
    // mas defesa em profundidade contra clique de fila pendurada.
    return;
  }
  try {
    const last = await historyService.loadLastArchived();
    if (last === null) {
      // Nenhum aviso arquivado — operador precisa saber que clicar não
      // fez nada visível. Balloon é o canal estabelecido (G-023) para
      // sinalizar eventos do agent ao operador.
      trayService.displayInfoBalloon('Nenhum aviso para reabrir no histórico local.');
      return;
    }
    overlayService.reopenFromHistory(last.payload);
    // BL-C3-017 + Sessão 23: pill (se exibido) oculta janela mas
    // preserva state — volta a aparecer quando overlay reaberto fecha
    // (até o deadline do pill expirar).
    pillService?.hideWindow();
  } catch (err) {
    console.error('[reopen-last] falha ao carregar último arquivado', err);
    trayService.displayInfoBalloon(
      'Falha ao carregar histórico. Veja "Histórico local" para inspeção manual.',
    );
  }
}

/**
 * Resincroniza estado visual do tray baseado em `queueService.length()`.
 * Chamado em todo update da queue + ao fim de `rebuildDeps`.
 */
function refreshTrayState(): void {
  if (queueService === null) return;
  const length = queueService.length();
  if (length === 0) {
    trayService.setState({ kind: 'idle' });
  } else {
    trayService.setState({ kind: 'sprint_active', queueLength: length });
  }
}

// =============================================================================
// handleAck — orquestração extraída em `handlers/handleAck.ts` para testabilidade
// =============================================================================

async function handleAck(sprintId: string, userId: string): Promise<AcknowledgeSprintResponse> {
  if (
    queueService === null ||
    historyService === null ||
    overlayService === null ||
    pendingStore === null ||
    ackService === null
  ) {
    throw new Error('Services não inicializados — config inválida ou boot incompleto');
  }
  return handleAckOrchestration(
    {
      queueService,
      historyService,
      overlayService,
      pendingStore,
      ackService,
      // BL-C3-017: pill mostrado pós-ack quando fila esvazia;
      // hide quando próxima sprint substitui. pillService pode ser
      // null pré-rebuildDeps; spread conditional respeita
      // exactOptionalPropertyTypes (não pode passar undefined explícito).
      ...(pillService !== null ? { pillService } : {}),
      log: {
        warn: (msg, ctx) => {
          console.warn(`[ack] ${msg}`, ctx ?? '');
        },
      },
    },
    sprintId,
    userId,
  );
}

// =============================================================================
// rebuildDeps
// =============================================================================

async function rebuildDeps(): Promise<RuntimeConfig> {
  const config = await loadConfig();
  currentConfig = config;

  if (queueService === null) {
    const adapter = new NodeFilesystemAdapter();
    const pendingStoreLocal = new PendingStore(adapter, config.sharedPath);
    const ackStoreLocal = new AckStore(adapter, config.sharedPath);

    const queueLocal = new QueueService();
    const historyLocal = new HistoryService(app.getPath('userData'));
    const overlayLocal = new OverlayService({
      minimizeAfterMs: config.minimizeAfterMs,
    });
    const pillLocal = new PillService();
    const ackLocal = new AckService({
      ackStore: ackStoreLocal,
      hostname: config.hostname,
      agentVersion: app.getVersion(),
      log: {
        warn: (msg, ctx) => {
          console.warn(`[ack] ${msg}`, ctx ?? '');
        },
      },
    });
    const pollingLocal = new PollingService({
      pendingStore: pendingStoreLocal,
      queueService: queueLocal,
      historyService: historyLocal,
      // BL-C3-011: overlayService injetado para cancels poderem fechar
      // overlay quando referenciam a sprint atualmente exibida.
      overlayService: overlayLocal,
      userId: config.userId,
      pollingIntervalMs: config.pollingIntervalMs,
      log: {
        warn: (msg, ctx) => {
          console.warn(`[polling] ${msg}`, ctx ?? '');
        },
        error: (msg, ctx) => {
          console.error(`[polling] ${msg}`, ctx ?? '');
        },
      },
    });

    // Wire queueService → overlayService + ack + tray refresh + pill hide.
    queueLocal.onNextSprint((item) => {
      overlayLocal.showSprint(item, queueLocal.length());
      // Grava ack inicial (displayed_at) em paralelo — não bloqueia overlay.
      // Não-fatal em erro (writeDisplayed retorna null + loga warn).
      void ackLocal.writeDisplayed(item.payload);
      // BL-C3-017: nova sprint eclipsa o pill — se o operador tinha um
      // pill na tela da sprint anterior acked, ele some agora.
      pillLocal.hide();
    });
    queueLocal.onQueueUpdated((length) => {
      overlayLocal.sendQueueUpdate(length);
      refreshTrayState();
    });

    // Promove para module-level (consumidos por IPC handlers + handleAck).
    queueService = queueLocal;
    historyService = historyLocal;
    overlayService = overlayLocal;
    pillService = pillLocal;
    pendingStore = pendingStoreLocal;
    ackService = ackLocal;
    pollingService = pollingLocal;

    // Garante <userData>/historico/ + popula cache do historyService
    // a partir de arquivos pré-existentes (dedup pós-restart).
    await historyLocal.ensureFolder();
    await historyLocal.initializeFromDisk();

    // Inicia polling — primeiro ciclo imediato.
    await pollingLocal.start();
  }

  refreshTrayState();
  return config;
}

// =============================================================================
// IPC handlers
// =============================================================================

function registerIpcHandlers(): void {
  // config:get — Gate 2 (discriminated union ConfigStatusResponse)
  ipcMain.handle('config:get', async (): Promise<ConfigStatusResponse> => {
    try {
      const config = currentConfig ?? (await rebuildDeps());
      return {
        ok: true,
        config: {
          sharedPath: config.sharedPath,
          userId: config.userId,
          userNomeExibicao: config.userNomeExibicao,
          hostname: config.hostname,
          pollingIntervalMs: config.pollingIntervalMs,
          minimizeAfterMs: config.minimizeAfterMs,
        },
      };
    } catch (err) {
      if (err instanceof ConfigError) {
        return {
          ok: false,
          error: {
            code: err.code,
            message: err.message,
            expectedPath: err.configPath,
          },
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: {
          code: 'INVALID',
          message: `Erro inesperado: ${message}`,
          expectedPath: '',
        },
      };
    }
  });

  // sprint:request-current — Gate 4 — pull pattern do mount inicial do renderer
  ipcMain.handle('sprint:request-current', (): IncomingSprintEvent | null => {
    if (overlayService === null) return null;
    return overlayService.getCurrentEvent();
  });

  // sprint:acknowledge — Gate 6 — orquestra ack final + archive + delete
  ipcMain.handle(
    'sprint:acknowledge',
    async (
      _event,
      req: AcknowledgeSprintRequest,
    ): Promise<IpcResult<AcknowledgeSprintResponse>> => {
      try {
        const data = await handleAck(req.sprint_id, req.user_id);
        return { ok: true, data };
      } catch (err) {
        const code = err instanceof Error ? err.name : 'UNKNOWN';
        const message = err instanceof Error ? err.message : String(err);
        console.error('[ack] handleAck falhou', { sprint_id: req.sprint_id, code, message });
        return { ok: false, error: { code, message } };
      }
    },
  );

  // overlay:close-reopened — BL-C3-009 — operador clica "Fechar" em
  // overlay reaberto via tray ou pill. Sem ack adicional; apenas
  // hide(). Sessão 23: se pill state ainda está vivo (deadline não
  // expirou), pill volta — UX de "badge persistente até final da meta".
  ipcMain.handle('overlay:close-reopened', (): void => {
    overlayService?.closeReopened();
    pillService?.showWindow();
  });

  // pill:request-current — BL-C3-017 — janela do pill pulla info atual
  // no mount (race-free vs push de pill:update).
  ipcMain.handle('pill:request-current', () => pillService?.getCurrent() ?? null);

  // pill:expand — BL-C3-017 — operador clica no pill → oculta janela
  // do pill (preserva state) + reabre overlay fullscreen com payload
  // preservado (modo reopen, sem novo ack — BL-C3-009 pattern).
  // Sessão 23: hideWindow em vez de hide/dismiss para o pill voltar
  // após o operador fechar o overlay reaberto.
  ipcMain.handle('pill:expand', (): void => {
    if (pillService === null || overlayService === null) return;
    const payload = pillService.getFullPayload();
    if (payload === null) return;
    overlayService.reopenFromHistory(payload);
    pillService.hideWindow();
  });
}

// =============================================================================
// Bootstrap
// =============================================================================

async function bootstrap(): Promise<void> {
  const isPrimary = acquireSingleInstanceLock(app);
  if (!isPrimary) {
    app.quit();
    return;
  }

  await app.whenReady();

  trayService.boot({ kind: 'loading' }, handleTrayAction);

  try {
    await rebuildDeps();
  } catch (err) {
    if (!(err instanceof ConfigError)) {
      throw err;
    }
    trayService.setState({ kind: 'config_error', reason: err.message });
    trayService.displayConfigErrorBalloon(err.message);
  }

  registerIpcHandlers();
}

void bootstrap();

// =============================================================================
// Lifecycle hooks (tray-resident)
// =============================================================================

app.on('window-all-closed', () => {
  // Agent é tray-resident: NÃO encerra quando as janelas fecham.
  // Subscrever cancela o quit automático. Ver ADR-011 e G-013.
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (IS_DEV && url.startsWith(DEV_SERVER_URL ?? '')) {
      return;
    }
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.on('second-instance', () => {
  // Single instance lock garante primária única.
});
