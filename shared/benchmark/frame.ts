/** Resolves on the next animation frame; rejects with the signal's reason if it aborts first. */
export function nextFrame(signal: AbortSignal): Promise<number> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { cancelAnimationFrame(id); signal.removeEventListener('abort', abort); reject(signal.reason); };
    const id = requestAnimationFrame(time => { signal.removeEventListener('abort', abort); resolve(time); });
    signal.addEventListener('abort', abort, { once: true });
  });
}
