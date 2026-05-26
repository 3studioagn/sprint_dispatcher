/**
 * Hook que assina mudanças no tamanho da fila (sem nova sprint a exibir).
 *
 * Disparado pelo main quando o `queueService.length` muda mas o overlay
 * permanece com a sprint atual — caso típico: chega sprint nova enquanto
 * outra está sendo exibida; queue cresce mas overlay não troca de sprint.
 * UI atualiza o badge "+N aguardando".
 */

import { useEffect } from 'react';

import { useQueueStore } from '../stores/useQueueStore';

export function useQueueUpdated(): void {
  const setLength = useQueueStore((s) => s.setLength);

  useEffect(() => {
    const unsub = window.api.queue.onUpdated((event) => {
      setLength(event.queueLength);
    });
    return () => {
      unsub();
    };
  }, [setLength]);
}
