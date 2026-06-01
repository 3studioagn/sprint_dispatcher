/**
 * Som de notificação opcional do overlay (BL-C3-014, RF-14, US-02.01).
 *
 * **Default:** tom curto (~480ms) sintetizado via **Web Audio** — sem
 * arquivo, sem questão de licença, e compatível com o renderer
 * sandboxed/contextIsolated (Web Audio é API web padrão, não precisa de
 * `nodeIntegration`).
 *
 * **Fail-safe:** qualquer erro de áudio (contexto indisponível, política de
 * autoplay, etc.) é capturado e ignorado — o overlay funciona normalmente
 * sem som. Áudio é estritamente best-effort.
 *
 * **Seam para asset próprio (.wav/.ogg):** passe `source` com a URL de um
 * arquivo empacotado no renderer para tocar um asset em vez do tom
 * sintetizado. Exemplo:
 *
 * ```ts
 * import notifyWav from './assets/notify.wav'; // Vite resolve para URL
 * playNotificationSound({ url: notifyWav });
 * ```
 *
 * O chamador atual ({@link useIncomingSprint}) invoca sem `source` (tom
 * sintetizado). Para trocar por um asset no futuro, basta importar o arquivo
 * e passar `{ url }` — nenhuma outra mudança é necessária.
 */

/** Origem opcional de áudio — URL de um asset empacotado no renderer. */
export interface NotificationSoundSource {
  /** URL resolvida pelo bundler (ex.: `import wav from './notify.wav'`). */
  url: string;
}

/** Duração do tom sintetizado, em segundos (~meio segundo). */
const TONE_DURATION_S = 0.48;
/** Pico de ganho do tom — modesto, para não assustar o operador. */
const TONE_PEAK_GAIN = 0.16;

interface AudioContextCapableWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

/** Resolve o construtor de `AudioContext` (com prefixo webkit como fallback). */
function resolveAudioContextCtor(): typeof AudioContext | undefined {
  const w = window as unknown as AudioContextCapableWindow;
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Fire-and-forget de uma operação de áudio assíncrona — swallow total (fail-safe). */
async function runSilently(op: () => Promise<unknown> | undefined): Promise<void> {
  try {
    await op();
  } catch {
    // Áudio é best-effort: ignora autoplay bloqueado, contexto suspenso, etc.
  }
}

/** Sintetiza um "ding" curto (arpejo A5→D6) com envelope anti-click. */
function playSynthesizedTone(): void {
  const Ctor = resolveAudioContextCtor();
  if (Ctor === undefined) return;

  const ctx = new Ctor();
  // O Electron permite autoplay sem gesto por default; `resume()` é apenas
  // defensivo (no-op se já "running"). Falha é irrelevante (fail-safe).
  void runSilently(() => ctx.resume?.());

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  // Envelope exponencial evita "click" no ataque/decay.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(TONE_PEAK_GAIN, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + TONE_DURATION_S);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now); // A5
  osc.frequency.setValueAtTime(1174.66, now + 0.12); // D6
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + TONE_DURATION_S);
  // Fecha o contexto ao terminar — evita vazar AudioContexts (limite do
  // navegador é baixo). Falha do close é irrelevante.
  osc.onended = (): void => {
    void runSilently(() => ctx.close?.());
  };
}

/** Toca um asset de áudio por URL (seam para .wav/.ogg próprio). */
function playAsset(url: string): void {
  const audio = new Audio(url);
  audio.volume = 0.6;
  void runSilently(() => audio.play());
}

/**
 * Toca o som de notificação. Sem `source`, sintetiza o tom default; com
 * `source`, toca o asset informado. **Nunca lança** (fail-safe).
 */
export function playNotificationSound(source?: NotificationSoundSource): void {
  try {
    if (source !== undefined) {
      playAsset(source.url);
      return;
    }
    playSynthesizedTone();
  } catch {
    // Fail-safe: áudio é best-effort; o overlay funciona sem som.
  }
}
