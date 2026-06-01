/**
 * Testes do som de notificação (BL-C3-014).
 *
 * jsdom não implementa Web Audio nem playback de `<audio>`, então mockamos
 * `AudioContext`/`Audio` via `vi.stubGlobal`. Cobre: tom sintetizado por
 * default, seam de asset por URL, e os caminhos fail-safe (contexto ausente,
 * construtor que joga, `play()` rejeitado).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { playNotificationSound } from './notificationSound';

class FakeAudioParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeGainNode {
  gain = new FakeAudioParam();
  connect = vi.fn();
}

class FakeOscillator {
  type = '';
  frequency = new FakeAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  destination = {};
  gainNode = new FakeGainNode();
  oscillator = new FakeOscillator();
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
  createGain = vi.fn(() => this.gainNode);
  createOscillator = vi.fn(() => this.oscillator);
  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeAudioContext.instances.length = 0;
});

describe('playNotificationSound — tom sintetizado (default)', () => {
  it('cria AudioContext + oscillator e inicia/para o tom', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);

    playNotificationSound();

    const ctx = FakeAudioContext.instances.at(-1);
    expect(ctx).toBeDefined();
    expect(ctx?.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx?.oscillator.start).toHaveBeenCalledTimes(1);
    expect(ctx?.oscillator.stop).toHaveBeenCalledTimes(1);
    // Envelope anti-click aplicado.
    expect(ctx?.gainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it('usa webkitAudioContext como fallback', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', FakeAudioContext);

    playNotificationSound();

    expect(FakeAudioContext.instances.length).toBe(1);
  });

  it('fecha o AudioContext quando o tom termina (evita vazamento)', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    playNotificationSound();
    const ctx = FakeAudioContext.instances.at(-1);
    // O handler onended dispara o close (simulamos o fim do tom).
    ctx?.oscillator.onended?.();
    expect(ctx?.close).toHaveBeenCalledTimes(1);
  });
});

describe('playNotificationSound — fail-safe', () => {
  it('não joga quando AudioContext não existe (no-op)', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    expect(() => {
      playNotificationSound();
    }).not.toThrow();
  });

  it('não propaga erro quando o construtor do AudioContext joga', () => {
    class Boom {
      constructor() {
        throw new Error('áudio indisponível');
      }
    }
    vi.stubGlobal('AudioContext', Boom);
    expect(() => {
      playNotificationSound();
    }).not.toThrow();
  });
});

describe('playNotificationSound — seam de asset (source)', () => {
  it('toca um asset por URL via Audio quando source é fornecido', () => {
    let constructedUrl: string | null = null;
    const play = vi.fn(() => Promise.resolve());
    class FakeAudio {
      volume = 0;
      play = play;
      constructor(url: string) {
        constructedUrl = url;
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    // Garante que NÃO cai no caminho sintetizado.
    vi.stubGlobal('AudioContext', undefined);

    playNotificationSound({ url: 'asset://notify.wav' });

    expect(constructedUrl).toBe('asset://notify.wav');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('é fail-safe quando Audio.play() rejeita (autoplay bloqueado)', () => {
    class FakeAudio {
      volume = 0;
      play = vi.fn(() => Promise.reject(new Error('autoplay bloqueado')));
      constructor(_url: string) {
        // noop
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    expect(() => {
      playNotificationSound({ url: 'asset://x.wav' });
    }).not.toThrow();
  });
});
