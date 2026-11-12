import { useEffect, useRef } from 'react';
import { api } from './api';
import type { KeywordRunDetail } from '../types/project';

const POLL_INTERVAL_MS = 2000;

/**
 * While `runPath` is set, re-reads that run every couple of seconds and reports each
 * update, until the run is no longer Running. A failed read is reported and retried.
 */
export function useRunPolling({
  runPath,
  onUpdate,
  onError,
}: {
  runPath: string | null;
  onUpdate: (run: KeywordRunDetail) => void;
  onError: (err: Error) => void;
}) {
  // Latest callbacks without restarting the polling loop when they change identity.
  const callbacks = useRef({ onUpdate, onError });
  useEffect(() => {
    callbacks.current = { onUpdate, onError };
  });

  useEffect(() => {
    if (!runPath) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const run = await api<KeywordRunDetail>(runPath!);
        if (cancelled) return;
        callbacks.current.onUpdate(run);
        if (run.status !== 'Running') return;
      } catch (err) {
        if (cancelled) return;
        callbacks.current.onError(err as Error);
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runPath]);
}
